import crypto from 'node:crypto';

export const LEVELS = ['beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced'];
export const GOALS = [
  'fluency',
  'daily_conversation',
  'pronunciation',
  'interviews',
  'confidence',
  'business',
  'travel',
];
export const PRACTICE_LANGUAGES = ['English', 'American English', 'British English', 'Indian English', 'Australian English'];

export const newPublicId = () => crypto.randomBytes(9).toString('base64url');

/** Profile + stats fields shared by User and GuestSession (function => fresh objects per schema). */
export const profileFields = () => ({
  publicId: { type: String, unique: true, index: true, default: newPublicId },
  displayName: { type: String, trim: true, minlength: 2, maxlength: 40 },
  avatarUrl: { type: String, default: null },
  country: { type: String, trim: true, maxlength: 60, default: '' },
  nativeLanguage: { type: String, trim: true, maxlength: 40, default: '' },
  englishLevel: { type: String, enum: LEVELS, default: 'beginner' },
  learningGoals: { type: [{ type: String, enum: GOALS }], default: [] },
  practiceLanguage: { type: String, enum: PRACTICE_LANGUAGES, default: 'English' },
  onboardingCompleted: { type: Boolean, default: false },
  dailyGoalMinutes: { type: Number, default: 15, min: 5, max: 240 },
  tzOffset: { type: Number, default: 0 },
  privacy: {
    showCountry: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
  },
  stats: {
    totalSeconds: { type: Number, default: 0 },
    totalCalls: { type: Number, default: 0 },
    todayKey: { type: String, default: '' },
    todaySeconds: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastStreakDay: { type: String, default: '' },
    goalNotifiedDay: { type: String, default: '' },
  },
});
