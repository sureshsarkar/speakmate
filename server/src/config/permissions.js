export const ADMIN_ROLES = ['super_admin', 'moderator', 'support'];

// permission -> roles allowed
const MATRIX = {
  'dashboard.view': ['super_admin', 'moderator', 'support'],
  'users.view': ['super_admin', 'moderator', 'support'],
  'users.edit': ['super_admin', 'support'],
  'users.restrict': ['super_admin', 'moderator'],
  'users.delete': ['super_admin'],
  'users.premium': ['super_admin'],
  'calls.view': ['super_admin', 'moderator', 'support'],
  'calls.end': ['super_admin', 'moderator'],
  'reports.manage': ['super_admin', 'moderator'],
  'content.manage': ['super_admin', 'support'],
  'settings.manage': ['super_admin'],
  'admins.manage': ['super_admin'],
};

export const can = (role, perm) => (MATRIX[perm] || []).includes(role);
export const permissionsFor = (role) => Object.keys(MATRIX).filter((p) => can(role, p));
