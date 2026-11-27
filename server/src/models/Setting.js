import mongoose from 'mongoose';

export const DEFAULT_SETTINGS = {
  appName: 'SpeakMate',
  tagline: "Don't Learn English Alone. Speak English With The World.",
  logoUrl: '',
  supportEmail: 'support@speakmate.app',
  theme: { primary: '#7ED957', secondary: '#1B5E20', background: '#FFFFFF', light: '#F5FAF2', text: '#17251A' },
  matching: {
    initialLevelDiff: 1, // allowed level gap at the start of a search
    relaxEverySec: 10, // allowed gap grows by 1 every N seconds waited
    samePracticeLanguageSec: 20, // require matching practice language for the first N seconds
    avoidRecentPartnersSec: 40, // avoid recent partners until the user has waited this long
    recentPartnerMemory: 6, // how many previous partners are remembered
  },
  limits: {
    freeDailyMinutes: 30,
    premiumDailyMinutes: 240,
    guestDailyMinutes: 15,
    maxCallMinutes: 30,
  },
  guest: { enabled: true },
  maintenance: { enabled: false, message: 'SpeakMate is getting a tune-up. Please check back soon.' },
};

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'app', unique: true },
    appName: { type: String, default: DEFAULT_SETTINGS.appName, maxlength: 40 },
    tagline: { type: String, default: DEFAULT_SETTINGS.tagline, maxlength: 120 },
    logoUrl: { type: String, default: '' },
    supportEmail: { type: String, default: DEFAULT_SETTINGS.supportEmail },
    theme: {
      primary: { type: String, default: DEFAULT_SETTINGS.theme.primary, match: /^#[0-9a-fA-F]{6}$/ },
      secondary: { type: String, default: DEFAULT_SETTINGS.theme.secondary, match: /^#[0-9a-fA-F]{6}$/ },
      background: { type: String, default: DEFAULT_SETTINGS.theme.background, match: /^#[0-9a-fA-F]{6}$/ },
      light: { type: String, default: DEFAULT_SETTINGS.theme.light, match: /^#[0-9a-fA-F]{6}$/ },
      text: { type: String, default: DEFAULT_SETTINGS.theme.text, match: /^#[0-9a-fA-F]{6}$/ },
    },
    matching: {
      initialLevelDiff: { type: Number, default: 1, min: 0, max: 4 },
      relaxEverySec: { type: Number, default: 10, min: 3, max: 120 },
      samePracticeLanguageSec: { type: Number, default: 20, min: 0, max: 300 },
      avoidRecentPartnersSec: { type: Number, default: 40, min: 0, max: 600 },
      recentPartnerMemory: { type: Number, default: 6, min: 0, max: 50 },
    },
    limits: {
      freeDailyMinutes: { type: Number, default: 30, min: 1, max: 1440 },
      premiumDailyMinutes: { type: Number, default: 240, min: 1, max: 1440 },
      guestDailyMinutes: { type: Number, default: 15, min: 1, max: 1440 },
      maxCallMinutes: { type: Number, default: 30, min: 1, max: 240 },
    },
    guest: { enabled: { type: Boolean, default: true } },
    maintenance: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: DEFAULT_SETTINGS.maintenance.message, maxlength: 200 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', schema);
