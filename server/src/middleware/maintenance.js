import { ApiError } from '../utils/ApiError.js';
import { getSettings } from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ALLOWED_PREFIXES = ['/api/admin', '/api/config', '/api/health'];

export const maintenanceGate = asyncHandler(async (req, _res, next) => {
  if (ALLOWED_PREFIXES.some((p) => req.originalUrl.startsWith(p))) return next();
  const s = await getSettings();
  if (s.maintenance.enabled) throw new ApiError(503, s.maintenance.message, 'MAINTENANCE');
  next();
});
