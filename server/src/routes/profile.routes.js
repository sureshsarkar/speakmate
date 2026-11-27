import { Router } from 'express';
import * as c from '../controllers/profileController.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const r = Router();
r.use(authenticate);
r.put('/', validate(c.schemas.profile), c.updateProfile);
r.put('/settings', validate(c.schemas.settings), c.updateSettings);
r.post('/avatar', requireUser, c.avatarUpload, c.uploadAvatarHandler);
r.delete('/avatar', requireUser, c.removeAvatar);
r.post('/push-subscription', requireUser, validate(c.schemas.push), c.addPush);
r.delete('/push-subscription', requireUser, validate(c.schemas.pushRemove), c.removePush);
r.post('/delete', validate(c.schemas.deleteAccount), c.deleteAccount);

export default r;
