import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import CallSession from '../models/CallSession.js';
import UserReport from '../models/UserReport.js';
import Subscription from '../models/Subscription.js';
import Admin from '../models/Admin.js';
import ConversationTopic from '../models/ConversationTopic.js';
import Vocabulary from '../models/Vocabulary.js';
import LearningResource from '../models/LearningResource.js';
import Faq from '../models/Faq.js';
import { GOALS, LEVELS, PRACTICE_LANGUAGES } from '../models/_shared.js';
import { ADMIN_ROLES, can, permissionsFor } from '../config/permissions.js';
import { env } from '../config/env.js';
import { turnConfigured } from '../config/ice.js';
import { ApiError, badRequest, forbidden, notFound, unauthorized } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAdminToken } from '../utils/tokens.js';
import { effectiveStats } from '../utils/profile.js';
import { dayKey, shiftDay } from '../utils/time.js';
import { presence } from '../services/presence.js';
import { callService, invalidateTopicCache } from '../services/callService.js';
import { hub, matchmaker } from '../services/matchHub.js';
import { getIo } from '../services/realtime.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { deleteUserCascade } from '../services/accountService.js';
import { notify } from '../services/notificationService.js';
import { displayNameRule, passwordRule } from './authController.js';

const DUMMY_HASH = bcrypt.hashSync('speakmate-admin-dummy', 10);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round1 = (n) => Math.round(n * 10) / 10;
const pageOf = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const isObjectId = (id) => mongoose.isValidObjectId(id);

export const schemas = {
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }),
  userEdit: z.object({
    displayName: displayNameRule.optional(),
    country: z.string().trim().max(60).optional(),
    nativeLanguage: z.string().trim().max(40).optional(),
    englishLevel: z.enum(LEVELS).optional(),
    learningGoals: z.array(z.enum(GOALS)).max(7).optional(),
    practiceLanguage: z.enum(PRACTICE_LANGUAGES).optional(),
    removeAvatar: z.boolean().optional(),
  }),
  userStatus: z.object({
    status: z.enum(['active', 'suspended', 'blocked']),
    reason: z.string().trim().max(300).optional(),
    days: z.number().int().min(1).max(365).optional(),
  }),
  premium: z.object({ grant: z.boolean(), days: z.number().int().min(1).max(3650).optional(), note: z.string().max(200).optional() }),
  reportUpdate: z.object({
    status: z.enum(['open', 'investigating', 'resolved', 'dismissed']).optional(),
    adminNote: z.string().trim().max(1000).optional(),
    action: z.enum(['none', 'warn', 'suspend', 'block']).optional(),
  }),
  admin: z.object({
    email: z.string().trim().toLowerCase().email(),
    name: z.string().trim().min(2).max(60),
    password: passwordRule,
    role: z.enum(ADMIN_ROLES),
  }),
  adminUpdate: z.object({
    name: z.string().trim().min(2).max(60).optional(),
    role: z.enum(ADMIN_ROLES).optional(),
    active: z.boolean().optional(),
    password: passwordRule.optional(),
  }),
  settings: z.object({
    appName: z.string().trim().min(1).max(40).optional(),
    tagline: z.string().trim().max(120).optional(),
    logoUrl: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), 'Logo must be an http(s) URL').optional(),
    supportEmail: z.string().trim().email().optional(),
    theme: z.record(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use hex colors like #7ED957')).optional(),
    matching: z
      .object({
        initialLevelDiff: z.number().int().min(0).max(4),
        relaxEverySec: z.number().int().min(3).max(120),
        samePracticeLanguageSec: z.number().int().min(0).max(300),
        avoidRecentPartnersSec: z.number().int().min(0).max(600),
        recentPartnerMemory: z.number().int().min(0).max(50),
      })
      .partial()
      .optional(),
    limits: z
      .object({
        freeDailyMinutes: z.number().int().min(1).max(1440),
        premiumDailyMinutes: z.number().int().min(1).max(1440),
        guestDailyMinutes: z.number().int().min(1).max(1440),
        maxCallMinutes: z.number().int().min(1).max(240),
      })
      .partial()
      .optional(),
    guest: z.object({ enabled: z.boolean() }).partial().optional(),
    maintenance: z.object({ enabled: z.boolean(), message: z.string().trim().max(200) }).partial().optional(),
  }),
};

