import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';

// Reads the grant list the server attached to the logged-in user and answers
// "may this seat do X?".
//
// This hides UI, it does not secure anything — every one of these checks is
// enforced again server-side by `requirePermission`. The point is that a
// Viewer should not be shown an "Add Truck" button that only ever 403s.
//
//   const { can, isCompanyAdmin } = usePermissions();
//   {can('trucks', 'create') && <AddTruckButton />}
export function usePermissions() {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role || null;
    // Expanded server-side from the role matrix, e.g. ['trucks:read', ...].
    const grants = new Set(user?.permissions || []);

    // Super Admin is scoped to no account and gated by its own routes; it
    // short-circuits rather than being enumerated in the grant list.
    const isSuperAdmin = role === ROLES.SUPER_ADMIN;

    const can = (resource, action = 'read') =>
      isSuperAdmin || grants.has(`${resource}:${action}`);

    // Does this seat hold *any* grant on a resource? Drives nav visibility,
    // where the question is "should this section exist for them at all?"
    // rather than "may they press this particular button?".
    const canAccess = (resource) =>
      isSuperAdmin || [...grants].some((g) => g.startsWith(`${resource}:`));

    // True when the seat can change a resource at all, not merely read it —
    // the cheap check for showing or hiding a whole toolbar.
    const canWrite = (resource) =>
      can(resource, 'create') || can(resource, 'update') || can(resource, 'delete');

    return {
      role,
      permissions: [...grants],
      can,
      canAccess,
      canWrite,
      isSuperAdmin,
      isCompanyAdmin: role === ROLES.COMPANY_ADMIN,
      // The seat owns the account it is working in — the only role allowed to
      // manage the roster.
      isAccountOwner: role === ROLES.COMPANY_ADMIN || isSuperAdmin,
      // A seat that can look but not touch, anywhere. Worth naming because the
      // UI shows an explicit "read-only" hint for it.
      isReadOnly: !isSuperAdmin && !canWrite('trucks') && !canWrite('trips') && !canWrite('ledger'),
    };
  }, [user]);
}
