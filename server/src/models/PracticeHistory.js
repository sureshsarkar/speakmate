import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    ownerPublicId: { type: String, required: true },
    ownerKind: { type: String, enum: ['user', 'guest'], required: true },
    callKey: { type: String, required: true },
    partner: {
      publicId: String,
      displayName: String,
      avatarUrl: { type: String, default: null },
      englishLevel: String,
      country: { type: String, default: null },
      isGuest: { type: Boolean, default: false },
    },
    topic: { slug: String, title: String },
    kind: { type: String, enum: ['random', 'direct'], default: 'random' },
    durationSec: { type: Number, required: true },
    day: { type: String, required: true }, // YYYY-MM-DD in the owner's timezone
    startedAt: Date,
    endedAt: Date,
    endReason: String,
    feedback: {
      friendly: Boolean,
      comfortable: Boolean,
      connectAgain: Boolean,
      rating: { type: Number, min: 1, max: 5 },
      submittedAt: Date,
    },
  },
  { timestamps: true }
);

schema.index({ ownerPublicId: 1, startedAt: -1 });
schema.index({ ownerPublicId: 1, day: 1 });
schema.index({ ownerPublicId: 1, callKey: 1 }, { unique: true });
schema.index({ ownerPublicId: 1, 'partner.publicId': 1 });

export default mongoose.model('PracticeHistory', schema);
