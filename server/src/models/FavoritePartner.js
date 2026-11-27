import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    ownerPublicId: { type: String, required: true },
    partnerPublicId: { type: String, required: true },
    partnerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

schema.index({ ownerPublicId: 1, partnerPublicId: 1 }, { unique: true });
schema.index({ partnerUser: 1 });

export default mongoose.model('FavoritePartner', schema);
