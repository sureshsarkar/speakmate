import { z } from 'zod';
import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import FavoritePartner from '../models/FavoritePartner.js';
import Connection, { pairKeyOf } from '../models/Connection.js';
import BlockedUser from '../models/BlockedUser.js';
import UserReport, { REPORT_REASONS } from '../models/UserReport.js';
import Notification from '../models/Notification.js';
import PracticeHistory from '../models/PracticeHistory.js';
import CallSession from '../models/CallSession.js';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicProfile } from '../utils/profile.js';
import { presence } from '../services/presence.js';
import { callService } from '../services/callService.js';
import { notify, serialize } from '../services/notificationService.js';

const pid = z.string().min(6).max(40);
export const schemas = {
  partner: z.object({ publicId: pid }),
  respond: z.object({ accept: z.boolean() }),
  report: z.object({
    reportedPublicId: pid,
    callKey: z.string().max(60).optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  }),
  feedback: z.object({
    friendly: z.boolean().optional(),
    comfortable: z.boolean().optional(),
    connectAgain: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).optional(),
  }),
};

async function findPublic(publicId) {
  const user = await User.findOne({ publicId });
  if (user) return { doc: user, kind: 'user' };
  const guest = await GuestSession.findOne({ publicId });
  return guest ? { doc: guest, kind: 'guest' } : null;
}

/** You may only interact with people you have actually practised with. */
async function hasPracticedWith(me, other, callKey) {
  if (await PracticeHistory.exists({ ownerPublicId: me, 'partner.publicId': other })) return true;
  if (callKey && (await CallSession.exists({ callKey, 'participants.publicId': { $all: [me, other] } }))) return true;
  return false;
}

const isBlockedEitherWay = (a, b) =>
  BlockedUser.exists({
    $or: [
      { blockerPublicId: a, blockedPublicId: b },
      { blockerPublicId: b, blockedPublicId: a },
    ],
  });

const statusOf = (u) => {
  if (u.privacy?.showOnlineStatus === false) return 'hidden';
  const s = presence.get(u.publicId);
  return s === 'offline' ? 'offline' : s === 'online' ? 'online' : 'busy';
};

const cardOf = (u) => ({ ...publicProfile(u, 'user'), status: statusOf(u) });

// ------------------------------------------------------------------ favorites
export const listFavorites = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const favs = await FavoritePartner.find({ ownerPublicId: me }).sort({ createdAt: -1 }).lean();
  const ids = favs.map((f) => f.partnerPublicId);
  const [users, conns, lastCalls] = await Promise.all([
    User.find({ publicId: { $in: ids }, status: 'active' }).lean(),
    Connection.find({ $or: [{ requester: me, recipient: { $in: ids } }, { recipient: me, requester: { $in: ids } }] }).lean(),
    PracticeHistory.aggregate([
      { $match: { ownerPublicId: me, 'partner.publicId': { $in: ids } } },
      { $group: { _id: '$partner.publicId', last: { $max: '$startedAt' }, calls: { $sum: 1 } } },
    ]),
  ]);
  const uMap = new Map(users.map((u) => [u.publicId, u]));
  const cMap = new Map(conns.map((c) => [c.requester === me ? c.recipient : c.requester, c]));
  const lMap = new Map(lastCalls.map((l) => [l._id, l]));
  const conn = (c) => (!c ? 'none' : c.status === 'accepted' ? 'accepted' : c.status === 'pending' ? (c.requester === me ? 'pending_out' : 'pending_in') : 'none');

  res.json({
    success: true,
    items: favs
      .filter((f) => uMap.has(f.partnerPublicId))
      .map((f) => ({
        ...cardOf(uMap.get(f.partnerPublicId)),
        connection: conn(cMap.get(f.partnerPublicId)),
        lastCallAt: lMap.get(f.partnerPublicId)?.last || null,
        calls: lMap.get(f.partnerPublicId)?.calls || 0,
        addedAt: f.createdAt,
      })),
  });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const { publicId } = req.body;
  const target = await User.findOne({ publicId, status: 'active' });
  if (!target) throw badRequest('Only registered partners can be added to favorites.', 'NOT_ELIGIBLE');
  if (!(await hasPracticedWith(me, publicId))) throw forbidden('You can add people you have practised with.', 'NOT_ELIGIBLE');
  if (await isBlockedEitherWay(me, publicId)) throw forbidden('This partner is not available.', 'NOT_ELIGIBLE');
  await FavoritePartner.updateOne(
    { ownerPublicId: me, partnerPublicId: publicId },
    { $setOnInsert: { partnerUser: target._id } },
    { upsert: true }
  );
  res.status(201).json({ success: true });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  await FavoritePartner.deleteOne({ ownerPublicId: req.actor.publicId, partnerPublicId: req.params.publicId });
  res.json({ success: true });
});

