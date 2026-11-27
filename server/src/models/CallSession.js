import mongoose from 'mongoose';

const participant = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    kind: { type: String, enum: ['user', 'guest'], required: true },
    displayName: String,
  },
  { _id: false }
);

// Metadata only. Audio is never recorded or stored.
const schema = new mongoose.Schema(
  {
    callKey: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['random', 'direct'], default: 'random' },
    participants: { type: [participant], validate: (v) => v.length === 2 },
    initiator: String,
    topic: { slug: String, title: String },
    status: {
      type: String,
      enum: ['connecting', 'in_call', 'completed', 'failed', 'cancelled'],
      default: 'connecting',
      index: true,
    },
    endReason: String,
    endedBy: String,
    connectedAt: Date,
    endedAt: Date,
    connectMs: Number,
    durationSec: { type: Number, default: 0 },
    quality: { type: String, enum: ['good', 'fair', 'poor', null], default: null },
  },
  { timestamps: true }
);

schema.index({ 'participants.publicId': 1, createdAt: -1 });
schema.index({ createdAt: -1 });

export default mongoose.model('CallSession', schema);
