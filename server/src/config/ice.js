import crypto from 'node:crypto';
import { env } from './env.js';

/**
 * Returns RTCPeerConnection iceServers for a participant.
 * - STUN always.
 * - TURN when TURN_URLS is set: ephemeral coturn credentials (TURN_SECRET)
 *   or static credentials (TURN_USERNAME / TURN_PASSWORD).
 */
export function getIceServers(actorKey = 'anon') {
  const servers = [{ urls: env.stunUrls }];
  const { urls, secret, ttl, username, password } = env.turn;
  if (urls.length) {
    if (secret) {
      const expiry = Math.floor(Date.now() / 1000) + ttl;
      const user = `${expiry}:${actorKey}`;
      const credential = crypto.createHmac('sha1', secret).update(user).digest('base64');
      servers.push({ urls, username: user, credential });
    } else if (username && password) {
      servers.push({ urls, username, credential: password });
    }
  }
  return servers;
}

export const turnConfigured = () =>
  env.turn.urls.length > 0 && Boolean(env.turn.secret || (env.turn.username && env.turn.password));
