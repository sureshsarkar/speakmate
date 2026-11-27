import rateLimit from 'express-rate-limit';

// The automated test-suite creates many accounts from one IP, so limits are relaxed under NODE_ENV=test only.
const RELAX = process.env.NODE_ENV === 'test' ? 1000 : 1;

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: limit * RELAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ success: false, code: 'RATE_LIMITED', message: message || 'Too many requests. Please slow down.' }),
  });

export const apiLimiter = make(15 * 60 * 1000, 600);
export const authLimiter = make(15 * 60 * 1000, 30, 'Too many attempts. Please try again in a few minutes.');
export const registerLimiter = make(60 * 60 * 1000, 8, 'Too many accounts created from this network. Try again later.');
export const guestLimiter = make(60 * 60 * 1000, 20, 'Too many guest sessions from this network. Try again later.');
export const reportLimiter = make(60 * 60 * 1000, 15, 'You are sending reports too quickly.');
export const adminLoginLimiter = make(15 * 60 * 1000, 10, 'Too many admin login attempts.');

// ---- Socket event limiter (sliding window per socket + event) ----
export function socketAllow(socket, event, max, windowMs) {
  const now = Date.now();
  socket.data.rl ||= new Map();
  const arr = (socket.data.rl.get(event) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    socket.data.rl.set(event, arr);
    return false;
  }
  arr.push(now);
  socket.data.rl.set(event, arr);
  return true;
}
