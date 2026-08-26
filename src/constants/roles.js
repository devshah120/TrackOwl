// Mirror of the backend's utils/permissions.js, for labelling and for hiding UI
// the API would refuse anyway.
//
// The permission *matrix* is not duplicated here — the server sends each user
// their expanded grant list on login (`user.permissions`), and `usePermissions`
// reads that. Only the names and the presentational bits live on this side, so
// there is one source of truth for who can do what.

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  FLEET_MANAGER: 'fleet_manager',
  ACCOUNTANT: 'accountant',
  VIEWER: 'viewer',
  DRIVER: 'driver',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.COMPANY_ADMIN]: 'Company Admin',
  [ROLES.FLEET_MANAGER]: 'Fleet Manager',
  [ROLES.ACCOUNTANT]: 'Accountant',
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.DRIVER]: 'Driver',
};

// One line each, shown under the role picker so an admin choosing a seat knows
// what they are handing out without reading the matrix.
export const ROLE_DESCRIPTIONS = {
  [ROLES.SUPER_ADMIN]: 'Platform operator. Full access across every account.',
  [ROLES.COMPANY_ADMIN]: 'Account owner. Full access, and manages this team.',
  [ROLES.FLEET_MANAGER]: 'Runs trucks, drivers, trips and tracking. Can log expenses but not edit the books.',
  [ROLES.ACCOUNTANT]: 'Owns the ledger and billing. Reads trips and fleet, but does not dispatch.',
  [ROLES.VIEWER]: 'Read-only across the account. Changes nothing.',
  [ROLES.DRIVER]: 'Sees assigned trips and vehicle location only.',
};

// Badge colours, keyed by role, so the roster table and the topbar agree.
export const ROLE_BADGE_CLASSES = {
  [ROLES.SUPER_ADMIN]: 'bg-slate-900 text-white',
  [ROLES.COMPANY_ADMIN]: 'bg-blue-100 text-blue-800',
  [ROLES.FLEET_MANAGER]: 'bg-emerald-100 text-emerald-800',
  [ROLES.ACCOUNTANT]: 'bg-amber-100 text-amber-800',
  [ROLES.VIEWER]: 'bg-slate-100 text-slate-700',
  [ROLES.DRIVER]: 'bg-purple-100 text-purple-800',
};

// Roles a Company Admin can hand out. Kept in step with ASSIGNABLE_ROLES on the
// server, which rejects anything else regardless of what this list says.
export const ASSIGNABLE_ROLES = [
  ROLES.FLEET_MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.VIEWER,
  ROLES.DRIVER,
];

export const roleLabel = (role) => ROLE_LABELS[role] || role || 'Unknown';
