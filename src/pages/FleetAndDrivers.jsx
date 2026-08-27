import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, Phone, AlertCircle, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';
import { fleet } from '../services/api';
import {
  VEHICLE_STATUSES,
  getStatusColor,
  getStatusDot,
  formatWeight,
  formatOdometer,
} from '../constants/vehicle';
import { TruckHistory } from '../components/TruckHistory';

export function FleetAndDrivers() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { can } = usePermissions();
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

  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fleet.list();
        if (!cancelled) setTrucks(res.trucks);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load trucks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A truck's drivers, primary first. Falls back to the legacy single `driver`
  // for records not yet migrated to the drivers collection.
  const driversOf = (truck) => {
    if (truck.drivers?.length) return truck.drivers;
    return truck.driver ? [truck.driver] : [];
  };

  const filteredTrucks = trucks.filter((truck) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      truck.number.toLowerCase().includes(q) ||
      truck.model.toLowerCase().includes(q) ||
      // Search hits on any driver assigned to the truck, not just the primary.
      driversOf(truck).some((d) => (d.name || '').toLowerCase().includes(q));

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && truck.status.toLowerCase() === filterStatus;
  });

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

  const handleDeleteTruck = async (id) => {
    try {
      await fleet.remove(id);
      setTrucks((prev) => prev.filter((truck) => (truck._id || truck.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete truck');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fleet & Drivers</h1>
              <p className="text-slate-600 mt-1">Manage your trucks and drivers efficiently</p>
            </div>
            {can('trucks', 'create') && (
              <button
                onClick={() => navigate('/add-new-truck')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Vehicle
              </button>
            )}
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
                  {VEHICLE_STATUSES.map((st) => (
                    <option key={st} value={st.toLowerCase()}>{st}</option>
                  ))}
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
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              Travel History
            </button>
          </div>

          {loading && (
            <div className="text-center py-12 text-slate-500">Loading trucks...</div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Trucks Table */}
          {!loading && activeTab === 'trucks' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Truck</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Model</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Capacity</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Drivers</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Mobile</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Salary</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Current Route</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Insurance</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTrucks.map((truck) => {
                      const truckId = truck._id || truck.id;
                      const truckDrivers = driversOf(truck);
                      const totalSalary = truckDrivers.reduce((sum, d) => sum + Number(d.salary || 0), 0);
                      return (
                      <tr key={truckId} className="hover:bg-slate-50 transition-colors align-top">
                        <td className="px-6 py-4 text-sm font-medium text-blue-600">{truck.number}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {truck.model}
                          {truck.make && (
                            <span className="block text-xs text-slate-500">{truck.make}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {truck.vehicleType || '—'}
                          <span className="block text-xs text-slate-500">
                            {[truck.fuelType, truck.manufactureYear].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatWeight(truck.capacity?.weightKg)}
                          <span className="block text-xs text-slate-500">
                            {truck.capacity?.bodyType || '—'} · {formatOdometer(truck.odometer)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {truckDrivers.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="space-y-1">
                              {truckDrivers.map((d, i) => (
                                <div key={d._id || i} className="flex items-center gap-2 whitespace-nowrap">
                                  <span>{d.name}</span>
                                  {d.isPrimary && truckDrivers.length > 1 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                                      Primary
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {truckDrivers.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="space-y-1">
                              {truckDrivers.map((d, i) => (
                                <div key={d._id || i} className="flex items-center gap-2 whitespace-nowrap">
                                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                  {d.mobile}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                          ₹{totalSalary.toLocaleString()}
                          {truckDrivers.length > 1 && (
                            <span className="block text-xs font-normal text-slate-500">
                              {truckDrivers.length} drivers
                            </span>
                          )}
                        </td>
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
                            {can('trucks', 'update') && (
                              <button
                                onClick={() => navigate(`/add-new-truck/${truckId}`)}
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                title="Edit Truck Info"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can('trucks', 'delete') && (
                              <button
                                onClick={() => handleDeleteTruck(truckId)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Remove Truck"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {!can('trucks', 'update') && !can('trucks', 'delete') && (
                              <span className="text-xs text-slate-400">View only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Travel History Tab. Not gated on `loading`, which tracks the truck
              roster — history is keyed off GPS devices and would otherwise sit
              blank waiting on an unrelated fetch. */}
          {activeTab === 'history' && <TruckHistory />}

          {/* Alerts Tab */}
          {!loading && activeTab === 'alerts' && (
            <div className="space-y-4">
              {trucks
                .filter((truck) => isInsuranceExpired(truck.insuranceExpiry) || isInsuranceExpiringSoon(truck.insuranceExpiry))
                .map((truck) => (
                  <div key={truck._id || truck.id} className="bg-white rounded-lg border border-slate-200 p-4">
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
