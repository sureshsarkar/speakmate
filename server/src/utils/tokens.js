import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken({ kind, id, tokenVersion = 0, expiresIn = '1d' }) {
  return jwt.sign({ kind, tv: tokenVersion }, env.jwtSecret, { subject: String(id), expiresIn, issuer: 'speakmate' });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: 'speakmate' });
}

export function signAdminToken(admin) {
  return jwt.sign({ kind: 'admin', tv: admin.tokenVersion || 0, role: admin.role }, env.adminJwtSecret, {
    subject: String(admin._id),
    expiresIn: '12h',
    issuer: 'speakmate-admin',
  });
}

export function verifyAdminToken(token) {
  return jwt.verify(token, env.adminJwtSecret, { issuer: 'speakmate-admin' });
}
