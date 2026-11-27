import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'partner_found',
  'practice_request',
  'friend_request',
  'request_accepted',
  'daily_reminder',
  'goal_completed',
  'streak_reminder',
  'system',
];

const schema = new mongoose.Schema(
  {
    recipientPublicId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ recipientPublicId: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // keep 60 days

export default mongoose.model('Notification', schema);
