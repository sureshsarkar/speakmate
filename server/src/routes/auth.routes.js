import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { authenticate, optionalAuth, requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, guestLimiter, registerLimiter } from '../middleware/rateLimit.js';

const r = Router();
r.post('/register', registerLimiter, optionalAuth, validate(c.schemas.register), c.register);
r.post('/login', authLimiter, validate(c.schemas.login), c.login);
r.post('/guest', guestLimiter, c.guest);
r.post('/google', authLimiter, validate(c.schemas.google), c.google);
r.post('/forgot-password', authLimiter, validate(c.schemas.forgot), c.forgotPassword);
r.post('/reset-password', authLimiter, validate(c.schemas.reset), c.resetPassword);
r.post('/verify-email', authLimiter, validate(c.schemas.verify), c.verifyEmail);
r.post('/resend-verification', authLimiter, authenticate, requireUser, c.resendVerification);
r.post('/change-password', authLimiter, authenticate, requireUser, validate(c.schemas.change), c.changePassword);
r.get('/me', authenticate, c.me);
// Tokens are stateless JWTs: logout is the client discarding the token (and closing its socket).
r.post('/logout', authenticate, (_req, res) => res.json({ success: true }));

export default r;
