import Admin from '../models/Admin.js';
import { forbidden, unauthorized } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAdminToken } from '../utils/tokens.js';
import { can } from '../config/permissions.js';
import { bearer } from './auth.js';

export const adminAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw unauthorized('Admin sign-in required', 'ADMIN_UNAUTHORIZED');
  let payload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw unauthorized('Admin session expired', 'ADMIN_UNAUTHORIZED');
  }
  const admin = await Admin.findById(payload.sub);
  if (!admin || !admin.active || (admin.tokenVersion || 0) !== (payload.tv || 0)) {
    throw unauthorized('Admin session expired', 'ADMIN_UNAUTHORIZED');
  }
  req.admin = admin;
  next();
});

export const requirePermission = (perm) => (req, _res, next) =>
  can(req.admin.role, perm) ? next() : next(forbidden(`Your role (${req.admin.role}) cannot do this.`, 'ADMIN_FORBIDDEN'));
