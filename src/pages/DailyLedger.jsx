import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';

export function DailyLedger() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [notifications] = useState([
    { id: 1, type: 'alert', title: 'Truck Offline', message: "Truck MH-01-AB-1234 has been offline for 2 hours", severity: 'critical', time: '2 min', vehicle: 'MH-01-AB-1234', read: false },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips & Documents', icon: Calendar },
    { id: 'ledger', label: 'Daily Ledger', icon: Calendar },
    { id: 'fleet', label: 'Fleet & Drivers', icon: Truck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleMenuClick = (itemId) => {
    if (itemId === 'dashboard') {
      navigate('/dashboard/dashboard');
    } else if (itemId === 'trips') {
      navigate('/trips-and-documents');
    } else if (itemId === 'ledger') {
      navigate('/daily-ledger');
    } else if (itemId === 'fleet') {
      navigate('/fleet-and-drivers');
    } else if (itemId === 'settings') {
      navigate('/settings');
    }
  };

  // Sample ledger data
  const [ledgerEntries, setLedgerEntries] = useState([
    {
      id: 'LE2026-001',
      date: '2026-05-20',
      type: 'income',
      category: 'Trip',
      description: 'Trip TP2026-001 - ABC Enterprises',
      amount: 15000,
      paymentMethod: 'Bank Transfer',
      reference: 'INV-2026-001',
    },
    {
      id: 'LE2026-002',
      date: '2026-05-20',
      type: 'expense',
      category: 'Fuel',
      description: 'Fuel - MH-01-AB-1234',
      amount: 2500,
      paymentMethod: 'Cash',
      reference: 'FUL-20260520-001',
    },
    {
      id: 'LE2026-003',
      date: '2026-05-21',
      type: 'income',
      category: 'Trip',
      description: 'Trip TP2026-002 - XYZ Traders',
      amount: 22000,
      paymentMethod: 'Cheque',
      reference: 'INV-2026-002',
    },
    {
      id: 'LE2026-004',
      date: '2026-05-21',
      type: 'expense',
      category: 'Toll',
      description: 'Toll - Highway Toll',
      amount: 450,
      paymentMethod: 'Cash',
      reference: 'TOL-20260521-001',
    },
    {
      id: 'LE2026-005',
      date: '2026-05-21',
      type: 'expense',
      category: 'Maintenance',
      description: 'Vehicle maintenance - MH-01-CD-5678',
      amount: 3500,
      paymentMethod: 'Card',
      reference: 'MNT-20260521-001',
    },
    {
      id: 'LE2026-006',
      date: '2026-05-22',
      type: 'income',
      category: 'Trip',
      description: 'Trip TP2026-003 - Global Logistics',
      amount: 18500,
      paymentMethod: 'Bank Transfer',
      reference: 'INV-2026-003',
    },
    {
      id: 'LE2026-007',
      date: '2026-05-22',
      type: 'expense',
      category: 'Salary',
      description: 'Driver salary - May',
      amount: 8000,
      paymentMethod: 'Cash',
      reference: 'SAL-MAY-2026',
    },
  ]);

  const filteredEntries = ledgerEntries.filter((entry) => {
    const matchesSearch =
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchQuery.toLowerCase());

    const monthMatch = entry.date.startsWith(selectedMonth);

    if (activeView === 'all') return matchesSearch && monthMatch;
    if (activeView === 'income') return matchesSearch && monthMatch && entry.type === 'income';
    if (activeView === 'expense') return matchesSearch && monthMatch && entry.type === 'expense';
    return matchesSearch && monthMatch;
  });

  const calculateMonthlyStats = () => {
    const monthEntries = ledgerEntries.filter(e => e.date.startsWith(selectedMonth));
    const income = monthEntries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const expenses = monthEntries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
    const collected = income;
    const netProfit = income - expenses;

    return { income, expenses, collected, netProfit };
  };

  const stats = calculateMonthlyStats();

  const getTypeColor = (type) => {
    return type === 'income' ? 'text-green-600' : 'text-red-600';
  };

  const getTypeSign = (type) => {
    return type === 'income' ? '+' : '−';
  };

  const handleDeleteEntry = (id) => {
    setLedgerEntries(ledgerEntries.filter((entry) => entry.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Left: Logo and Desktop Menu */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold">
                Track<span className="text-blue-600">Owl</span>
              </h1>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === 'ledger';
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: User Profile and Actions */}
          <div className="flex items-center gap-4">
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? (
                <AiOutlineFullscreenExit className="w-5 h-5 text-slate-600" />
              ) : (
                <AiOutlineFullscreen className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-500">{user?.role || 'Client'}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200">
                  <div className="p-3 border-b border-slate-200">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-xs text-slate-500 mt-1">{user?.company}</p>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50">
            <div className="px-4 py-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === 'ledger';
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleMenuClick(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Daily Ledger</h1>
              <p className="text-slate-600 mt-1">Track your income, expenses, and profits</p>
            </div>
            <button
              onClick={() => navigate('/add-ledger-entry')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {/* Month Filter */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monthly Freight Total */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Freight Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.income.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">All trips billed that month</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            {/* Monthly Collected */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Collected</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.collected.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Payments received</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Expenses</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.expenses.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">All costs that month</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
            </div>

            {/* Net Profit / Loss */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Net Profit / Loss</p>
                  <p className={`text-2xl font-bold mt-2 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{Math.abs(stats.netProfit).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Monthly bottom line</p>
                </div>
                {stats.netProfit >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-600" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-600" />
                )}
              </div>
            </div>
          </div>

          {/* View Tabs and Search */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveView('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Entries View
                </button>
                <button
                  onClick={() => setActiveView('income')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'income'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Income Only View
                </button>
                <button
                  onClick={() => setActiveView('expense')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'expense'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Expense Only View
                </button>
              </div>
              <div className="flex-1 md:flex-initial relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Entries Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Payment Method</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.date}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`font-medium ${getTypeColor(entry.type)}`}>
                          {entry.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.category}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.description}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.paymentMethod}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={getTypeColor(entry.type)}>
                          {getTypeSign(entry.type)}₹{entry.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No entries found for the selected filters.</p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
