import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 300 },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: { validator: (v) => /^https?:\/\//i.test(v), message: 'URL must start with http:// or https://' },
    },
    category: { type: String, default: 'General', maxlength: 40 },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('LearningResource', schema);
