import mongoose from 'mongoose';
import { LEVELS } from './_shared.js';

const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['word', 'phrase', 'starter'], default: 'word' },
    word: { type: String, required: true, trim: true, maxlength: 120 }, // word or sentence
    meaning: { type: String, default: '', maxlength: 300 },
    example: { type: String, default: '', maxlength: 300 },
    level: { type: String, enum: LEVELS, default: 'beginner' },
    topicSlug: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schema.index({ active: 1, kind: 1, topicSlug: 1 });

export default mongoose.model('Vocabulary', schema);
