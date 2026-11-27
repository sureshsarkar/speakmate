import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import User from '../models/User.js';
import { GOALS, LEVELS, PRACTICE_LANGUAGES } from '../models/_shared.js';
import { ApiError, badRequest, unauthorized } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { selfProfile } from '../utils/profile.js';
import { cloudinaryEnabled, uploadAvatar } from '../config/cloudinary.js';
import { displayNameRule } from './authController.js';
import { getSettings } from '../services/settingsService.js';
import { hub } from '../services/matchHub.js';
import { deleteUserCascade } from '../services/accountService.js';

const text = (max) => z.string().trim().max(max);

export const schemas = {
  profile: z.object({
    displayName: displayNameRule.optional(),
    country: text(60).optional(),
    nativeLanguage: text(40).optional(),
    englishLevel: z.enum(LEVELS).optional(),
    learningGoals: z.array(z.enum(GOALS)).max(7).optional(),
    practiceLanguage: z.enum(PRACTICE_LANGUAGES).optional(),
    dailyGoalMinutes: z.number().int().min(5).max(240).optional(),
    completeOnboarding: z.boolean().optional(),
  }),
  settings: z.object({
    privacy: z.object({ showCountry: z.boolean().optional(), showOnlineStatus: z.boolean().optional() }).optional(),
    notifPrefs: z
      .object({
        push: z.boolean().optional(),
        dailyReminder: z.boolean().optional(),
        streakReminder: z.boolean().optional(),
        requests: z.boolean().optional(),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      })
      .optional(),
    dailyGoalMinutes: z.number().int().min(5).max(240).optional(),
  }),
  push: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
  pushRemove: z.object({ endpoint: z.string().url().max(1000) }),
  deleteAccount: z.object({ password: z.string().max(200).optional() }),
};

const respond = async (req, res) => {
  const s = await getSettings();
  res.json({ success: true, user: selfProfile(req.actor.doc, req.actor.kind, s.limits) });
};

export const updateProfile = asyncHandler(async (req, res) => {
  const doc = req.actor.doc;
  const { completeOnboarding, ...fields } = req.body;
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) doc[k] = v;

  if (completeOnboarding) {
    const missing = [];
    if (!doc.displayName) missing.push('name');
    if (!doc.country) missing.push('country');
    if (!doc.nativeLanguage) missing.push('native language');
    if (!doc.learningGoals?.length) missing.push('at least one learning goal');
    if (missing.length) throw badRequest(`Please fill in: ${missing.join(', ')}`, 'ONBOARDING_INCOMPLETE');
    doc.onboardingCompleted = true;
  }
  await doc.save();
  await respond(req, res);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const doc = req.actor.doc;
  const { privacy, notifPrefs, dailyGoalMinutes } = req.body;
  if (privacy) for (const [k, v] of Object.entries(privacy)) if (v !== undefined) doc.privacy[k] = v;
  if (dailyGoalMinutes) doc.dailyGoalMinutes = dailyGoalMinutes;
  if (notifPrefs) {
    if (req.actor.kind !== 'user') throw new ApiError(403, 'Create an account to manage notifications.', 'GUEST_RESTRICTED');
    for (const [k, v] of Object.entries(notifPrefs)) if (v !== undefined) doc.notifPrefs[k] = v;
  }
  await doc.save();
  await respond(req, res);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new ApiError(400, 'Only JPG, PNG or WebP images are allowed', 'BAD_FILE')),
});
export const avatarUpload = upload.single('avatar');

const sniff = (b) =>
  (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP');

export const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!cloudinaryEnabled) throw new ApiError(501, 'Profile pictures are not enabled on this server.', 'NOT_CONFIGURED');
  if (!req.file) throw badRequest('Choose an image to upload', 'NO_FILE');
  if (!sniff(req.file.buffer)) throw badRequest('That file is not a valid image', 'BAD_FILE');
  const result = await uploadAvatar(req.file.buffer, req.actor.publicId);
  req.actor.doc.avatarUrl = result.secure_url;
  await req.actor.doc.save();
  await respond(req, res);
});

export const removeAvatar = asyncHandler(async (req, res) => {
  req.actor.doc.avatarUrl = null;
  await req.actor.doc.save();
  await respond(req, res);
});

export const addPush = asyncHandler(async (req, res) => {
  const user = await User.findById(req.actor.id).select('+pushSubscriptions');
  const subs = user.pushSubscriptions.filter((s) => s.endpoint !== req.body.endpoint);
  subs.push(req.body);
  user.pushSubscriptions = subs.slice(-5);
  user.notifPrefs.push = true;
  await user.save();
  res.json({ success: true });
});

export const removePush = asyncHandler(async (req, res) => {
  const user = await User.findById(req.actor.id).select('+pushSubscriptions');
  user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.endpoint !== req.body.endpoint);
  if (!user.pushSubscriptions.length) user.notifPrefs.push = false;
  await user.save();
  res.json({ success: true });
});

/** Permanently deletes the account and personal data. Call metadata stays anonymised by publicId. */
export const deleteAccount = asyncHandler(async (req, res) => {
  const { actor } = req;
  if (actor.kind === 'guest') {
    await actor.doc.deleteOne();
    hub.forceOffline(actor.publicId, 'deleted');
    return res.json({ success: true });
  }
  const user = await User.findById(actor.id).select('+passwordHash');
  if (user.passwordHash) {
    const ok = req.body.password && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw unauthorized('Password is incorrect', 'BAD_CREDENTIALS');
  }
  await deleteUserCascade(user);
  res.json({ success: true });
});