// ------------------------------------------------------------------ auth
const adminOut = (a) => ({
  id: String(a._id),
  email: a.email,
  name: a.name,
  role: a.role,
  active: a.active,
  permissions: permissionsFor(a.role),
  lastLoginAt: a.lastLoginAt,
  createdAt: a.createdAt,
});

export const login = asyncHandler(async (req, res) => {
  const admin = await Admin.findOne({ email: req.body.email }).select('+passwordHash');
  const ok = await bcrypt.compare(req.body.password, admin?.passwordHash || DUMMY_HASH);
  if (!admin || !ok || !admin.active) throw unauthorized('Incorrect admin email or password', 'BAD_CREDENTIALS');
  admin.lastLoginAt = new Date();
  await admin.save();
  res.json({ success: true, token: signAdminToken(admin), admin: adminOut(admin) });
});

export const me = (req, res) => res.json({ success: true, admin: adminOut(req.admin) });

// ------------------------------------------------------------- dashboard
export const dashboard = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 13 * 24 * 3600 * 1000);
  since.setUTCHours(0, 0, 0, 0);
  const [registered, guests, totalCalls, secAgg, openReports, regUsers, regGuests, restricted] = await Promise.all([
    User.countDocuments(),
    GuestSession.countDocuments(),
    CallSession.countDocuments(),
    CallSession.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, sec: { $sum: '$durationSec' } } }]),
    UserReport.countDocuments({ status: { $in: ['open', 'investigating'] } }),
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    GuestSession.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    User.countDocuments({ status: { $ne: 'active' } }),
  ]);
  const u = new Map(regUsers.map((r) => [r._id, r.n]));
  const g = new Map(regGuests.map((r) => [r._id, r.n]));
  const today = dayKey();
  const dailyRegistrations = Array.from({ length: 14 }, (_, i) => {
    const d = shiftDay(today, i - 13);
    return { day: d, users: u.get(d) || 0, guests: g.get(d) || 0 };
  });
  const counts = presence.counts();
  const callSeconds = secAgg[0]?.sec || 0;
  res.json({
    success: true,
    stats: {
      registeredUsers: registered,
      guestUsers: guests,
      onlineUsers: counts.online,
      searching: counts.searching,
      activeCalls: callService.count(),
      totalCalls,
      // each call has two speakers
      totalSpeakingMinutes: Math.round((callSeconds * 2) / 60),
      openReports,
      restrictedUsers: restricted,
    },
    dailyRegistrations,
  });
});

// ------------------------------------------------------------------ users
const userRow = (d, kind, extra = {}) => ({
  id: String(d._id),
  kind,
  publicId: d.publicId,
  email: kind === 'user' ? d.email : null,
  displayName: d.displayName,
  avatarUrl: d.avatarUrl || null,
  country: d.country,
  nativeLanguage: d.nativeLanguage,
  englishLevel: d.englishLevel,
  learningGoals: d.learningGoals,
  practiceLanguage: d.practiceLanguage,
  status: d.status,
  statusReason: d.statusReason,
  suspendedUntil: d.suspendedUntil || null,
  plan: kind === 'user' && d.plan === 'premium' && (!d.planExpiresAt || d.planExpiresAt > new Date()) ? 'premium' : 'free',
  planExpiresAt: d.planExpiresAt || null,
  emailVerified: kind === 'user' ? d.emailVerified : null,
  onboardingCompleted: d.onboardingCompleted,
  createdAt: d.createdAt,
  lastSeenAt: d.lastSeenAt || null,
  stats: effectiveStats(d),
  presence: presence.get(d.publicId),
  rating: kind === 'user' && d.ratingCount ? round1(d.ratingSum / d.ratingCount) : null,
  ...extra,
});

const modelFor = (kind) => (kind === 'guest' ? GuestSession : User);

