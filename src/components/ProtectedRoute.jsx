import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// `requireSuperAdmin` gates a page to superadmin only, bouncing a client to their
// dashboard. `clientOnly` is the reverse: gates a page to regular clients,
// bouncing a superadmin (who has no owned fleet/ledger data to show there) to
// the admin overview instead.
export function ProtectedRoute({ children, requireSuperAdmin = false, clientOnly = false }) {
  const { isAuthenticated, isInitialized, isSuperAdmin } = useAuth();

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

  return children;
}
