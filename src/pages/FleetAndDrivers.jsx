import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, Phone, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';

export function FleetAndDrivers() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('trucks');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
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

  // Sample trucks data
  const [trucks, setTrucks] = useState([
    {
      id: 'TR001',
      number: 'MH-01-AB-1234',
      model: 'Tata 407',
      registrationDate: '2020-03-15',
      insuranceExpiry: '2026-09-15',
      status: 'Running',
      currentRoute: 'Mumbai → Bangalore',
      driver: {
        id: 'DRV001',
        name: 'Rajesh Kumar',
        mobile: '9876543210',
        salary: 15000,
        licenseExpiry: '2027-06-30',
      },
    },
    {
      id: 'TR002',
      number: 'MH-01-CD-5678',
      model: 'Ashok Leyland 3318',
      registrationDate: '2019-07-22',
      insuranceExpiry: '2026-05-20',
      status: 'Idle',
      currentRoute: 'Pune → Hyderabad',
      driver: {
        id: 'DRV002',
        name: 'Priya Singh',
        mobile: '9876543211',
        salary: 14500,
        licenseExpiry: '2026-12-15',
      },
    },
    {
      id: 'TR003',
      number: 'MH-01-EF-9012',
      model: 'Mahindra Bolero Pik-Up',
      registrationDate: '2021-11-08',
      insuranceExpiry: '2027-02-28',
      status: 'Running',
      currentRoute: 'Delhi → Chandigarh',
      driver: {
        id: 'DRV003',
        name: 'Amit Patel',
        mobile: '9876543212',
        salary: 13500,
        licenseExpiry: '2028-03-10',
      },
    },
    {
      id: 'TR004',
      number: 'MH-01-GH-3456',
      model: 'Tata 709',
      registrationDate: '2018-02-14',
      insuranceExpiry: '2025-08-10',
      status: 'Stopped',
      currentRoute: 'Maintenance',
      driver: {
        id: 'DRV004',
        name: 'Vikram Sharma',
        mobile: '9876543213',
        salary: 15500,
        licenseExpiry: '2026-09-05',
      },
    },
  ]);

  const filteredTrucks = trucks.filter((truck) => {
    const matchesSearch =
      truck.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.model.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && truck.status.toLowerCase() === filterStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
        return 'bg-green-100 text-green-800';
      case 'Idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'Stopped':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'Running':
        return 'bg-green-500';
      case 'Idle':
        return 'bg-yellow-500';
      case 'Stopped':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  const isInsuranceExpiringSoon = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isInsuranceExpired = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const handleDeleteTruck = (id) => {
    setTrucks(trucks.filter((truck) => truck.id !== id));
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
                const isActive = item.id === 'fleet';
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
                const isActive = item.id === 'fleet';
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
              <h1 className="text-3xl font-bold text-slate-900">Fleet & Drivers</h1>
              <p className="text-slate-600 mt-1">Manage your trucks and drivers efficiently</p>
            </div>
            <button
              onClick={() => navigate('/add-new-truck')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New Truck
            </button>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by truck number, driver name, or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="idle">Idle</option>
                  <option value="stopped">Stopped</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('trucks')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'trucks'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Trucks
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'alerts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Alerts & Maintenance
            </button>
          </div>

          {/* Trucks Table */}
          {activeTab === 'trucks' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Truck</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Model</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Driver</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Mobile</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Salary</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Current Route</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Insurance</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTrucks.map((truck) => (
                      <tr key={truck.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{truck.number}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{truck.model}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{truck.driver.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {truck.driver.mobile}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">₹{truck.driver.salary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusDot(truck.status)}`}></div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(truck.status)}`}>
                              {truck.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{truck.currentRoute}</td>
                        <td className="px-6 py-4 text-sm">
                          {isInsuranceExpired(truck.insuranceExpiry) ? (
                            <span className="text-red-600 font-medium">Expired</span>
                          ) : isInsuranceExpiringSoon(truck.insuranceExpiry) ? (
                            <span className="text-amber-600 font-medium">Expiring Soon</span>
                          ) : (
                            <span className="text-green-600 font-medium">Valid</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                              title="Edit Truck Info"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTruck(truck.id)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                              title="Remove Truck"
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

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              {trucks
                .filter((truck) => isInsuranceExpired(truck.insuranceExpiry) || isInsuranceExpiringSoon(truck.insuranceExpiry))
                .map((truck) => (
                  <div key={truck.id} className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${isInsuranceExpired(truck.insuranceExpiry) ? 'bg-red-100' : 'bg-amber-100'}`}>
                        <AlertCircle className={`w-6 h-6 ${isInsuranceExpired(truck.insuranceExpiry) ? 'text-red-600' : 'text-amber-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{truck.number}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {isInsuranceExpired(truck.insuranceExpiry)
                            ? `Insurance expired on ${new Date(truck.insuranceExpiry).toLocaleDateString()}`
                            : `Insurance expires on ${new Date(truck.insuranceExpiry).toLocaleDateString()}`}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                            Renew Insurance
                          </button>
                          <button className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300 transition-colors">
                            View Details
                          </button>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        isInsuranceExpired(truck.insuranceExpiry)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isInsuranceExpired(truck.insuranceExpiry) ? 'URGENT' : 'WARNING'}
                      </span>
                    </div>
                  </div>
                ))}
              {trucks.filter((truck) => isInsuranceExpired(truck.insuranceExpiry) || isInsuranceExpiringSoon(truck.insuranceExpiry)).length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">No active alerts. All insurance policies are valid.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
