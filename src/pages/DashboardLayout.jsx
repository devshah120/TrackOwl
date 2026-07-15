import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { Dashboard } from './Dashboard';

// The dashboard shell. Navigation now lives entirely in <Topbar />, which routes
// every menu item to its own standalone page — so this layout only hosts the
// Dashboard itself. Older /dashboard/* sub-paths (trips, fleet, ledger, settings)
// are redirected to those standalone pages so stale URLs and bookmarks still land
// on the real screen instead of this shell's placeholder.
const LEGACY_REDIRECTS = {
  'trips-and-documents': '/trips-and-documents',
  fleet: '/live-tracking',        // "Fleet" used to render the live map here
  'daily-ledger': '/daily-ledger',
  settings: '/settings',
};

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const leaf = location.pathname.split('/').pop();
    if (LEGACY_REDIRECTS[leaf]) navigate(LEGACY_REDIRECTS[leaf], { replace: true });
  }, [location.pathname, navigate]);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full">
          <Dashboard />
        </div>
      </main>
    </div>
  );
}
