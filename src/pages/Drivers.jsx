import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, Phone, X, UserRound, AlertCircle, ShieldAlert } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { drivers as driversApi, fleet } from '../services/api';
import {
  DRIVER_STATUSES,
  getDriverStatusColor,
  getDriverStatusDot,
  licenceState,
  toDateInput,
  formatDate,
} from '../constants/driver';

// One blank driver. `_id` is absent until the server assigns one, which is how
// the save path tells a new driver from an edit of an existing one.
const emptyDriver = () => ({
  name: '',
  mobile: '',
  licenseNumber: '',
  licenseExpiry: '',
  joiningDate: '',
  salary: '',
  status: 'Available',
  truck: '',
  emergencyContact: { name: '', relation: '', mobile: '' },
});

// The API returns dates as ISO strings and `truck` as a populated object; the
// form wants yyyy-mm-dd and a bare id.
const toForm = (driver) => ({
  ...emptyDriver(),
  ...driver,
  licenseExpiry: toDateInput(driver.licenseExpiry),
  joiningDate: toDateInput(driver.joiningDate),
  salary: driver.salary ?? '',
  status: driver.status || 'Available',
  truck: driver.truck?._id || driver.truck || '',
  emergencyContact: { ...emptyDriver().emergencyContact, ...(driver.emergencyContact || {}) },
});

const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

// Driver Master — the roster as its own screen, alongside Vehicles under Fleet
// Management. A driver can exist here without a truck: hiring happens before
// assignment, and a driver kept on the books between assignments is a normal
// record, not an orphan.
export function Drivers() {
  const { can } = usePermissions();

  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // The modal's working copy. Null when closed.
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // `can` is recreated on every render of the permissions hook's dependents, so
  // the fetch keys off the concrete grant instead of the function identity —
  // otherwise this refires in a loop.
  const canReadTrucks = can('trucks', 'read');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The truck list only feeds the assignment dropdown, so a seat without
        // `trucks` access still gets a working roster instead of a dead page.
        const [driverRes, truckRes] = await Promise.all([
          driversApi.list(),
          canReadTrucks ? fleet.list().catch(() => ({ trucks: [] })) : Promise.resolve({ trucks: [] }),
        ]);
        if (cancelled) return;
        setDrivers(driverRes.drivers || []);
        setTrucks(truckRes.trucks || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load drivers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canReadTrucks]);

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

  const openAdd = () => {
    setFormError('');
    setEditing(emptyDriver());
  };

  const openEdit = (driver) => {
    setFormError('');
    setEditing(toForm(driver));
  };

  const setField = (field, value) =>
    setEditing((prev) => ({ ...prev, [field]: value }));

  const setContactField = (field, value) =>
    setEditing((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value },
    }));

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    const name = editing.name.trim();
    const mobile = String(editing.mobile).replace(/\D/g, '');
    if (!name || mobile.length !== 10) {
      setFormError('A driver needs a name and a valid 10-digit mobile number.');
      return;
    }

    const contactMobile = String(editing.emergencyContact.mobile || '').replace(/\D/g, '');
    if (contactMobile && contactMobile.length !== 10) {
      setFormError('The emergency contact number must be 10 digits, or left blank.');
      return;
    }

    const payload = {
      name,
      mobile,
      licenseNumber: editing.licenseNumber.trim(),
      licenseExpiry: editing.licenseExpiry || null,
      joiningDate: editing.joiningDate || null,
      salary: editing.salary === '' ? null : Number(editing.salary),
      status: editing.status,
      // Sent explicitly so clearing the dropdown actually unassigns the driver;
      // the API only touches `truck` when the field is present.
      truck: editing.truck || null,
      emergencyContact: {
        name: editing.emergencyContact.name.trim(),
        relation: editing.emergencyContact.relation.trim(),
        mobile: contactMobile,
      },
    };

    setSaving(true);
    try {
      const id = editing._id || editing.id;
      const res = id
        ? await driversApi.update(id, payload)
        : await driversApi.create(payload);

      // The saved document comes back with `truck` as a bare id, so the row is
      // stitched from the local truck list rather than refetching the page.
      const truckDoc = trucks.find((t) => (t._id || t.id) === payload.truck) || null;
      const saved = {
        ...res.driver,
        truck: truckDoc
          ? { _id: truckDoc._id || truckDoc.id, number: truckDoc.number, model: truckDoc.model }
          : null,
      };

      setDrivers((prev) =>
        id ? prev.map((d) => ((d._id || d.id) === id ? saved : d)) : [...prev, saved]
      );
      setEditing(null);
    } catch (err) {
      setFormError(err.message || 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  };

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
                onClick={openAdd}
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
                                  onClick={() => openEdit(driver)}
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

      {/* Add / Edit Driver modal */}
      {editing && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing._id || editing.id ? 'Edit Driver' : 'Add New Driver'}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {formError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Personal Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Driver Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Rajesh Kumar"
                      value={editing.name}
                      onChange={(e) => setField('name', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Mobile Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g., 9876543210"
                      value={editing.mobile}
                      onChange={(e) => setField('mobile', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Licence &amp; Employment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Licence Number</label>
                    <input
                      type="text"
                      placeholder="e.g., DL-0219950000123"
                      value={editing.licenseNumber}
                      onChange={(e) => setField('licenseNumber', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Licence Expiry</label>
                    <input
                      type="date"
                      value={editing.licenseExpiry}
                      onChange={(e) => setField('licenseExpiry', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Joining Date</label>
                    <input
                      type="date"
                      value={editing.joiningDate}
                      onChange={(e) => setField('joiningDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Salary (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={editing.salary}
                      onChange={(e) => setField('salary', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Sunita Kumar"
                      value={editing.emergencyContact.name}
                      onChange={(e) => setContactField('name', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Relation</label>
                    <input
                      type="text"
                      placeholder="e.g., Spouse"
                      value={editing.emergencyContact.relation}
                      onChange={(e) => setContactField('relation', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contact Mobile</label>
                    <input
                      type="tel"
                      placeholder="e.g., 9876543211"
                      value={editing.emergencyContact.mobile}
                      onChange={(e) => setContactField('mobile', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Assignment &amp; Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Assigned Truck</label>
                    <select
                      value={editing.truck}
                      onChange={(e) => setField('truck', e.target.value)}
                      className={inputClass}
                      disabled={!canReadTrucks}
                    >
                      <option value="">Unassigned</option>
                      {trucks.map((t) => {
                        const tid = t._id || t.id;
                        return (
                          <option key={tid} value={tid}>
                            {t.number}{t.model ? ` — ${t.model}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      A driver can stay on the roster without a truck.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={editing.status}
                      onChange={(e) => setField('status', e.target.value)}
                      className={inputClass}
                    >
                      {DRIVER_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
