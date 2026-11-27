import { LEVELS } from '../models/_shared.js';
import { dayKey, shiftDay } from './time.js';

export const levelIndex = (level) => Math.max(0, LEVELS.indexOf(level));

/** What other users may see. No email, phone, internal ids or tokens. */
export function publicProfile(doc, kind) {
  return {
    publicId: doc.publicId,
    displayName: doc.displayName || 'English Learner',
    avatarUrl: doc.avatarUrl || null,
    englishLevel: doc.englishLevel,
    country: doc.privacy?.showCountry === false ? null : doc.country || null,
    isGuest: kind === 'guest',
  };
}

export function effectiveStats(doc, tz = doc.tzOffset || 0) {
  const s = doc.stats || {};
  const today = dayKey(new Date(), tz);
  const yesterday = shiftDay(today, -1);
  const streakAlive = s.lastStreakDay === today || s.lastStreakDay === yesterday;
  return {
    totalSeconds: s.totalSeconds || 0,
    totalMinutes: Math.round(((s.totalSeconds || 0) / 60) * 10) / 10,
    totalCalls: s.totalCalls || 0,
    todaySeconds: s.todayKey === today ? s.todaySeconds || 0 : 0,
    streak: streakAlive ? s.streak || 0 : 0,
    longestStreak: s.longestStreak || 0,
    practicedToday: s.lastStreakDay === today,
  };
}

export const isPremiumDoc = (doc) =>
  typeof doc.isPremium === 'function' ? doc.isPremium() : false;

/** The signed-in user's own profile (never includes password hash or tokens). */
export function selfProfile(doc, kind, limits) {
  const premium = isPremiumDoc(doc);
  const stats = effectiveStats(doc);
  let dailyLimitMinutes = null;
  if (limits) {
    dailyLimitMinutes = kind === 'guest' ? limits.guestDailyMinutes : premium ? limits.premiumDailyMinutes : limits.freeDailyMinutes;
  }
  return {
    publicId: doc.publicId,
    kind,
    email: kind === 'user' ? doc.email : null,
    emailVerified: kind === 'user' ? Boolean(doc.emailVerified) : false,
    hasPassword: kind === 'user' ? Boolean(doc.passwordHash) : false,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl || null,
    country: doc.country || '',
    nativeLanguage: doc.nativeLanguage || '',
    englishLevel: doc.englishLevel,
    learningGoals: doc.learningGoals || [],
    practiceLanguage: doc.practiceLanguage,
    onboardingCompleted: Boolean(doc.onboardingCompleted),
    dailyGoalMinutes: doc.dailyGoalMinutes,
    privacy: { showCountry: doc.privacy?.showCountry !== false, showOnlineStatus: doc.privacy?.showOnlineStatus !== false },
    notifPrefs: kind === 'user' ? { ...(doc.notifPrefs?.toObject?.() ?? doc.notifPrefs ?? {}) } : null,
    plan: premium ? 'premium' : 'free',
    planExpiresAt: premium ? doc.planExpiresAt || null : null,
    dailyLimitMinutes,
    rating: kind === 'user' && doc.ratingCount ? Math.round((doc.ratingSum / doc.ratingCount) * 10) / 10 : null,
    stats,
    createdAt: doc.createdAt,
  };
}
