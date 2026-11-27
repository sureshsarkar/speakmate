import CallSession from '../models/CallSession.js';
import ConversationTopic from '../models/ConversationTopic.js';
import { callKey as newCallKey } from '../utils/crypto.js';
import { getIceServers } from '../config/ice.js';
import { logger } from '../config/logger.js';
import { presence } from './presence.js';
import { emitToSocket } from './realtime.js';
import { getSettings } from './settingsService.js';
import { recordCall } from './practiceService.js';

const CONNECT_TIMEOUT_MS = 40_000;
const REJOIN_GRACE_MS = 15_000;
const ENDED_MEMORY_MS = 2 * 60_000;

const calls = new Map(); // callKey -> call
const byActor = new Map(); // publicId -> callKey
const lastEnded = new Map(); // publicId -> { payload, at }

let topicCache = { at: 0, list: [] };
async function topics() {
  if (Date.now() - topicCache.at > 30_000) {
    topicCache = { at: Date.now(), list: await ConversationTopic.find({ active: true }).lean() };
  }
  return topicCache.list;
}
export const invalidateTopicCache = () => {
  topicCache.at = 0;
};

async function pickTopic(a, b) {
  const list = await topics();
  const bothPremium = a.premium && b.premium;
  const allowed = (t) => !t.premium || bothPremium;
  const preferred = [a.topicPref, b.topicPref]
    .map((slug) => list.find((t) => t.slug === slug))
    .find((t) => t && allowed(t));
  const pool = list.filter(allowed);
  const t = preferred || pool[Math.floor(Math.random() * pool.length)];
  return t ? { slug: t.slug, title: t.title } : { slug: 'self-introduction', title: 'Self Introduction' };
}

const otherSide = (call, key) => Object.values(call.sides).find((s) => s.key !== key);
const elapsedSec = (call) => (call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : 0);

function endedPayload(call, side, durationSec) {
  const other = otherSide(call, side.key);
  return {
    callId: call.id,
    callKey: call.id,
    reason: call.endReason,
    endedByMe: call.endedBy === side.key,
    connected: Boolean(call.connectedAt),
    durationSec,
    practiceMinutes: Math.round((durationSec / 60) * 10) / 10,
    topic: call.topic,
    partner: other.profile,
    kind: call.kind,
  };
}

