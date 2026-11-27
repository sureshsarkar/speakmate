import * as webpush from 'web-push';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { emitToActor } from './realtime.js';

export const pushEnabled = Boolean(env.vapid.publicKey && env.vapid.privateKey);
if (pushEnabled) webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);

const PREF_FOR_TYPE = {
  daily_reminder: 'dailyReminder',
  streak_reminder: 'streakReminder',
  practice_request: 'requests',
  friend_request: 'requests',
  request_accepted: 'requests',
};

/**
 * Creates an in-app notification for a registered user, pushes it live over the socket
 * and (if enabled/subscribed) as a Web Push. Returns the stored notification or null.
 */
export async function notify(publicId, { type, title, body = '', data = {} }) {
  const user = await User.findOne({ publicId }).select('+pushSubscriptions notifPrefs');
  if (!user) return null;
  const pref = PREF_FOR_TYPE[type];
  if (pref && user.notifPrefs?.[pref] === false) return null;

  const doc = await Notification.create({ recipientPublicId: publicId, type, title, body, data });
  const payload = serialize(doc);
  emitToActor(publicId, 'notification:new', payload);

  if (pushEnabled && user.notifPrefs?.push && user.pushSubscriptions?.length) {
    const message = JSON.stringify({ title, body, tag: type, url: urlFor(type), data });
    const dead = [];
    await Promise.all(
      user.pushSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, message, { TTL: 3600 });
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
          else logger.warn('Web push failed', { status: err.statusCode });
        }
      })
    );
    if (dead.length) await User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: { $in: dead } } } });
  }
  return payload;
}

const urlFor = (type) =>
  type === 'practice_request' || type === 'friend_request' || type === 'request_accepted' ? '/favorites' : type === 'goal_completed' ? '/history' : '/home';

export const serialize = (n) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data || {},
  read: Boolean(n.readAt),
  createdAt: n.createdAt,
});
