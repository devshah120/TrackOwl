import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Phone } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';

const emptyForm = {
  owner: '',
  truckNumber: '',
  model: '',
  status: 'Idle',
  currentRoute: '',
  driverName: '',
  mobileNumber: '',
  licenseNumber: '',
  licenseExpiry: '',
  monthlySalary: '',
  registrationDate: '',
  insuranceExpiry: '',
};

function TruckModal({ clients, editingTruck, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!editingTruck) return emptyForm;
    return {
      owner: editingTruck.owner?._id || editingTruck.owner || '',
      truckNumber: editingTruck.number || '',
      model: editingTruck.model || '',
      status: editingTruck.status || 'Idle',
      currentRoute: editingTruck.currentRoute || '',
      driverName: editingTruck.driver?.name || '',
      mobileNumber: editingTruck.driver?.mobile || '',
      licenseNumber: editingTruck.driver?.licenseNumber || '',
      licenseExpiry: editingTruck.driver?.licenseExpiry ? editingTruck.driver.licenseExpiry.slice(0, 10) : '',
      monthlySalary: editingTruck.driver?.salary ?? '',
      registrationDate: editingTruck.registrationDate ? editingTruck.registrationDate.slice(0, 10) : '',
      insuranceExpiry: editingTruck.insuranceExpiry ? editingTruck.insuranceExpiry.slice(0, 10) : '',
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.owner) return setError('Select a client to own this truck');
    if (!form.truckNumber || !form.model) return setError('Truck number and model are required');

    setSubmitting(true);
    try {
      const payload = {
        owner: form.owner,
        number: form.truckNumber,
        model: form.model,
        status: form.status,
        currentRoute: form.currentRoute,
        registrationDate: form.registrationDate || undefined,
        insuranceExpiry: form.insuranceExpiry || undefined,
        driver: {
          name: form.driverName,
          mobile: form.mobileNumber,
          licenseNumber: form.licenseNumber,
          licenseExpiry: form.licenseExpiry || undefined,
          salary: form.monthlySalary === '' ? undefined : Number(form.monthlySalary),
        },
      };
      if (editingTruck) {
        const truckId = editingTruck._id || editingTruck.id;
        await admin.updateTruck(truckId, payload);
      } else {
        await admin.createTruck(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save truck');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editingTruck ? 'Edit Truck' : 'Add Truck for Client'}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client (owner)</label>
            <select
              name="owner"
              value={form.owner}
              onChange={change}
              disabled={Boolean(editingTruck)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.company} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Truck Number</label>
              <input name="truckNumber" value={form.truckNumber} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input name="model" value={form.model} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Running">Running</option>
                <option value="Idle">Idle</option>
                <option value="Stopped">Stopped</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Route</label>
              <input name="currentRoute" value={form.currentRoute} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
              <input name="driverName" value={form.driverName} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
              <input name="mobileNumber" value={form.mobileNumber} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Number</label>
              <input name="licenseNumber" value={form.licenseNumber} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">License Expiry</label>
              <input type="date" name="licenseExpiry" value={form.licenseExpiry} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary (₹)</label>
              <input type="number" name="monthlySalary" value={form.monthlySalary} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Registration Date</label>
              <input type="date" name="registrationDate" value={form.registrationDate} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Expiry</label>
              <input type="date" name="insuranceExpiry" value={form.insuranceExpiry} onChange={change}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {submitting ? 'Saving...' : editingTruck ? 'Save Changes' : 'Add Truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminFleet() {
  const [trucks, setTrucks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | truck object being edited

  const load = async () => {
    try {
      const [trucksRes, usersRes] = await Promise.all([admin.listTrucks(), admin.listUsers()]);
      setTrucks(trucksRes.trucks);
      setClients(usersRes.users);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load fleet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (truck) => {
    const id = truck._id || truck.id;
    if (!confirm(`Remove truck ${truck.number}?`)) return;
    try {
      await admin.removeTruck(id);
      setTrucks((prev) => prev.filter((t) => (t._id || t.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove truck');
    }
  };

  const filtered = trucks.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.number.toLowerCase().includes(q) ||
      t.model.toLowerCase().includes(q) ||
      (t.owner?.company || '').toLowerCase().includes(q) ||
      (t.owner?.name || '').toLowerCase().includes(q)
    );
  });

  const statusColor = (status) => ({
    Running: 'bg-green-100 text-green-800',
    Idle: 'bg-yellow-100 text-yellow-800',
    Stopped: 'bg-red-100 text-red-800',
  }[status] || 'bg-slate-100 text-slate-800');

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fleet Oversight</h1>
              <p className="text-slate-600 mt-1">Every truck across every client</p>
            </div>
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Truck for Client
            </button>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by truck number, model, or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading && <div className="text-center py-12 text-slate-500">Loading fleet...</div>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {!loading && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Truck</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Client</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Driver</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Mobile</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.map((truck) => {
                      const id = truck._id || truck.id;
                      return (
                        <tr key={id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm">
                            <p className="font-medium text-blue-600">{truck.number}</p>
                            <p className="text-xs text-slate-500">{truck.model}</p>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <p className="text-slate-900">{truck.owner?.company || '—'}</p>
                            <p className="text-xs text-slate-500">{truck.owner?.name}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{truck.driver?.name || '—'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              {truck.driver?.mobile && <Phone className="w-4 h-4 text-slate-400" />}
                              {truck.driver?.mobile || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(truck.status)}`}>
                              {truck.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setModal(truck)}
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                title="Edit Truck"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => remove(truck)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Remove Truck"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <p className="p-6 text-sm text-slate-500 text-center">No trucks found.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {modal && (
        <TruckModal
          clients={clients}
          editingTruck={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
