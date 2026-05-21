import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from './Dashboard';
import { ComingSoon } from './ComingSoon';
import { FleetMap } from './FleetMap';

export function DashboardLayout() {
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const renderPage = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard />;
      case 'trips':
        return <ComingSoon title="Trips & Documents" />;
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
    <div className="flex h-screen bg-slate-50">
      <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl">{renderPage()}</div>
      </main>
    </div>
  );
}
