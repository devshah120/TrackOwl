import { useState } from 'react';
import { LayoutDashboard, FileText, Calendar, Truck, Settings, LogOut, Menu, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ activeMenu, onMenuChange }) {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips & Documents', icon: FileText },
    { id: 'ledger', label: 'Daily Ledger', icon: Calendar },
    { id: 'fleet', label: 'Fleet & Drivers', icon: Truck },
    { id: 'tracking', label: 'Live Tracking', icon: MapPin },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuItemClick = (itemId) => {
    if (itemId === 'dashboard') {
      navigate('/dashboard');
    } else if (itemId === 'trips') {
      navigate('/trips-and-documents');
    } else if (itemId === 'ledger') {
      navigate('/daily-ledger');
    } else if (itemId === 'fleet') {
      navigate('/fleet-and-drivers');
    } else if (itemId === 'tracking') {
      navigate('/live-tracking');
    } else if (itemId === 'settings') {
      navigate('/settings');
    }
    onMenuChange(itemId);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:static h-screen bg-slate-900 text-white transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-0 md:w-64'
        } overflow-y-auto overflow-x-hidden`}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="mb-8 mt-4 md:mt-0">
            <h1 className="text-2xl font-bold">
              Track<span className="text-blue-600">Owl</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Fleet Management</p>
          </div>

          {/* User Info */}
          <div className="mb-6 pb-6 border-b border-slate-700">
            <p className="text-sm text-slate-400">Welcome back</p>
            <p className="font-medium text-white">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleMenuItemClick(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors border-t border-slate-700 pt-6"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
