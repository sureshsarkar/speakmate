import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import BlockedUser from '../models/BlockedUser.js';
import PracticeHistory from '../models/PracticeHistory.js';
import Connection, { pairKeyOf } from '../models/Connection.js';
import ConversationTopic from '../models/ConversationTopic.js';
import { Matchmaker } from './matchmaker.js';
import { callService } from './callService.js';
import { presence } from './presence.js';
import { emitToActor, emitToSocket } from './realtime.js';
import { getSettings } from './settingsService.js';
import { notify } from './notificationService.js';
import { effectiveStats, levelIndex, publicProfile, isPremiumDoc } from '../utils/profile.js';
import { logger } from '../config/logger.js';

const INVITE_TTL_MS = 30_000;
const IN_CALL_STATES = ['in_call', 'connecting', 'partner_found'];

// Per-actor async locks: stops two overlapping join/invite requests (double clicks, two tabs)
const locks = new Set();
const invites = new Map(); // inviteId -> invite
const inviteByKey = new Map(); // publicId -> inviteId

let rules = { initialLevelDiff: 1, relaxEverySec: 10, samePracticeLanguageSec: 20, avoidRecentPartnersSec: 40, recentPartnerMemory: 6 };
const refreshRules = () =>
  getSettings()
    .then((s) => {
      rules = s.matching;
    })
    .catch(() => {});

export const matchmaker = new Matchmaker({
  getRules: () => rules,
  isAlive: (e) => presence.isOnline(e.key),
  onMatch(a, b) {
    // Runs synchronously inside tick(): flip both to "partner found" before any await.
    presence.set(a.key, 'partner_found');
    presence.set(b.key, 'partner_found');
    callService.create(a, b, { kind: 'random' }).catch((err) => {
      logger.error('Failed to create call', err);
      for (const e of [a, b]) {
        presence.set(e.key, 'online');
        emitToSocket(e.socketId, 'queue:error', { code: 'MATCH_FAILED', message: 'Could not connect you. Please try again.' });
      }
    });
  },
});

export function startHub() {
  refreshRules();
  setInterval(refreshRules, 10_000).unref?.();
  matchmaker.start(1500);
  setInterval(broadcastStats, 5000).unref?.();
}

let broadcaster = null;
export const setBroadcaster = (fn) => {
  broadcaster = fn;
};
export function broadcastStats() {
  broadcaster?.(presence.counts());
}

const fail = (code, message) => ({ ok: false, code, message });

async function loadActorDoc(actor) {
  const Model = actor.kind === 'user' ? User : GuestSession;
  return Model.findById(actor.id);
}

function checkDoc(doc) {
  if (!doc) return fail('UNAUTHORIZED', 'Account not found');
  if (doc.status !== 'active') return fail('ACCOUNT_RESTRICTED', 'Your account is restricted.');
  if (!doc.onboardingCompleted) return fail('ONBOARDING_REQUIRED', 'Complete your profile before practising.');
  return null;
}

async function dailyLimitReached(doc, kind, settings) {
  const premium = isPremiumDoc(doc);
  const limitMin = kind === 'guest' ? settings.limits.guestDailyMinutes : premium ? settings.limits.premiumDailyMinutes : settings.limits.freeDailyMinutes;
  const used = effectiveStats(doc, doc.tzOffset).todaySeconds;
  return used >= limitMin * 60 ? limitMin : 0;
}

async function buildEntry(doc, actor, socketId, topicPref, settings) {
  const key = actor.key;
  const [blocks, recentRows] = await Promise.all([
    BlockedUser.find({ $or: [{ blockerPublicId: key }, { blockedPublicId: key }] })
      .select('blockerPublicId blockedPublicId')
      .lean(),
    PracticeHistory.find({ ownerPublicId: key })
      .sort({ startedAt: -1 })
      .limit(settings.matching.recentPartnerMemory)
      .select('partner.publicId startedAt')
      .lean(),
  ]);
  const blocked = new Set(blocks.map((b) => (b.blockerPublicId === key ? b.blockedPublicId : b.blockerPublicId)));
  const recent = new Map(recentRows.map((r) => [r.partner.publicId, r.startedAt?.getTime?.() || 0]));
  const premium = isPremiumDoc(doc);

  let pref = null;
  if (topicPref) {
    const t = await ConversationTopic.findOne({ slug: String(topicPref), active: true }).lean();
    if (t && (!t.premium || premium)) pref = t.slug;
  }

  return {
    key,
    kind: actor.kind,
    id: String(doc._id),
    tz: doc.tzOffset || 0,
    socketId,
    profile: publicProfile(doc, actor.kind),
    level: levelIndex(doc.englishLevel),
    practiceLanguage: doc.practiceLanguage,
    goals: doc.learningGoals || [],
    country: doc.country || '',
    premium,
    topicPref: pref,
    blocked,
    recent,
  };
}

