import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { Dashboard } from './Dashboard';
import { ComingSoon } from './ComingSoon';
import { FleetMap } from './FleetMap';
import { TripsAndDocuments } from './TripsAndDocuments';

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    const pathToMenuMap = {
      'dashboard': 'dashboard',
      'trips-and-documents': 'trips',
      'daily-ledger': 'ledger',
      'fleet': 'fleet',
      'settings': 'settings',
    };
    setActiveMenu(pathToMenuMap[path] || 'dashboard');
  }, [location.pathname]);

  const handleMenuChange = (menuId) => {
    setActiveMenu(menuId);
    // Ledger and Settings have real standalone pages; route to those rather than
    // the /dashboard/* versions, which this layout only renders as "Coming soon"
    // placeholders. (Fleet stays in-layout so it opens the live map.)
    const standalone = {
      ledger: '/daily-ledger',
      settings: '/settings',
    };
    if (standalone[menuId]) {
      navigate(standalone[menuId]);
      return;
    }
    const menuToPathMap = {
      dashboard: '/dashboard/dashboard',
      trips: '/dashboard/trips-and-documents',
      fleet: '/dashboard/fleet',
    };
    navigate(menuToPathMap[menuId]);
  };

  const renderPage = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard />;
      case 'trips':
        return <TripsAndDocuments />;
      case 'ledger':
        return <ComingSoon title="Daily Ledger" />;
      case 'fleet':
        return <FleetMap />;
      case 'settings':
        return <ComingSoon title="Settings" />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar activeMenu={activeMenu} onMenuChange={handleMenuChange} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full">{renderPage()}</div>
      </main>
    </div>
  );
}