export const listUsers = asyncHandler(async (req, res) => {
  const kind = req.query.kind === 'guest' ? 'guest' : 'user';
  const { page, limit, skip } = pageOf(req);
  const filter = {};
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) {
    const rx = new RegExp(esc(q), 'i');
    filter.$or = kind === 'user' ? [{ displayName: rx }, { email: rx }, { publicId: q }] : [{ displayName: rx }, { publicId: q }];
  }
  if (['active', 'suspended', 'blocked'].includes(req.query.status)) filter.status = req.query.status;
  if (kind === 'user' && ['free', 'premium'].includes(req.query.plan)) filter.plan = req.query.plan;
  const Model = modelFor(kind);
  const [docs, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Model.countDocuments(filter),
  ]);
  const reportCounts = await UserReport.aggregate([
    { $match: { reportedPublicId: { $in: docs.map((d) => d.publicId) } } },
    { $group: { _id: '$reportedPublicId', n: { $sum: 1 } } },
  ]);
  const rc = new Map(reportCounts.map((r) => [r._id, r.n]));
  res.json({
    success: true,
    items: docs.map((d) => userRow(d, kind, { reports: rc.get(d.publicId) || 0 })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

async function loadTarget(req) {
  const kind = req.query.kind === 'guest' ? 'guest' : 'user';
  if (!isObjectId(req.params.id)) throw notFound('User not found');
  const doc = await modelFor(kind).findById(req.params.id);
  if (!doc) throw notFound('User not found');
  return { doc, kind };
}

export const getUser = asyncHandler(async (req, res) => {
  const { doc, kind } = await loadTarget(req);
  const [calls, reportsAgainst, subs] = await Promise.all([
    CallSession.find({ 'participants.publicId': doc.publicId }).sort({ createdAt: -1 }).limit(10).lean(),
    UserReport.find({ reportedPublicId: doc.publicId }).sort({ createdAt: -1 }).limit(10).lean(),
    kind === 'user' ? Subscription.find({ user: doc._id }).sort({ createdAt: -1 }).limit(5).lean() : [],
  ]);
  res.json({
    success: true,
    user: userRow(doc, kind),
    calls: calls.map(callRow),
    reports: reportsAgainst.map((r) => ({ id: String(r._id), reason: r.reason, status: r.status, createdAt: r.createdAt })),
    subscriptions: subs.map((s) => ({ id: String(s._id), plan: s.plan, status: s.status, provider: s.provider, startedAt: s.startedAt, expiresAt: s.expiresAt, note: s.note })),
  });
});

export const editUser = asyncHandler(async (req, res) => {
  const { doc, kind } = await loadTarget(req);
  const { removeAvatar, ...fields } = req.body;
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) doc[k] = v;
  if (removeAvatar) doc.avatarUrl = null;
  await doc.save();
  res.json({ success: true, user: userRow(doc, kind) });
});

export const setStatus = asyncHandler(async (req, res) => {
  const { doc, kind } = await loadTarget(req);
  const { status, reason, days } = req.body;
  doc.status = status;
  doc.statusReason = status === 'active' ? '' : reason || '';
  if (kind === 'user') doc.suspendedUntil = status === 'suspended' && days ? new Date(Date.now() + days * 86400000) : null;
  await doc.save();
  if (status !== 'active') hub.forceOffline(doc.publicId, status);
  res.json({ success: true, user: userRow(doc, kind) });
});

export const removeUser = asyncHandler(async (req, res) => {
  const { doc, kind } = await loadTarget(req);
  if (kind === 'user') await deleteUserCascade(doc);
  else {
    await doc.deleteOne();
    hub.forceOffline(doc.publicId, 'deleted');
  }
  res.json({ success: true });
});

export const setPremium = asyncHandler(async (req, res) => {
  const { doc, kind } = await loadTarget(req);
  if (kind !== 'user') throw badRequest('Only registered users can have a plan.');
  const { grant, days, note } = req.body;
  if (grant) {
    const expiresAt = days ? new Date(Date.now() + days * 86400000) : null;
    doc.plan = 'premium';
    doc.planExpiresAt = expiresAt;
    await Subscription.updateMany({ user: doc._id, status: 'active' }, { status: 'cancelled' });
    await Subscription.create({ user: doc._id, plan: 'premium', provider: 'manual', expiresAt, note, grantedBy: req.admin._id });
  } else {
    doc.plan = 'free';
    doc.planExpiresAt = null;
    await Subscription.updateMany({ user: doc._id, status: 'active' }, { status: 'cancelled' });
  }
  await doc.save();
  res.json({ success: true, user: userRow(doc, kind) });
});

// ------------------------------------------------------------------ calls
const callRow = (c) => ({
  callKey: c.callKey,
  kind: c.kind,
  status: c.status,
  endReason: c.endReason || null,
  quality: c.quality || null,
  topic: c.topic?.title || null,
  durationSec: c.durationSec || 0,
  connectMs: c.connectMs || null,
  createdAt: c.createdAt,
  endedAt: c.endedAt || null,
  participants: (c.participants || []).map((p) => ({ publicId: p.publicId, displayName: p.displayName, kind: p.kind })),
});

export const activeCalls = (_req, res) => res.json({ success: true, items: callService.activeList(), searching: matchmaker.size() });

export const callHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageOf(req);
  const filter = {};
  if (['connecting', 'in_call', 'completed', 'failed', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.publicId) filter['participants.publicId'] = String(req.query.publicId);
  const [items, total] = await Promise.all([
    CallSession.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CallSession.countDocuments(filter),
  ]);
  res.json({ success: true, items: items.map(callRow), total, page, pages: Math.ceil(total / limit) });
});

export const audioHealth = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [agg, reasons, quality] = await Promise.all([
    CallSession.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgConnectMs: { $avg: '$connectMs' },
          avgDuration: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$durationSec', null] } },
        },
      },
    ]),
    CallSession.aggregate([{ $match: { createdAt: { $gte: since }, status: 'failed' } }, { $group: { _id: '$endReason', n: { $sum: 1 } } }]),
    CallSession.aggregate([{ $match: { createdAt: { $gte: since }, quality: { $ne: null } } }, { $group: { _id: '$quality', n: { $sum: 1 } } }]),
  ]);
  const a = agg[0] || { total: 0, completed: 0, failed: 0 };
  const attempts = a.completed + a.failed;
  res.json({
    success: true,
    health: {
      uptimeSec: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1048576),
      dbState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      socketConnections: getIo()?.engine?.clientsCount ?? 0,
      activeCalls: callService.count(),
      queueSize: matchmaker.size(),
      turnConfigured: turnConfigured(),
      redisAdapter: Boolean(env.redisUrl),
      last24h: {
        calls: a.total,
        completed: a.completed,
        failed: a.failed,
        connectSuccessRate: attempts ? Math.round((a.completed / attempts) * 100) : null,
        avgConnectSec: a.avgConnectMs ? round1(a.avgConnectMs / 1000) : null,
        avgDurationSec: a.avgDuration ? Math.round(a.avgDuration) : null,
        failureReasons: reasons.map((r) => ({ reason: r._id || 'unknown', count: r.n })),
        quality: Object.fromEntries(quality.map((q) => [q._id, q.n])),
      },
    },
  });
});

