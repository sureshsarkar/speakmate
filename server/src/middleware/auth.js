import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import { ApiError, forbidden, unauthorized } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/tokens.js';
import { clampTz } from '../utils/time.js';

export function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Loads the user/guest behind a token and validates their standing. Throws ApiError. */
export async function resolveActor(token, tz) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  const Model = payload.kind === 'guest' ? GuestSession : payload.kind === 'user' ? User : null;
  if (!Model) throw unauthorized('Invalid session', 'TOKEN_INVALID');
  const doc = await Model.findById(payload.sub);
  if (!doc) throw unauthorized('Account not found. Please sign in again.', 'TOKEN_INVALID');
  if (payload.kind === 'user' && (doc.tokenVersion || 0) !== (payload.tv || 0)) {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  if (doc.status === 'blocked') throw forbidden('This account has been blocked.', 'ACCOUNT_BLOCKED');
  if (doc.status === 'suspended') {
    if (doc.suspendedUntil && doc.suspendedUntil < new Date()) {
      doc.status = 'active';
      doc.suspendedUntil = null;
      await doc.save();
    } else {
      throw forbidden('This account is suspended.', 'ACCOUNT_SUSPENDED');
    }
  }
  if (tz !== undefined && tz !== null && tz !== '') {
    const t = clampTz(tz);
    if (t !== doc.tzOffset) {
      doc.tzOffset = t;
      doc.save().catch(() => {});
    }
  }
  return { kind: payload.kind, doc, id: doc._id, publicId: doc.publicId };
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw unauthorized();
  req.actor = await resolveActor(token, req.headers['x-timezone-offset']);
  next();
});

/** Like authenticate but does not fail when there is no (valid) token. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (token) {
    try {
      req.actor = await resolveActor(token);
    } catch {
      req.actor = null;
    }
  }
  next();
});

export const requireUser = (req, _res, next) =>
  req.actor?.kind === 'user'
    ? next()
    : next(new ApiError(403, 'Create a free account to use this feature.', 'GUEST_RESTRICTED'));