// ---------------------------------------------------------------- connections
export const listConnections = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const rows = await Connection.find({ $or: [{ requester: me }, { recipient: me }], status: { $in: ['pending', 'accepted'] } })
    .sort({ updatedAt: -1 })
    .lean();
  const otherIds = rows.map((c) => (c.requester === me ? c.recipient : c.requester));
  const users = await User.find({ publicId: { $in: otherIds }, status: 'active' }).lean();
  const uMap = new Map(users.map((u) => [u.publicId, u]));
  const out = { incoming: [], outgoing: [], accepted: [] };
  for (const c of rows) {
    const other = uMap.get(c.requester === me ? c.recipient : c.requester);
    if (!other) continue;
    const item = { id: String(c._id), ...cardOf(other), since: c.updatedAt };
    if (c.status === 'accepted') out.accepted.push(item);
    else if (c.recipient === me) out.incoming.push(item);
    else out.outgoing.push(item);
  }
  res.json({ success: true, ...out });
});

export const requestConnection = asyncHandler(async (req, res) => {
  const me = req.actor.doc;
  const other = req.body.publicId;
  if (other === me.publicId) throw badRequest('You cannot connect with yourself.');
  const target = await User.findOne({ publicId: other, status: 'active' });
  if (!target) throw badRequest('Only registered partners can receive practice requests.', 'NOT_ELIGIBLE');
  if (!(await hasPracticedWith(me.publicId, other))) throw forbidden('You can send requests to people you have practised with.', 'NOT_ELIGIBLE');
  if (await isBlockedEitherWay(me.publicId, other)) throw forbidden('This partner is not available.', 'NOT_ELIGIBLE');

  const pairKey = pairKeyOf(me.publicId, other);
  let conn = await Connection.findOne({ pairKey });
  if (conn?.status === 'accepted') throw conflict('You are already connected.', 'ALREADY_CONNECTED');
  if (conn?.status === 'pending') {
    if (conn.requester === me.publicId) throw conflict('Request already sent.', 'ALREADY_SENT');
    // They already asked us: treat as acceptance
    conn.status = 'accepted';
    conn.respondedAt = new Date();
    await conn.save();
    await notify(other, { type: 'request_accepted', title: `${me.displayName} accepted your practice request`, body: 'You can now start audio calls together.', data: { from: publicProfile(me, 'user') } });
    return res.json({ success: true, status: 'accepted' });
  }
  if (conn?.status === 'declined' && conn.respondedAt && Date.now() - conn.respondedAt.getTime() < 24 * 3600 * 1000) {
    throw conflict('You can send another request tomorrow.', 'COOLDOWN');
  }
  if (!conn) conn = new Connection({ pairKey });
  Object.assign(conn, { requester: me.publicId, recipient: other, status: 'pending', respondedAt: null });
  await conn.save();

  await notify(other, {
    type: 'friend_request',
    title: `${me.displayName} wants to practise with you`,
    body: 'Accept to start direct audio calls together.',
    data: { connectionId: String(conn._id), from: publicProfile(me, 'user') },
  });
  res.status(201).json({ success: true, status: 'pending' });
});

export const respondConnection = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const conn = await Connection.findById(req.params.id);
  if (!conn || conn.recipient !== me || conn.status !== 'pending') throw notFound('Request not found');
  conn.status = req.body.accept ? 'accepted' : 'declined';
  conn.respondedAt = new Date();
  await conn.save();
  await Notification.updateMany(
    { recipientPublicId: me, 'data.connectionId': String(conn._id) },
    { $set: { readAt: new Date(), 'data.handled': conn.status } }
  );
  if (req.body.accept) {
    await notify(conn.requester, {
      type: 'request_accepted',
      title: `${req.actor.doc.displayName} accepted your practice request`,
      body: 'You can now start audio calls together.',
      data: { from: publicProfile(req.actor.doc, 'user') },
    });
  }
  res.json({ success: true, status: conn.status });
});

export const removeConnection = asyncHandler(async (req, res) => {
  await Connection.deleteOne({ pairKey: pairKeyOf(req.actor.publicId, req.params.publicId) });
  res.json({ success: true });
});