export const forceEndCall = asyncHandler(async (req, res) => {
  const call = callService.get(req.params.callKey);
  if (!call) throw notFound('That call is no longer active');
  callService.end(call.id, { reason: 'admin', endedBy: null });
  res.json({ success: true });
});

// ---------------------------------------------------------------- reports
const reportRow = (r) => ({
  id: String(r._id),
  reporter: { publicId: r.reporterPublicId, kind: r.reporterKind },
  reported: { publicId: r.reportedPublicId, kind: r.reportedKind, displayName: r.reportedName, userId: r.reportedUser ? String(r.reportedUser) : null },
  callKey: r.callKey || null,
  reason: r.reason,
  details: r.details,
  status: r.status,
  adminNote: r.adminNote,
  action: r.action,
  handledAt: r.handledAt || null,
  createdAt: r.createdAt,
});

export const listReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageOf(req);
  const filter = {};
  if (['open', 'investigating', 'resolved', 'dismissed'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.publicId) filter.reportedPublicId = String(req.query.publicId);
  const [items, total] = await Promise.all([
    UserReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserReport.countDocuments(filter),
  ]);
  const counts = await UserReport.aggregate([
    { $match: { reportedPublicId: { $in: items.map((i) => i.reportedPublicId) } } },
    { $group: { _id: '$reportedPublicId', n: { $sum: 1 } } },
  ]);
  const cm = new Map(counts.map((c) => [c._id, c.n]));
  res.json({
    success: true,
    items: items.map((r) => ({ ...reportRow(r), reportedTotalReports: cm.get(r.reportedPublicId) || 1 })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

export const investigateReport = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Report not found');
  const report = await UserReport.findById(req.params.id).lean();
  if (!report) throw notFound('Report not found');
  const [target, others, call] = await Promise.all([
    (report.reportedKind === 'user' ? User : GuestSession).findOne({ publicId: report.reportedPublicId }),
    UserReport.find({ reportedPublicId: report.reportedPublicId, _id: { $ne: report._id } }).sort({ createdAt: -1 }).limit(10).lean(),
    report.callKey ? CallSession.findOne({ callKey: report.callKey }).lean() : null,
  ]);
  res.json({
    success: true,
    report: reportRow(report),
    reportedUser: target ? userRow(target, report.reportedKind) : null,
    otherReports: others.map(reportRow),
    call: call ? callRow(call) : null,
  });
});

export const updateReport = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Report not found');
  const report = await UserReport.findById(req.params.id);
  if (!report) throw notFound('Report not found');
  const { status, adminNote, action } = req.body;

  if (action && action !== 'none') {
    if (!can(req.admin.role, 'users.restrict') && action !== 'warn') throw forbidden('You cannot restrict users.', 'ADMIN_FORBIDDEN');
    const Model = report.reportedKind === 'user' ? User : GuestSession;
    const target = await Model.findOne({ publicId: report.reportedPublicId });
    if (!target) throw notFound('Reported user no longer exists');
    if (action === 'warn') {
      if (report.reportedKind === 'user') {
        await notify(target.publicId, {
          type: 'system',
          title: 'Community guidelines reminder',
          body: 'We received a report about your behaviour. Please follow the community guidelines to keep SpeakMate friendly.',
        });
      }
    } else {
      target.status = action === 'block' ? 'blocked' : 'suspended';
      target.statusReason = `Report: ${report.reason}`;
      if (action === 'suspend' && report.reportedKind === 'user') target.suspendedUntil = new Date(Date.now() + 7 * 86400000);
      await target.save();
      hub.forceOffline(target.publicId, target.status);
    }
    report.action = action;
  }
  if (status) report.status = status;
  if (adminNote !== undefined) report.adminNote = adminNote;
  report.handledBy = req.admin._id;
  report.handledAt = new Date();
  await report.save();
  res.json({ success: true, report: reportRow(report) });
});

