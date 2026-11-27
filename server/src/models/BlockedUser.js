import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    blockerPublicId: { type: String, required: true },
    blockedPublicId: { type: String, required: true },
    blockedName: String,
    blockedAvatarUrl: { type: String, default: null },
  },
  { timestamps: true }
);

schema.index({ blockerPublicId: 1, blockedPublicId: 1 }, { unique: true });
schema.index({ blockedPublicId: 1 });

export default mongoose.model('BlockedUser', schema);
