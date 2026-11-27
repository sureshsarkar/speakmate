import mongoose from 'mongoose';
import { profileFields } from './_shared.js';

const pushSub = new mongoose.Schema(
  { endpoint: { type: String, required: true }, keys: { p256dh: String, auth: String } },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    // Normalised key (gmail dots / +tags stripped) to block duplicate-account abuse
    emailKey: { type: String, required: true, unique: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 },

    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active', index: true },
    statusReason: { type: String, default: '' },
    suspendedUntil: { type: Date, default: null },

    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    planExpiresAt: { type: Date, default: null },

    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    notifPrefs: {
      push: { type: Boolean, default: false },
      dailyReminder: { type: Boolean, default: true },
      streakReminder: { type: Boolean, default: true },
      requests: { type: Boolean, default: true },
      reminderTime: { type: String, default: '19:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
    pushSubscriptions: { type: [pushSub], default: [], select: false },
    lastReminderDay: { type: String, default: '' },
    lastStreakReminderDay: { type: String, default: '' },

    signupIpHash: { type: String, select: false },
    lastSeenAt: Date,
    ...profileFields(),
  },
  { timestamps: true }
);

schema.index({ displayName: 'text', email: 'text' });
schema.index({ createdAt: -1 });
schema.index({ 'notifPrefs.dailyReminder': 1, 'notifPrefs.streakReminder': 1 });

schema.methods.isPremium = function isPremium() {
  return this.plan === 'premium' && (!this.planExpiresAt || this.planExpiresAt > new Date());
};

export default mongoose.model('User', schema);
