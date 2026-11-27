import mongoose from 'mongoose';

export const REPORT_REASONS = [
  'abusive_language',
  'harassment',
  'inappropriate_content',
  'spam_or_ads',
  'impersonation',
  'underage',
  'other',
];

const schema = new mongoose.Schema(
  {
    reporterPublicId: { type: String, required: true },
    reporterKind: { type: String, enum: ['user', 'guest'], required: true },
    reportedPublicId: { type: String, required: true, index: true },
    reportedKind: { type: String, enum: ['user', 'guest'], required: true },
    reportedName: String,
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    callKey: String,
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 1000, default: '' },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open', index: true },
    adminNote: { type: String, default: '' },
    action: { type: String, default: '' },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    handledAt: Date,
  },
  { timestamps: true }
);

schema.index({ reporterPublicId: 1, reportedPublicId: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

export default mongoose.model('UserReport', schema);
