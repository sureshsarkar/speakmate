import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import GuestSession from '../models/GuestSession.js';
import { env } from '../config/env.js';
import { ApiError, badRequest, conflict, forbidden, unauthorized } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashIp, normalizeEmail, randomToken, sha256 } from '../utils/crypto.js';
import { signToken } from '../utils/tokens.js';
import { selfProfile } from '../utils/profile.js';
import { sendResetEmail, sendVerificationEmail } from '../utils/mailer.js';
import { getSettings } from '../services/settingsService.js';
import { clampTz } from '../utils/time.js';

const HOUR = 3600 * 1000;
// Compared against when the email is unknown so response time does not reveal accounts
const DUMMY_HASH = bcrypt.hashSync('speakmate-dummy-password', 10);

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/\d/, 'Password needs at least one number');

export const displayNameRule = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(40, 'Name must be at most 40 characters')
  .refine((v) => !/@/.test(v) && !/\d{6,}/.test(v.replace(/[\s\-().]/g, '')), 'Name cannot contain emails or phone numbers');

export const schemas = {
  register: z.object({
    name: displayNameRule,
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
    password: passwordRule,
  }),
  login: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required').max(200),
    remember: z.boolean().optional(),
  }),
  forgot: z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') }),
  reset: z.object({ token: z.string().min(20).max(200), password: passwordRule }),
  verify: z.object({ token: z.string().min(20).max(200) }),
  change: z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordRule }),
  google: z.object({ credential: z.string().min(20).max(4000), remember: z.boolean().optional() }),
};

const expiryFor = (remember) => (remember ? '30d' : '1d');

async function session(user, remember = true) {
  const s = await getSettings();
  return {
    token: signToken({ kind: 'user', id: user._id, tokenVersion: user.tokenVersion, expiresIn: expiryFor(remember) }),
    user: selfProfile(user, 'user', s.limits),
  };
}

async function issueVerification(user) {
  const token = randomToken(24);
  user.emailVerifyTokenHash = sha256(token);
  user.emailVerifyExpires = new Date(Date.now() + 24 * HOUR);
  await user.save();
  await sendVerificationEmail(user, token);
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const emailKey = normalizeEmail(email);
  if (await User.exists({ $or: [{ email }, { emailKey }] })) {
    throw conflict('An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');
  }

  const user = new User({
    email,
    emailKey,
    displayName: name,
    passwordHash: await bcrypt.hash(password, 12),
    signupIpHash: hashIp(req.ip),
    tzOffset: clampTz(req.headers['x-timezone-offset']),
  });

  // Upgrading a guest: keep the profile they already filled in
  if (req.actor?.kind === 'guest') {
    const g = req.actor.doc;
    Object.assign(user, {
      country: g.country,
      nativeLanguage: g.nativeLanguage,
      englishLevel: g.englishLevel,
      learningGoals: g.learningGoals,
      practiceLanguage: g.practiceLanguage,
      dailyGoalMinutes: g.dailyGoalMinutes,
      onboardingCompleted: g.onboardingCompleted,
    });
  }

  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');
    throw err;
  }
  issueVerification(user).catch(() => {});
  res.status(201).json({ success: true, ...(await session(user, true)) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) throw unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');
  if (user.status === 'blocked') throw forbidden('This account has been blocked.', 'ACCOUNT_BLOCKED');
  if (user.status === 'suspended' && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
    throw forbidden('This account is suspended.', 'ACCOUNT_SUSPENDED');
  }
  if (env.requireEmailVerification && !user.emailVerified) {
    throw forbidden('Please verify your email first. Check your inbox.', 'EMAIL_NOT_VERIFIED');
  }
  user.lastSeenAt = new Date();
  user.tzOffset = clampTz(req.headers['x-timezone-offset'] ?? user.tzOffset);
  await user.save();
  res.json({ success: true, ...(await session(user, Boolean(remember))) });
});

