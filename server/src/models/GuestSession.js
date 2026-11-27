import mongoose from 'mongoose';
import { profileFields } from './_shared.js';

const schema = new mongoose.Schema(
  {
    // Secure random temporary guest id (never exposed to other users)
    guestId: { type: String, required: true, unique: true },
    ipHash: { type: String, index: true },
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active', index: true },
    statusReason: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    // Documents are removed automatically after expiry (rolling window)
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    ...profileFields(),
  },
  { timestamps: true }
);

schema.methods.isPremium = () => false;

export default mongoose.model('GuestSession', schema);
