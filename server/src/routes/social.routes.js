import { Router } from 'express';
import * as c from '../controllers/socialController.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportLimiter } from '../middleware/rateLimit.js';

const r = Router();
r.use(authenticate);

// Favorites & connections: registered users only
r.get('/favorites', requireUser, c.listFavorites);
r.post('/favorites', requireUser, validate(c.schemas.partner), c.addFavorite);
r.delete('/favorites/:publicId', requireUser, c.removeFavorite);

r.get('/connections', requireUser, c.listConnections);
r.post('/connections', requireUser, validate(c.schemas.partner), c.requestConnection);
r.post('/connections/:id/respond', requireUser, validate(c.schemas.respond), c.respondConnection);
r.delete('/connections/:publicId', requireUser, c.removeConnection);

// Safety: available to guests too
r.get('/blocks', c.listBlocks);
r.post('/blocks', validate(c.schemas.partner), c.blockUser);
r.delete('/blocks/:publicId', c.unblockUser);
r.post('/reports', reportLimiter, validate(c.schemas.report), c.createReport);

r.get('/notifications', requireUser, c.listNotifications);
r.post('/notifications/read-all', requireUser, c.markAllRead);
r.post('/notifications/:id/read', requireUser, c.markRead);
r.delete('/notifications/:id', requireUser, c.deleteNotification);

r.post('/calls/:callKey/feedback', validate(c.schemas.feedback), c.submitFeedback);

export default r;
