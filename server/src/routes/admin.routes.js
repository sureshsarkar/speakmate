import { Router } from 'express';
import * as c from '../controllers/adminController.js';
import { adminAuthenticate, requirePermission as need } from '../middleware/adminAuth.js';
import { validate } from '../middleware/validate.js';
import { adminLoginLimiter } from '../middleware/rateLimit.js';

const r = Router();

r.post('/auth/login', adminLoginLimiter, validate(c.schemas.login), c.login);

r.use(adminAuthenticate);
r.get('/auth/me', c.me);
r.get('/dashboard', need('dashboard.view'), c.dashboard);

// Users (registered + guests via ?kind=guest)
r.get('/users', need('users.view'), c.listUsers);
r.get('/users/:id', need('users.view'), c.getUser);
r.patch('/users/:id', need('users.edit'), validate(c.schemas.userEdit), c.editUser);
r.post('/users/:id/status', need('users.restrict'), validate(c.schemas.userStatus), c.setStatus);
r.post('/users/:id/premium', need('users.premium'), validate(c.schemas.premium), c.setPremium);
r.delete('/users/:id', need('users.delete'), c.removeUser);

// Audio call metadata only: admins never get audio streams or recordings
r.get('/calls/active', need('calls.view'), c.activeCalls);
r.get('/calls/history', need('calls.view'), c.callHistory);
r.get('/calls/health', need('calls.view'), c.audioHealth);
r.post('/calls/:callKey/end', need('calls.end'), c.forceEndCall);

// Moderation
r.get('/reports', need('reports.manage'), c.listReports);
r.get('/reports/:id', need('reports.manage'), c.investigateReport);
r.patch('/reports/:id', need('reports.manage'), validate(c.schemas.reportUpdate), c.updateReport);

// Content
r.get('/content/:type', need('content.manage'), c.listContent);
r.post('/content/:type', need('content.manage'), c.createContent);
r.put('/content/:type/:id', need('content.manage'), c.updateContent);
r.delete('/content/:type/:id', need('content.manage'), c.deleteContent);

// Application settings
r.get('/settings', need('settings.manage'), c.getAppSettings);
r.put('/settings', need('settings.manage'), validate(c.schemas.settings), c.putAppSettings);

// Admin accounts
r.get('/admins', need('admins.manage'), c.listAdmins);
r.post('/admins', need('admins.manage'), validate(c.schemas.admin), c.createAdmin);
r.patch('/admins/:id', need('admins.manage'), validate(c.schemas.adminUpdate), c.updateAdmin);
r.delete('/admins/:id', need('admins.manage'), c.deleteAdmin);

export default r;