// ---------------------------------------------------------------- content
const CONTENT = {
  topics: {
    Model: ConversationTopic,
    sort: { order: 1, title: 1 },
    schema: z.object({
      slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers, dashes').min(2).max(40),
      title: z.string().trim().min(2).max(60),
      description: z.string().trim().max(200).optional(),
      icon: z.string().trim().max(8).optional(),
      starters: z.array(z.string().trim().min(2).max(160)).max(20).optional(),
      premium: z.boolean().optional(),
      active: z.boolean().optional(),
      order: z.number().int().min(0).max(999).optional(),
    }),
  },
  vocabulary: {
    Model: Vocabulary,
    sort: { kind: 1, word: 1 },
    schema: z.object({
      kind: z.enum(['word', 'phrase', 'starter']),
      word: z.string().trim().min(1).max(120),
      meaning: z.string().trim().max(300).optional(),
      example: z.string().trim().max(300).optional(),
      level: z.enum(LEVELS).optional(),
      topicSlug: z.string().trim().toLowerCase().max(40).nullable().optional(),
      active: z.boolean().optional(),
    }),
  },
  resources: {
    Model: LearningResource,
    sort: { order: 1, createdAt: 1 },
    schema: z.object({
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().max(300).optional(),
      url: z.string().trim().url().refine((v) => /^https?:\/\//i.test(v), 'URL must be http(s)'),
      category: z.string().trim().max(40).optional(),
      active: z.boolean().optional(),
      order: z.number().int().min(0).max(999).optional(),
    }),
  },
  faqs: {
    Model: Faq,
    sort: { order: 1, createdAt: 1 },
    schema: z.object({
      question: z.string().trim().min(3).max(200),
      answer: z.string().trim().min(3).max(1500),
      active: z.boolean().optional(),
      order: z.number().int().min(0).max(999).optional(),
    }),
  },
};

const contentCfg = (req) => {
  const cfg = CONTENT[req.params.type];
  if (!cfg) throw notFound('Unknown content type');
  return cfg;
};
const clean = (d) => {
  const o = d.toObject ? d.toObject() : d;
  const { _id, __v, ...rest } = o;
  return { id: String(_id), ...rest };
};

export const listContent = asyncHandler(async (req, res) => {
  const { Model, sort } = contentCfg(req);
  const items = await Model.find().sort(sort).lean();
  res.json({ success: true, items: items.map(clean) });
});

export const createContent = asyncHandler(async (req, res) => {
  const { Model, schema } = contentCfg(req);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, parsed.error.issues[0].message, 'VALIDATION_ERROR');
  const doc = await Model.create(parsed.data);
  invalidateTopicCache();
  res.status(201).json({ success: true, item: clean(doc) });
});

