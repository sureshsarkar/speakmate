import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 200 },
    icon: { type: String, default: '💬', maxlength: 8 },
    starters: { type: [String], default: [] },
    premium: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ active: 1, order: 1 });

export default mongoose.model('ConversationTopic', schema);