export const callService = {
  get: (id) => calls.get(id),
  forActor: (key) => calls.get(byActor.get(key)),
  count: () => calls.size,

  /** Metadata only, safe for the admin panel. */
  activeList() {
    return [...calls.values()].map((c) => ({
      callKey: c.id,
      kind: c.kind,
      status: c.status,
      quality: c.quality,
      createdAt: new Date(c.createdAt),
      durationSec: elapsedSec(c),
      maxDurationSec: c.maxSec,
      participants: Object.values(c.sides).map((s) => ({
        publicId: s.key,
        displayName: s.profile.displayName,
        kind: s.kind,
        level: s.profile.englishLevel,
        connected: s.connected,
        socketAttached: Boolean(s.socketId),
      })),
    }));
  },

  async create(a, b, { kind = 'random' } = {}) {
    const id = newCallKey();
    const [topic, settings] = await Promise.all([pickTopic(a, b), getSettings()]);
    const maxSec = settings.limits.maxCallMinutes * 60;

    const mkSide = (e) => ({
      key: e.key,
      kind: e.kind,
      id: e.id,
      tz: e.tz || 0,
      socketId: e.socketId,
      profile: e.profile,
      connected: false,
      grace: null,
    });
    const call = {
      id,
      kind,
      status: 'connecting',
      createdAt: Date.now(),
      connectedAt: null,
      initiator: a.key,
      topic,
      maxSec,
      quality: null,
      ended: false,
      sides: { [a.key]: mkSide(a), [b.key]: mkSide(b) },
      timers: {},
    };

    // Register in memory first so duplicate matching/inviting is impossible while we hit the DB.
    calls.set(id, call);
    byActor.set(a.key, id);
    byActor.set(b.key, id);
    presence.set(a.key, 'partner_found');
    presence.set(b.key, 'partner_found');

    try {
      await CallSession.create({
        callKey: id,
        kind,
        participants: [a, b].map((e) => ({ publicId: e.key, kind: e.kind, displayName: e.profile.displayName })),
        initiator: a.key,
        topic,
        status: 'connecting',
      });
    } catch (err) {
      this._cleanup(call);
      throw err;
    }

    for (const side of Object.values(call.sides)) {
      const other = otherSide(call, side.key);
      emitToSocket(side.socketId, 'match:found', {
        callId: id,
        kind,
        initiator: side.key === a.key,
        partner: other.profile,
        topic,
        iceServers: getIceServers(side.key),
        maxDurationSec: maxSec,
        connectTimeoutSec: CONNECT_TIMEOUT_MS / 1000,
      });
    }

    call.timers.connect = setTimeout(() => this.end(id, { reason: 'connect_failed' }), CONNECT_TIMEOUT_MS);
    logger.debug(`call ${id.slice(0, 6)} created (${kind})`);
    return call;
  },

  /** Relays WebRTC signalling between the two participants only. */
  relay(socket, event, payload) {
    const call = calls.get(payload?.callId);
    const me = call && !call.ended ? call.sides[socket.data.actor.key] : null;
    if (!me || me.socketId !== socket.id) return false;
    const other = otherSide(call, me.key);

    const msg = { callId: call.id };
    if (event === 'rtc:offer' || event === 'rtc:answer') {
      if (event === 'rtc:offer' && me.key !== call.initiator) return false;
      const sdp = payload.sdp;
      if (!sdp || typeof sdp.sdp !== 'string' || sdp.sdp.length > 30_000 || !['offer', 'answer'].includes(sdp.type)) return false;
      // Audio-only enforcement: refuse any SDP that negotiates a video m-line
      if (/^m=video/m.test(sdp.sdp)) return false;
      msg.sdp = { type: sdp.type, sdp: sdp.sdp };
      if (call.status === 'connecting') {
        presence.set(me.key, 'connecting');
        presence.set(other.key, 'connecting');
      }
    } else if (event === 'rtc:ice') {
      const c = payload.candidate;
      if (c !== null && (!c || typeof c.candidate !== 'string' || c.candidate.length > 2000)) return false;
      msg.candidate = c;
    } else if (event !== 'rtc:restart-request') {
      return false;
    }
    emitToSocket(other.socketId, event, msg);
    return true;
  },

  markConnected(callId, key) {
    const call = calls.get(callId);
    const side = call && !call.ended ? call.sides[key] : null;
    if (!side) return null;
    side.connected = true;

    if (call.status === 'connecting') {
      call.status = 'in_call';
      call.connectedAt = Date.now();
      clearTimeout(call.timers.connect);
      call.timers.max = setTimeout(() => this.end(call.id, { reason: 'max_duration' }), call.maxSec * 1000);
      for (const s of Object.values(call.sides)) presence.set(s.key, 'in_call');
      CallSession.updateOne(
        { callKey: call.id },
        { status: 'in_call', connectedAt: new Date(call.connectedAt), connectMs: call.connectedAt - call.createdAt }
      ).catch((e) => logger.error('call update failed', e));
      for (const s of Object.values(call.sides)) {
        emitToSocket(s.socketId, 'call:started', { callId: call.id, elapsedSec: 0, maxDurationSec: call.maxSec });
      }
    } else {
      emitToSocket(side.socketId, 'call:started', {
        callId: call.id,
        elapsedSec: elapsedSec(call),
        maxDurationSec: call.maxSec,
      });
    }
    return call;
  },

  setQuality(callId, key, quality) {
    const call = calls.get(callId);
    if (!call || !call.sides[key] || !['good', 'fair', 'poor'].includes(quality)) return;
    const rank = { good: 0, fair: 1, poor: 2 };
    if (!call.quality || rank[quality] > rank[call.quality]) {
      call.quality = quality;
      CallSession.updateOne({ callKey: call.id }, { quality }).catch(() => {});
    }
  },

  /** The socket of a participant dropped. Keep the call alive briefly so they can reconnect. */
  socketGone(key, socketId) {
    const call = this.forActor(key);
    const side = call?.sides[key];
    if (!side || side.socketId !== socketId) return;
    side.socketId = null;
    const other = otherSide(call, key);
    emitToSocket(other.socketId, 'partner:status', { callId: call.id, state: 'reconnecting' });
    clearTimeout(side.grace);
    side.grace = setTimeout(() => this.end(call.id, { reason: 'partner_disconnected', endedBy: key }), REJOIN_GRACE_MS);
  },

  rejoin(socket, callId) {
    const key = socket.data.actor.key;
    const call = calls.get(callId);
    const side = call && !call.ended ? call.sides[key] : null;
    if (!side) {
      const ended = lastEnded.get(key);
      if (ended && ended.payload.callId === callId && Date.now() - ended.at < ENDED_MEMORY_MS) {
        return { ok: false, code: 'CALL_ENDED', ended: ended.payload };
      }
      return { ok: false, code: 'CALL_NOT_FOUND' };
    }
    clearTimeout(side.grace);
    side.socketId = socket.id;
    emitToSocket(otherSide(call, key).socketId, 'partner:status', { callId, state: 'connected' });
    return { ok: true, status: call.status, elapsedSec: elapsedSec(call), maxDurationSec: call.maxSec, initiator: key === call.initiator };
  },

  _cleanup(call) {
    call.ended = true;
    clearTimeout(call.timers.connect);
    clearTimeout(call.timers.max);
    for (const s of Object.values(call.sides)) {
      clearTimeout(s.grace);
      if (byActor.get(s.key) === call.id) byActor.delete(s.key);
      presence.set(s.key, 'online');
    }
    calls.delete(call.id);
  },

  /** Ends a call, notifies both sides, persists metadata. Idempotent. */
  end(callId, { reason = 'ended', endedBy = null } = {}) {
    const call = calls.get(callId);
    if (!call || call.ended) return null;
    call.endReason = reason;
    call.endedBy = endedBy;
    const durationSec = call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : 0;
    this._cleanup(call);

    for (const side of Object.values(call.sides)) {
      const payload = endedPayload(call, side, durationSec);
      lastEnded.set(side.key, { payload, at: Date.now() });
      emitToSocket(side.socketId, 'call:ended', payload);
    }
    setTimeout(() => {
      for (const s of Object.values(call.sides)) {
        const e = lastEnded.get(s.key);
        if (e && e.payload.callId === call.id) lastEnded.delete(s.key);
      }
    }, ENDED_MEMORY_MS).unref?.();

    const status = call.connectedAt ? 'completed' : reason === 'cancelled' ? 'cancelled' : 'failed';
    CallSession.updateOne(
      { callKey: call.id },
      { status, endReason: reason, endedBy, endedAt: new Date(), durationSec, quality: call.quality }
    ).catch((e) => logger.error('call finalize failed', e));
    recordCall(call, durationSec).catch((e) => logger.error('recordCall failed', e));
    logger.debug(`call ${call.id.slice(0, 6)} ended: ${reason} (${durationSec}s)`);
    return { durationSec };
  },

  endAll(reason = 'server_shutdown') {
    for (const id of [...calls.keys()]) this.end(id, { reason });
  },
};
