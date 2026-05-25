import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, FileText, Download, Eye, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';

export function TripsAndDocuments() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('trips');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
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
    { id: 'trips', label: 'Trips & Documents', icon: FileText },
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

  // Sample trips data
  const [trips, setTrips] = useState([
    {
      id: 'TP2026-001',
      truck: 'MH-01-AB-1234',
      lr: 'LR/2026/001',
      bill: 'INV-2026-001',
      partyName: 'ABC Enterprises',
      status: 'Paid',
      amount: 15000,
      date: '2026-05-20',
      documents: { tax: true, lr: true, goods: true },
    },
    {
      id: 'TP2026-002',
      truck: 'MH-01-CD-5678',
      lr: 'LR/2026/002',
      bill: 'INV-2026-002',
      partyName: 'XYZ Traders',
      status: 'Partial',
      amount: 22000,
      date: '2026-05-21',
      documents: { tax: true, lr: true, goods: false },
    },
    {
      id: 'TP2026-003',
      truck: 'MH-01-EF-9012',
      lr: 'LR/2026/003',
      bill: 'INV-2026-003',
      partyName: 'Global Logistics',
      status: 'Pending',
      amount: 18500,
      date: '2026-05-22',
      documents: { tax: true, lr: false, goods: true },
    },
  ]);

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.truck.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.lr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.bill.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.partyName.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    return matchesSearch && trip.status.toLowerCase() === filterType;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'Pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const handleDeleteTrip = (id) => {
    setTrips(trips.filter((trip) => trip.id !== id));
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
                const isActive = item.id === 'trips';
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
                const isActive = item.id === 'trips';
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
          <h1 className="text-3xl font-bold text-slate-900">Trips & Documents</h1>
          <p className="text-slate-600 mt-1">Manage your trips, expenses, and payment records</p>
        </div>
        <button
          onClick={() => navigate('/add-new-trip')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New Trip
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by truck, LR, bill, or party name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'trips'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Trips
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'documents'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Documents
        </button>
      </div>

      {/* Trips Table */}
      {activeTab === 'trips' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Trip ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Truck</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">LR</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Bill</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Party</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{trip.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{trip.truck}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{trip.lr}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{trip.bill}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{trip.partyName}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">₹{trip.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedTrip(trip);
                            setShowPaymentModal(true);
                          }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                          title="Record Payment"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(trip.id)}
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
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{trip.id}</h3>
                <p className="text-sm text-slate-600">{trip.partyName}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">Tax Invoice</span>
                  </div>
                  {trip.documents.tax ? (
                    <button className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium">Lorry Receipt (LR)</span>
                  </div>
                  {trip.documents.lr ? (
                    <button className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Goods Declaration</span>
                  </div>
                  {trip.documents.goods ? (
                    <button className="p-1 hover:bg-green-50 text-green-600 rounded transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Record Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedTrip && (
                <>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">Trip</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedTrip.id}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Total Amount</p>
                      <p className="text-lg font-semibold text-slate-900">₹{selectedTrip.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Status</p>
                      <p className={`text-lg font-semibold ${selectedTrip.status === 'Paid' ? 'text-green-600' : selectedTrip.status === 'Partial' ? 'text-yellow-600' : 'text-red-600'}`}>
                        {selectedTrip.status}
                      </p>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Type</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Full Payment</option>
                  <option>Partial Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Bank Transfer</option>
                  <option>UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
