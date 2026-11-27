import mongoose from 'mongoose';

// Payment is optional for the MVP. Premium can be granted manually by a Super Admin;
// `provider` is where a payment gateway (Stripe/Razorpay) will plug in later.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['free', 'premium'], default: 'premium' },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    provider: { type: String, enum: ['manual', 'stripe', 'razorpay'], default: 'manual' },
    providerRef: String,
    startedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    note: String,
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

export default mongoose.model('Subscription', schema);