// --------------------------------------------------------------------- blocks
export const listBlocks = asyncHandler(async (req, res) => {
  const items = await BlockedUser.find({ blockerPublicId: req.actor.publicId }).sort({ createdAt: -1 }).lean();
  res.json({
    success: true,
    items: items.map((b) => ({ publicId: b.blockedPublicId, displayName: b.blockedName, avatarUrl: b.blockedAvatarUrl, blockedAt: b.createdAt })),
  });
});

export const blockUser = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const { publicId } = req.body;
  if (publicId === me) throw badRequest('You cannot block yourself.');
  const recent = await PracticeHistory.findOne({ ownerPublicId: me, 'partner.publicId': publicId }).sort({ startedAt: -1 }).lean();
  const other = await findPublic(publicId);
  if (!recent && !other) throw notFound('User not found');
  // A user may only block people they have met (or who exist), never probe arbitrary ids
  if (!recent && !(await hasPracticedWith(me, publicId))) {
    const live = callService.forActor(me);
    if (!live?.sides[publicId]) throw forbidden('You can block people you have practised with.', 'NOT_ELIGIBLE');
  }
  await BlockedUser.updateOne(
    { blockerPublicId: me, blockedPublicId: publicId },
    {
      $set: {
        blockedName: recent?.partner.displayName || other?.doc.displayName || 'User',
        blockedAvatarUrl: recent?.partner.avatarUrl || other?.doc.avatarUrl || null,
      },
    },
    { upsert: true }
  );
  await Promise.all([
    FavoritePartner.deleteMany({ $or: [{ ownerPublicId: me, partnerPublicId: publicId }, { ownerPublicId: publicId, partnerPublicId: me }] }),
    Connection.deleteOne({ pairKey: pairKeyOf(me, publicId) }),
  ]);
  const live = callService.forActor(me);
  if (live?.sides[publicId]) callService.end(live.id, { reason: 'ended', endedBy: me });
  res.status(201).json({ success: true });
});

export const unblockUser = asyncHandler(async (req, res) => {
  await BlockedUser.deleteOne({ blockerPublicId: req.actor.publicId, blockedPublicId: req.params.publicId });
  res.json({ success: true });
});

// -------------------------------------------------------------------- reports
export const createReport = asyncHandler(async (req, res) => {
  const me = req.actor;
  const { reportedPublicId, callKey, reason, details } = req.body;
  if (reportedPublicId === me.publicId) throw badRequest('You cannot report yourself.');
  if (!(await hasPracticedWith(me.publicId, reportedPublicId, callKey))) {
    throw forbidden('You can report people you have spoken with.', 'NOT_ELIGIBLE');
  }
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  if (await UserReport.exists({ reporterPublicId: me.publicId, reportedPublicId, createdAt: { $gt: dayAgo } })) {
    throw conflict('You already reported this user. Our team is reviewing it.', 'ALREADY_REPORTED');
  }
  const target = await findPublic(reportedPublicId);
  if (!target) throw notFound('User not found');
  await UserReport.create({
    reporterPublicId: me.publicId,
    reporterKind: me.kind,
    reportedPublicId,
    reportedKind: target.kind,
    reportedName: target.doc.displayName,
    reportedUser: target.kind === 'user' ? target.doc._id : undefined,
    callKey,
    reason,
    details: details || '',
  });
  res.status(201).json({ success: true, message: 'Thanks. Our moderators will review your report.' });
});

// -------------------------------------------------------------- notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const filter = { recipientPublicId: req.actor.publicId };
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(60).lean(),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  res.json({ success: true, items: items.map(serialize), unread });
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipientPublicId: req.actor.publicId, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipientPublicId: req.actor.publicId, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipientPublicId: req.actor.publicId });
  res.json({ success: true });
});

// ------------------------------------------------------------------- feedback
export const submitFeedback = asyncHandler(async (req, res) => {
  const me = req.actor.publicId;
  const row = await PracticeHistory.findOne({ ownerPublicId: me, callKey: req.params.callKey });
  if (!row) throw new ApiError(404, 'This call was too short to leave feedback for.', 'NOT_FOUND');
  const prev = row.feedback?.rating;
  const { friendly, comfortable, connectAgain, rating } = req.body;
  row.feedback = { friendly, comfortable, connectAgain, rating, submittedAt: new Date() };
  await row.save();

  if (rating && !row.partner.isGuest) {
    await User.updateOne(
      { publicId: row.partner.publicId },
      { $inc: { ratingSum: rating - (prev || 0), ratingCount: prev ? 0 : 1 } }
    );
  }
  res.json({ success: true });
});
