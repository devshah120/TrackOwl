import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Filter, Phone, UserRound, ShieldAlert } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { drivers as driversApi } from '../services/api';
import {
  DRIVER_STATUSES,
  getDriverStatusColor,
  getDriverStatusDot,
  licenceState,
  formatDate,
} from '../constants/driver';

// Driver Master — the roster as its own screen, alongside Vehicles under Fleet
// Management. A driver can exist here without a truck: hiring happens before
// assignment, and a driver kept on the books between assignments is a normal
// record, not an orphan.
export function Drivers() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await driversApi.list();
        if (!cancelled) setDrivers(res.drivers || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load drivers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchesSearch =
        !q ||
        (d.name || '').toLowerCase().includes(q) ||
        (d.mobile || '').includes(q) ||
        (d.licenseNumber || '').toLowerCase().includes(q) ||
        (d.truck?.number || '').toLowerCase().includes(q);
      if (filterStatus === 'all') return matchesSearch;
      return matchesSearch && d.status === filterStatus;
    });
  }, [drivers, searchQuery, filterStatus]);

  // Headline counts read off the whole roster, not the filtered view — they are
  // meant to answer "what does the roster look like right now?".
  const stats = useMemo(() => {
    const byStatus = (status) => drivers.filter((d) => d.status === status).length;
    return {
      total: drivers.length,
      available: byStatus('Available'),
      onTrip: byStatus('On Trip'),
      licenceIssues: drivers.filter((d) => ['expired', 'expiring'].includes(licenceState(d.licenseExpiry))).length,
    };
  }, [drivers]);

  const handleDelete = async (driver) => {
    const id = driver._id || driver.id;
    if (!window.confirm(`Remove ${driver.name} from the roster? This cannot be undone.`)) return;
    try {
      await driversApi.remove(id);
      setDrivers((prev) => prev.filter((d) => (d._id || d.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove driver');
    }
  };

  const licenceCell = (expiry) => {
    const state = licenceState(expiry);
    const styles = {
      expired: 'text-red-600 font-medium',
      expiring: 'text-amber-600 font-medium',
      valid: 'text-green-600 font-medium',
      unknown: 'text-slate-400',
    };
    const labels = { expired: 'Expired', expiring: 'Expiring Soon', valid: 'Valid', unknown: '—' };
    return (
      <>
        <span className={styles[state]}>{labels[state]}</span>
        {expiry && <span className="block text-xs text-slate-500">{formatDate(expiry)}</span>}
      </>
    );
  };

  const statTiles = [
    { label: 'Total Drivers', value: stats.total, icon: UserRound, tone: 'text-slate-900', bg: 'bg-slate-100' },
    { label: 'Available', value: stats.available, icon: UserRound, tone: 'text-green-700', bg: 'bg-green-100' },
    { label: 'On Trip', value: stats.onTrip, icon: UserRound, tone: 'text-blue-700', bg: 'bg-blue-100' },
    { label: 'Licence Alerts', value: stats.licenceIssues, icon: ShieldAlert, tone: 'text-amber-700', bg: 'bg-amber-100' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Drivers</h1>
              <p className="text-slate-600 mt-1">Driver master — licences, salary and availability</p>
            </div>
            {can('drivers', 'create') && (
              <button
                onClick={() => navigate('/add-new-driver')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Driver
              </button>
            )}
          </div>

          {/* Roster at a glance */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <div key={tile.label} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${tile.bg}`}>
                    <Icon className={`w-5 h-5 ${tile.tone}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${tile.tone}`}>{tile.value}</p>
                    <p className="text-xs text-slate-500">{tile.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by driver name, mobile, licence, or truck number..."
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
                  {DRIVER_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading && <div className="text-center py-12 text-slate-500">Loading drivers...</div>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Driver Table */}
          {!loading && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Driver</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Mobile</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Licence</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Licence Validity</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Joining</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Salary</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Emergency Contact</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Assigned Truck</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.map((driver) => {
                      const id = driver._id || driver.id;
                      const contact = driver.emergencyContact || {};
                      return (
                        <tr key={id} className="hover:bg-slate-50 transition-colors align-top">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {driver.name}
                            {driver.isPrimary && driver.truck && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                              {driver.mobile}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {driver.licenseNumber || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">{licenceCell(driver.licenseExpiry)}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                            {formatDate(driver.joiningDate)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 whitespace-nowrap">
                            {driver.salary ? (
                              `₹${Number(driver.salary).toLocaleString()}`
                            ) : (
                              <span className="font-normal text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {contact.name || contact.mobile ? (
                              <>
                                <span className="block whitespace-nowrap">{contact.name || '—'}</span>
                                <span className="block text-xs text-slate-500 whitespace-nowrap">
                                  {[contact.relation, contact.mobile].filter(Boolean).join(' · ') || '—'}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                            {driver.truck?.number ? (
                              <>
                                <span className="text-blue-600 font-medium">{driver.truck.number}</span>
                                {driver.truck.model && (
                                  <span className="block text-xs text-slate-500">{driver.truck.model}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getDriverStatusDot(driver.status)}`}></div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getDriverStatusColor(driver.status)}`}>
                                {driver.status || 'Available'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              {can('drivers', 'update') && (
                                <button
                                  onClick={() => navigate(`/add-new-driver/${id}`)}
                                  className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                  title="Edit Driver"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {can('drivers', 'delete') && (
                                <button
                                  onClick={() => handleDelete(driver)}
                                  className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                  title="Remove Driver"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              {!can('drivers', 'update') && !can('drivers', 'delete') && (
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

              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <UserRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {drivers.length === 0
                      ? 'No drivers on the roster yet.'
                      : 'No drivers match this search.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