export const hub = {
  async joinQueue(socket, payload = {}) {
    const actor = socket.data.actor;
    const key = actor.key;

    // ---- synchronous guards (atomic in Node) ----
    if (locks.has(key)) return fail('BUSY', 'Please wait a moment.');
    if (IN_CALL_STATES.includes(presence.get(key)) || callService.forActor(key)) {
      return fail('ALREADY_IN_CALL', 'You are already in a call.');
    }
    if (inviteByKey.has(key)) return fail('BUSY', 'You have a pending call invitation.');
    const existing = matchmaker.get(key);
    if (existing) {
      if (existing.socketId === socket.id) return { ok: true, searching: true, stats: presence.counts() };
      if (presence.socketIds(key).includes(existing.socketId)) return fail('ALREADY_ACTIVE', 'You are already searching in another tab.');
      matchmaker.leave(key); // stale entry from a dropped socket
    }

    locks.add(key);
    try {
      const settings = await getSettings();
      if (settings.maintenance.enabled) return fail('MAINTENANCE', settings.maintenance.message);
      if (actor.kind === 'guest' && !settings.guest.enabled) return fail('GUESTS_DISABLED', 'Guest access is turned off. Please sign in.');

      const doc = await loadActorDoc(actor);
      const bad = checkDoc(doc);
      if (bad) return bad;
      const limit = await dailyLimitReached(doc, actor.kind, settings);
      if (limit) return fail('DAILY_LIMIT', `You have reached today's free practice limit of ${limit} minutes. Come back tomorrow!`);

      // Re-check after awaits: state may have changed while we were loading.
      if (IN_CALL_STATES.includes(presence.get(key)) || callService.forActor(key) || matchmaker.has(key)) {
        return fail('ALREADY_ACTIVE', 'You are already active.');
      }
      if (!presence.isOnline(key)) return fail('OFFLINE', 'Connection lost.');

      const entry = await buildEntry(doc, actor, socket.id, payload.topicId, settings);
      presence.set(key, 'looking');
      matchmaker.join(entry);
      broadcastStats();
      return { ok: true, searching: true, stats: presence.counts() };
    } finally {
      locks.delete(key);
    }
  },

  leaveQueue(socket) {
    const key = socket.data.actor.key;
    const e = matchmaker.get(key);
    if (e && e.socketId === socket.id) {
      matchmaker.leave(key);
      if (presence.get(key) === 'looking') presence.set(key, 'online');
      broadcastStats();
    }
    return { ok: true };
  },

  /** Socket closed: remove from queue; calls get a short grace period. */
  socketClosed(socket) {
    const { key } = socket.data.actor;
    const e = matchmaker.get(key);
    if (e && e.socketId === socket.id) {
      matchmaker.leave(key);
      if (presence.get(key) === 'looking') presence.set(key, 'online');
    }
    callService.socketGone(key, socket.id);
    // pending invites involving this socket
    const inv = invites.get(inviteByKey.get(key));
    if (inv && (inv.fromSocketId === socket.id || (inv.toKey === key && presence.socketIds(key).length <= 1))) {
      this._endInvite(inv, inv.fromKey === key ? 'cancelled' : 'declined');
    }
  },

  // ------------------- direct calls (accepted connections only) -------------------
  async invite(socket, { toPublicId } = {}) {
    const actor = socket.data.actor;
    const from = actor.key;
    if (actor.kind !== 'user') return fail('GUEST_RESTRICTED', 'Create an account to call connections.');
    if (typeof toPublicId !== 'string' || toPublicId === from) return fail('BAD_REQUEST', 'Invalid partner.');
    if (locks.has(from)) return fail('BUSY', 'Please wait a moment.');
    if (presence.get(from) !== 'online' || matchmaker.has(from) || inviteByKey.has(from)) {
      return fail('ALREADY_ACTIVE', 'Finish your current call or search first.');
    }

    locks.add(from);
    try {
      const settings = await getSettings();
      if (settings.maintenance.enabled) return fail('MAINTENANCE', settings.maintenance.message);
      const me = await loadActorDoc(actor);
      const bad = checkDoc(me);
      if (bad) return bad;
      if (await dailyLimitReached(me, 'user', settings)) return fail('DAILY_LIMIT', 'You have reached today’s practice limit.');

      const target = await User.findOne({ publicId: toPublicId, status: 'active' });
      if (!target) return fail('UNAVAILABLE', 'This partner is not available.');
      const [conn, blocked] = await Promise.all([
        Connection.findOne({ pairKey: pairKeyOf(from, toPublicId), status: 'accepted' }).lean(),
        BlockedUser.exists({
          $or: [
            { blockerPublicId: from, blockedPublicId: toPublicId },
            { blockerPublicId: toPublicId, blockedPublicId: from },
          ],
        }),
      ]);
      if (blocked) return fail('UNAVAILABLE', 'This partner is not available.');
      if (!conn) return fail('NOT_CONNECTED', 'Send a practice request first and wait for them to accept.');

      if (!presence.isOnline(toPublicId)) {
        await notify(toPublicId, {
          type: 'practice_request',
          title: `${me.displayName} wants to practise with you`,
          body: 'Open SpeakMate and call them back when you are ready.',
          data: { from: publicProfile(me, 'user') },
        });
        return { ok: true, state: 'notified' };
      }
      if (presence.get(toPublicId) !== 'online' || inviteByKey.has(toPublicId) || matchmaker.has(toPublicId)) {
        return fail('BUSY', `${target.displayName} is busy right now.`);
      }
      if (!presence.isOnline(from) || presence.get(from) !== 'online') return fail('OFFLINE', 'Connection lost.');

      const inv = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        fromKey: from,
        fromSocketId: socket.id,
        toKey: toPublicId,
        fromProfile: publicProfile(me, 'user'),
        timer: null,
      };
      invites.set(inv.id, inv);
      inviteByKey.set(from, inv.id);
      inviteByKey.set(toPublicId, inv.id);
      presence.set(from, 'looking');
      presence.set(toPublicId, 'partner_found');
      inv.timer = setTimeout(() => this._endInvite(inv, 'timeout'), INVITE_TTL_MS);

      emitToActor(toPublicId, 'direct:incoming', { inviteId: inv.id, from: inv.fromProfile, expiresInSec: INVITE_TTL_MS / 1000 });
      return { ok: true, state: 'ringing', inviteId: inv.id };
    } finally {
      locks.delete(from);
    }
  },

  async acceptInvite(socket, { inviteId } = {}) {
    const key = socket.data.actor.key;
    const inv = invites.get(inviteId);
    if (!inv || inv.toKey !== key) return fail('INVITE_EXPIRED', 'This call is no longer available.');
    if (locks.has(inv.fromKey) || locks.has(key)) return fail('BUSY', 'Please wait a moment.');
    // Claim the invite synchronously: first tab to accept wins
    invites.delete(inv.id);
    inviteByKey.delete(inv.fromKey);
    inviteByKey.delete(inv.toKey);
    clearTimeout(inv.timer);
    locks.add(key);
    locks.add(inv.fromKey);
    try {
      const [callerDoc, calleeDoc] = await Promise.all([
        User.findOne({ publicId: inv.fromKey }),
        loadActorDoc(socket.data.actor),
      ]);
      if (!callerDoc || !calleeDoc || !presence.isOnline(inv.fromKey)) throw new Error('participant unavailable');
      const settings = await getSettings();
      const callerEntry = await buildEntry(callerDoc, { key: inv.fromKey, kind: 'user', id: callerDoc._id }, inv.fromSocketId, null, settings);
      const calleeEntry = await buildEntry(calleeDoc, socket.data.actor, socket.id, null, settings);
      presence.set(inv.fromKey, 'partner_found');
      presence.set(key, 'partner_found');
      await callService.create(callerEntry, calleeEntry, { kind: 'direct' });
      return { ok: true };
    } catch (err) {
      logger.error('acceptInvite failed', err);
      for (const k of [inv.fromKey, key]) presence.set(k, 'online');
      emitToSocket(inv.fromSocketId, 'direct:ended', { inviteId: inv.id, reason: 'failed' });
      return fail('FAILED', 'Could not start the call.');
    } finally {
      locks.delete(key);
      locks.delete(inv.fromKey);
    }
  },

  declineInvite(socket, { inviteId } = {}) {
    const inv = invites.get(inviteId);
    if (inv && inv.toKey === socket.data.actor.key) this._endInvite(inv, 'declined');
    return { ok: true };
  },

  cancelInvite(socket, { inviteId } = {}) {
    const inv = invites.get(inviteId);
    if (inv && inv.fromKey === socket.data.actor.key) this._endInvite(inv, 'cancelled');
    return { ok: true };
  },

  _endInvite(inv, reason) {
    if (!invites.delete(inv.id)) return;
    clearTimeout(inv.timer);
    inviteByKey.delete(inv.fromKey);
    inviteByKey.delete(inv.toKey);
    presence.set(inv.fromKey, 'online');
    presence.set(inv.toKey, 'online');
    emitToSocket(inv.fromSocketId, 'direct:ended', { inviteId: inv.id, reason });
    emitToActor(inv.toKey, 'direct:ended', { inviteId: inv.id, reason });
  },

  /** Admin / moderation: kick an actor off everything. */
  forceOffline(key, reason = 'restricted') {
    matchmaker.leave(key);
    const call = callService.forActor(key);
    if (call) callService.end(call.id, { reason, endedBy: null });
    const inv = invites.get(inviteByKey.get(key));
    if (inv) this._endInvite(inv, 'cancelled');
    emitToActor(key, 'account:restricted', { reason });
  },
};
