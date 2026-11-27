export const LEVELS = [
  { value: 'beginner', label: 'Beginner', short: 'A1', desc: 'I know a few words and simple phrases.' },
  { value: 'elementary', label: 'Elementary', short: 'A2', desc: 'I can talk about familiar things slowly.' },
  { value: 'intermediate', label: 'Intermediate', short: 'B1', desc: 'I can hold a basic conversation.' },
  { value: 'upper_intermediate', label: 'Upper Intermediate', short: 'B2', desc: 'I speak fairly fluently on many topics.' },
  { value: 'advanced', label: 'Advanced', short: 'C1', desc: 'I speak confidently and naturally.' },
];
export const levelLabel = (v) => LEVELS.find((l) => l.value === v)?.label || 'Beginner';
export const levelShort = (v) => LEVELS.find((l) => l.value === v)?.short || 'A1';

export const GOALS = [
  { value: 'fluency', label: 'Improve English Fluency', emoji: '🌊' },
  { value: 'daily_conversation', label: 'Daily English Conversation', emoji: '💬' },
  { value: 'pronunciation', label: 'Improve Pronunciation', emoji: '🗣️' },
  { value: 'interviews', label: 'Prepare for Interviews', emoji: '🎤' },
  { value: 'confidence', label: 'Improve Confidence', emoji: '💪' },
  { value: 'business', label: 'Business English', emoji: '💼' },
  { value: 'travel', label: 'English for Travel', emoji: '✈️' },
];

export const PRACTICE_LANGUAGES = ['English', 'American English', 'British English', 'Indian English', 'Australian English'];

export const REPORT_REASONS = [
  { value: 'abusive_language', label: 'Abusive or offensive language' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate_content', label: 'Inappropriate or sexual content' },
  { value: 'spam_or_ads', label: 'Spam or advertising' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'underage', label: 'Seems under 13' },
  { value: 'other', label: 'Something else' },
];

export const COUNTRIES = [
  'Afghanistan', 'Algeria', 'Argentina', 'Australia', 'Bangladesh', 'Belgium', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China',
  'Colombia', 'Czech Republic', 'Denmark', 'Egypt', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Hungary',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Malaysia',
  'Mexico', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka',
  'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand', 'Turkey', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Zimbabwe', 'Other',
];

export const LANGUAGES = [
  'Arabic', 'Bengali', 'Burmese', 'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Czech', 'Dutch', 'English', 'Farsi (Persian)',
  'Filipino (Tagalog)', 'French', 'German', 'Greek', 'Gujarati', 'Hausa', 'Hebrew', 'Hindi', 'Hungarian', 'Indonesian', 'Italian',
  'Japanese', 'Kannada', 'Korean', 'Malay', 'Malayalam', 'Marathi', 'Nepali', 'Pashto', 'Polish', 'Portuguese', 'Punjabi',
  'Romanian', 'Russian', 'Sinhala', 'Spanish', 'Swahili', 'Tamil', 'Telugu', 'Thai', 'Turkish', 'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese', 'Yoruba', 'Other',
];

/** Where a call-flow screen should send the user when the call phase no longer matches it. */
export const pathForPhase = (phase) => CALL_PATHS[phase] || '/practice';

export const CALL_PATHS = {
  requesting_mic: '/practice/searching',
  searching: '/practice/searching',
  inviting: '/practice/searching',
  found: '/practice/found',
  connecting: '/practice/call',
  in_call: '/practice/call',
  ended: '/practice/ended',
};
