import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { resolveActor } from '../middleware/auth.js';
import { socketAllow } from '../middleware/rateLimit.js';
import { presence } from '../services/presence.js';
import { callService } from '../services/callService.js';
import { hub, broadcastStats, setBroadcaster, startHub } from '../services/matchHub.js';
import { setIo } from '../services/realtime.js';

async function attachRedis(io) {
  const { createClient } = await import('redis');
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const pub = createClient({ url: env.redisUrl });
  const sub = pub.duplicate();
  pub.on('error', (e) => logger.error('redis pub error', e));
  sub.on('error', (e) => logger.error('redis sub error', e));
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
  logger.info('Socket.IO Redis adapter enabled');
}

const RTC = { max: 400, windowMs: 10_000 };
const CONTROL = { max: 20, windowMs: 10_000 };

export async function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 100_000, // signalling only, never media
  });
  if (env.redisUrl) await attachRedis(io);

  setIo(io);
  setBroadcaster((counts) => io.emit('presence:stats', counts));
  startHub();

  // ---- Secure socket authentication (JWT in handshake) ----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const actor = await resolveActor(token, socket.handshake.auth?.tz);
      socket.data.actor = { key: actor.publicId, kind: actor.kind, id: String(actor.id) };
      next();
    } catch (err) {
      next(new Error(err.code || 'UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { key, kind } = socket.data.actor;
    presence.add(key, kind, socket.id);
    socket.join(`actor:${key}`);
    socket.emit('presence:stats', presence.counts());
    broadcastStats();

    /** Registers an ack-style handler with rate limiting and error isolation. */
    const on = (event, limit, handler) =>
      socket.on(event, async (payload, ack) => {
        const done = typeof ack === 'function' ? ack : () => {};
        if (!socketAllow(socket, event, limit.max, limit.windowMs)) {
          return done({ ok: false, code: 'RATE_LIMIT', message: 'You are doing that too quickly.' });
        }
        try {
          const body = payload && typeof payload === 'object' ? payload : {};
          const res = await handler(body);
          done(res ?? { ok: true });
        } catch (err) {
          logger.error(`socket ${event} failed`, err);
          done({ ok: false, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
        }
      });

    // ---- Matchmaking ----
    on('queue:join', { max: 15, windowMs: 60_000 }, (p) => hub.joinQueue(socket, p));
    on('queue:leave', CONTROL, () => hub.leaveQueue(socket));

    // ---- WebRTC signalling (relayed to the call partner only) ----
    for (const ev of ['rtc:offer', 'rtc:answer', 'rtc:ice', 'rtc:restart-request']) {
      on(ev, RTC, (p) => ({ ok: callService.relay(socket, ev, p) }));
    }

    // ---- Call lifecycle ----
    on('call:connected', CONTROL, (p) => ({ ok: Boolean(callService.markConnected(String(p.callId), key)) }));
    on('call:quality', { max: 60, windowMs: 60_000 }, (p) => {
      callService.setQuality(String(p.callId), key, p.quality);
    });
    on('call:rejoin', CONTROL, (p) => callService.rejoin(socket, String(p.callId)));
    on('call:end', CONTROL, (p) => {
      const call = callService.get(String(p.callId));
      if (!call || !call.sides[key]) return { ok: false };
      callService.end(call.id, { reason: 'ended', endedBy: key });
      return { ok: true };
    });
    on('call:next', { max: 15, windowMs: 60_000 }, async (p) => {
      const call = callService.get(String(p.callId));
      if (call?.sides[key]) callService.end(call.id, { reason: 'skipped', endedBy: key });
      return hub.joinQueue(socket, p);
    });

    // ---- Direct calls between accepted connections ----
    on('direct:invite', { max: 10, windowMs: 60_000 }, (p) => hub.invite(socket, p));
    on('direct:accept', CONTROL, (p) => hub.acceptInvite(socket, p));
    on('direct:decline', CONTROL, (p) => hub.declineInvite(socket, p));
    on('direct:cancel', CONTROL, (p) => hub.cancelInvite(socket, p));

    socket.on('disconnect', () => {
      hub.socketClosed(socket);
      const gone = presence.remove(key, socket.id);
      if (gone && !callService.forActor(key)) presence.forget(key);
      broadcastStats();
    });
  });

  return io;
}
