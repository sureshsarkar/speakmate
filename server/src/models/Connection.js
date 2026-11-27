import mongoose from 'mongoose';

// Accepted connections allow direct audio calls. Not a chat/contact list.
const schema = new mongoose.Schema(
  {
    pairKey: { type: String, required: true, unique: true }, // sorted "a|b"
    requester: { type: String, required: true }, // publicId
    recipient: { type: String, required: true }, // publicId
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
    respondedAt: Date,
  },
  { timestamps: true }
);

schema.index({ requester: 1 });
schema.index({ recipient: 1 });

export const pairKeyOf = (a, b) => [a, b].sort().join('|');
export default mongoose.model('Connection', schema);