export const updateContent = asyncHandler(async (req, res) => {
  const { Model, schema } = contentCfg(req);
  if (!isObjectId(req.params.id)) throw notFound('Item not found');
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, parsed.error.issues[0].message, 'VALIDATION_ERROR');
  const doc = await Model.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!doc) throw notFound('Item not found');
  invalidateTopicCache();
  res.json({ success: true, item: clean(doc) });
});

export const deleteContent = asyncHandler(async (req, res) => {
  const { Model } = contentCfg(req);
  if (!isObjectId(req.params.id)) throw notFound('Item not found');
  await Model.findByIdAndDelete(req.params.id);
  invalidateTopicCache();
  res.json({ success: true });
});

// --------------------------------------------------------------- settings
export const getAppSettings = asyncHandler(async (_req, res) => res.json({ success: true, settings: await getSettings() }));

export const putAppSettings = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.theme) {
    const allowed = ['primary', 'secondary', 'background', 'light', 'text'];
    body.theme = Object.fromEntries(Object.entries(body.theme).filter(([k]) => allowed.includes(k)));
  }
  res.json({ success: true, settings: await updateSettings(body) });
});

// ----------------------------------------------------------------- admins
export const listAdmins = asyncHandler(async (_req, res) => {
  const items = await Admin.find().sort({ createdAt: 1 });
  res.json({ success: true, items: items.map(adminOut) });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  if (await Admin.exists({ email: rest.email })) throw new ApiError(409, 'An admin with this email already exists', 'DUPLICATE');
  const admin = await Admin.create({ ...rest, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ success: true, admin: adminOut(admin) });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Admin not found');
  const admin = await Admin.findById(req.params.id);
  if (!admin) throw notFound('Admin not found');
  const { password, ...fields } = req.body;
  const self = String(admin._id) === String(req.admin._id);
  if (self && (fields.active === false || (fields.role && fields.role !== admin.role))) {
    throw badRequest('You cannot deactivate or demote your own account.');
  }
  if (admin.role === 'super_admin' && (fields.active === false || (fields.role && fields.role !== 'super_admin'))) {
    const others = await Admin.countDocuments({ role: 'super_admin', active: true, _id: { $ne: admin._id } });
    if (!others) throw badRequest('There must be at least one active Super Admin.');
  }
  Object.assign(admin, fields);
  if (password) {
    admin.passwordHash = await bcrypt.hash(password, 12);
    admin.tokenVersion += 1;
  }
  if (fields.active === false || fields.role) admin.tokenVersion += 1;
  await admin.save();
  res.json({ success: true, admin: adminOut(admin) });
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Admin not found');
  if (String(req.admin._id) === req.params.id) throw badRequest('You cannot delete your own account.');
  const admin = await Admin.findById(req.params.id);
  if (!admin) throw notFound('Admin not found');
  if (admin.role === 'super_admin') {
    const others = await Admin.countDocuments({ role: 'super_admin', active: true, _id: { $ne: admin._id } });
    if (!others) throw badRequest('There must be at least one active Super Admin.');
  }
  await admin.deleteOne();
  res.json({ success: true });
});
