import mongoose from 'mongoose';
import { ADMIN_ROLES } from '../config/permissions.js';

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, default: 'support' },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Admin', schema);
