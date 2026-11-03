import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { usePlan } from '../hooks/usePlan';
import { UpgradeRequired } from './UpgradeRequired';

// `requireSuperAdmin` gates a page to superadmin only, bouncing a client to their
// dashboard. `clientOnly` is the reverse: gates a page to regular clients,
// bouncing a superadmin (who has no owned fleet/ledger data to show there) to
// the admin overview instead.
//
// `resource` gates a page on the role matrix: a seat with no grant at all on
// that resource (an Accountant opening Live Tracking, say) is sent to the
// dashboard rather than shown a page whose every call would 403. This is a UX
// guard — the API enforces the same rules independently.
export function ProtectedRoute({
  children,
  requireSuperAdmin = false,
  clientOnly = false,
  resource = null,
  // The plan module the page belongs to (services/planCatalog.js on the
  // server). A plan without it shows an upgrade screen instead of a page
  // whose every call would be refused.
  module = null,
}) {
  const { isAuthenticated, isInitialized, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();
  const plan = usePlan();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loadingg...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (clientOnly && isSuperAdmin) {
    return <Navigate to="/admin/overview" replace />;
  }

  if (resource && !canAccess(resource)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (module && !plan.has(module)) {
    return <UpgradeRequired module={module} />;
  }

  return children;
}
