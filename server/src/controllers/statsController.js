import PracticeHistory from '../models/PracticeHistory.js';
import FavoritePartner from '../models/FavoritePartner.js';
import Connection from '../models/Connection.js';
import BlockedUser from '../models/BlockedUser.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { effectiveStats } from '../utils/profile.js';
import { dayKey, shiftDay } from '../utils/time.js';
import { presence } from '../services/presence.js';
import { getSettings } from '../services/settingsService.js';

const round1 = (n) => Math.round(n * 10) / 10;
const rowOut = (h) => ({
  id: String(h._id),
  callKey: h.callKey,
  partner: h.partner,
  topic: h.topic,
  kind: h.kind,
  durationSec: h.durationSec,
  minutes: round1(h.durationSec / 60),
  startedAt: h.startedAt,
  endedAt: h.endedAt,
  feedback: h.feedback?.submittedAt ? { rating: h.feedback.rating, friendly: h.feedback.friendly, comfortable: h.feedback.comfortable, connectAgain: h.feedback.connectAgain } : null,
});

export const summary = asyncHandler(async (req, res) => {
  const { doc, publicId, kind } = req.actor;
  const s = effectiveStats(doc);
  const settings = await getSettings();
  const recent = await PracticeHistory.find({ ownerPublicId: publicId }).sort({ startedAt: -1 }).limit(5).lean();
  res.json({
    success: true,
    stats: {
      ...s,
      avgDurationSec: s.totalCalls ? Math.round(s.totalSeconds / s.totalCalls) : 0,
      dailyGoalMinutes: doc.dailyGoalMinutes,
      todayMinutes: round1(s.todaySeconds / 60),
      kind,
    },
    recent: recent.map(rowOut),
    online: presence.counts(),
    limits: settings.limits,
  });
});

export const history = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { ownerPublicId: req.actor.publicId };
  const [items, total] = await Promise.all([
    PracticeHistory.find(filter).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PracticeHistory.countDocuments(filter),
  ]);
  res.json({ success: true, items: items.map(rowOut), page, pages: Math.ceil(total / limit), total });
});

export const charts = asyncHandler(async (req, res) => {
  const { publicId, doc } = req.actor;
  const today = dayKey(new Date(), doc.tzOffset);
  const since = shiftDay(today, -179);
  const rows = await PracticeHistory.aggregate([
    { $match: { ownerPublicId: publicId, day: { $gte: since } } },
    { $group: { _id: '$day', seconds: { $sum: '$durationSec' }, calls: { $sum: 1 } } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const dayRow = (d) => ({ day: d, minutes: round1((byDay.get(d)?.seconds || 0) / 60), calls: byDay.get(d)?.calls || 0 });

  const daily = Array.from({ length: 30 }, (_, i) => dayRow(shiftDay(today, i - 29)));
  const weekly = daily.slice(-7);

  const months = new Map();
  for (const r of rows) {
    const m = r._id.slice(0, 7);
    const cur = months.get(m) || { month: m, minutes: 0, calls: 0 };
    cur.minutes += r.seconds / 60;
    cur.calls += r.calls;
    months.set(m, cur);
  }
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map((m) => ({ ...m, minutes: round1(m.minutes) }));

  res.json({ success: true, weekly, daily, monthly });
});

/** Distinct previous partners, newest first. */
export const partners = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const rows = await PracticeHistory.aggregate([
    { $match: { ownerPublicId: me } },
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: '$partner.publicId',
        partner: { $first: '$partner' },
        lastCallAt: { $first: '$startedAt' },
        lastCallKey: { $first: '$callKey' },
        calls: { $sum: 1 },
        seconds: { $sum: '$durationSec' },
      },
    },
    { $sort: { lastCallAt: -1 } },
    { $limit: 50 },
  ]);
  const ids = rows.map((r) => r._id);
  const [favs, conns, blocks] = await Promise.all([
    FavoritePartner.find({ ownerPublicId: me, partnerPublicId: { $in: ids } }).select('partnerPublicId').lean(),
    Connection.find({ $or: [{ requester: me, recipient: { $in: ids } }, { recipient: me, requester: { $in: ids } }] }).lean(),
    BlockedUser.find({ blockerPublicId: me, blockedPublicId: { $in: ids } }).select('blockedPublicId').lean(),
  ]);
  const favSet = new Set(favs.map((f) => f.partnerPublicId));
  const blockSet = new Set(blocks.map((b) => b.blockedPublicId));
  const connMap = new Map(conns.map((c) => [c.requester === me ? c.recipient : c.requester, c]));
  const connState = (c) => (!c ? 'none' : c.status === 'accepted' ? 'accepted' : c.status === 'pending' ? (c.requester === me ? 'pending_out' : 'pending_in') : 'none');

  res.json({
    success: true,
    items: rows
      .filter((r) => !blockSet.has(r._id))
      .map((r) => ({
        ...r.partner,
        calls: r.calls,
        minutes: round1(r.seconds / 60),
        lastCallAt: r.lastCallAt,
        favorite: favSet.has(r._id),
        connection: connState(connMap.get(r._id)),
      })),
  });
});