export const guest = asyncHandler(async (req, res) => {
  const s = await getSettings();
  if (!s.guest.enabled) throw forbidden('Guest access is currently turned off. Please create an account.', 'GUESTS_DISABLED');
  const ipHash = hashIp(req.ip);
  const doc = await GuestSession.create({
    guestId: randomToken(24),
    ipHash,
    displayName: `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
    tzOffset: clampTz(req.headers['x-timezone-offset']),
    expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
  });
  res.status(201).json({
    success: true,
    token: signToken({ kind: 'guest', id: doc._id, expiresIn: '24h' }),
    user: selfProfile(doc, 'guest', s.limits),
  });
});

export const google = asyncHandler(async (req, res) => {
  if (!env.googleClientId) throw new ApiError(501, 'Google sign-in is not configured', 'NOT_CONFIGURED');
  const client = new OAuth2Client(env.googleClientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: req.body.credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('Google sign-in failed', 'GOOGLE_FAILED');
  }
  if (!payload?.email || !payload.email_verified) throw unauthorized('Your Google email is not verified', 'GOOGLE_FAILED');

  const email = payload.email.toLowerCase();
  const emailKey = normalizeEmail(email);
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { emailKey }] });
  if (!user) {
    user = await User.create({
      email,
      emailKey,
      googleId: payload.sub,
      displayName: (payload.name || email.split('@')[0]).slice(0, 40),
      avatarUrl: payload.picture || null,
      emailVerified: true,
      signupIpHash: hashIp(req.ip),
      tzOffset: clampTz(req.headers['x-timezone-offset']),
    });
  } else {
    if (user.status === 'blocked') throw forbidden('This account has been blocked.', 'ACCOUNT_BLOCKED');
    if (user.status === 'suspended') throw forbidden('This account is suspended.', 'ACCOUNT_SUSPENDED');
    if (!user.googleId) user.googleId = payload.sub;
    user.emailVerified = true;
    user.lastSeenAt = new Date();
    await user.save();
  }
  res.json({ success: true, ...(await session(user, req.body.remember !== false)) });
});

export const me = asyncHandler(async (req, res) => {
  const s = await getSettings();
  res.json({ success: true, user: selfProfile(req.actor.doc, req.actor.kind, s.limits) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.status !== 'blocked') {
    const token = randomToken(24);
    user.resetTokenHash = sha256(token);
    user.resetExpires = new Date(Date.now() + HOUR);
    await user.save();
    await sendResetEmail(user, token);
  }
  // Same answer whether or not the email exists
  res.json({ success: true, message: 'If that email is registered, a reset link is on its way.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetExpires: { $gt: new Date() } }).select(
    '+resetTokenHash +resetExpires'
  );
  if (!user) throw badRequest('This reset link is invalid or has expired.', 'RESET_INVALID');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  user.tokenVersion += 1; // signs out every other session
  await user.save();
  res.json({ success: true, message: 'Password updated. You can sign in now.' });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ emailVerifyTokenHash: sha256(req.body.token), emailVerifyExpires: { $gt: new Date() } }).select(
    '+emailVerifyTokenHash +emailVerifyExpires'
  );
  if (!user) throw badRequest('This verification link is invalid or has expired.', 'VERIFY_INVALID');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  res.json({ success: true, message: 'Email verified. Thank you!' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const user = req.actor.doc;
  if (user.emailVerified) return res.json({ success: true, message: 'Your email is already verified.' });
  await issueVerification(user);
  res.json({ success: true, message: 'Verification email sent.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.actor.id).select('+passwordHash');
  if (!user.passwordHash) throw badRequest('This account signs in with Google and has no password.', 'NO_PASSWORD');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw unauthorized('Current password is incorrect', 'BAD_CREDENTIALS');
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.tokenVersion += 1;
  await user.save();
  const s = await getSettings();
  res.json({
    success: true,
    token: signToken({ kind: 'user', id: user._id, tokenVersion: user.tokenVersion, expiresIn: '30d' }),
    user: selfProfile(user, 'user', s.limits),
  });
});
