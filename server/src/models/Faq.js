import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 200 },
    answer: { type: String, required: true, trim: true, maxlength: 1500 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Faq', schema);
