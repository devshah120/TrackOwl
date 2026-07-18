import { useEffect, useState } from 'react';
import { Search, CheckCircle2, XCircle, Edit2, Trash2, X } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';

const FLEET_SIZES = ['1–5 trucks', '6–20 trucks', '21–50 trucks', '50+ trucks'];

function EditClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: client.name || '',
    email: client.email || '',
    mobile: client.mobile || '',
    company: client.company || '',
    fleet: client.fleet || FLEET_SIZES[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await admin.updateUser(client._id || client.id, form);
      onSaved(res.user);
    } catch (err) {
      setError(err.message || 'Failed to update client');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Edit Client</h2>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input name="name" value={form.name} onChange={change}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" name="email" value={form.email} onChange={change}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
            <input name="mobile" value={form.mobile} onChange={change}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
            <input name="company" value={form.company} onChange={change}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fleet Size</label>
            <select name="fleet" value={form.fleet} onChange={change}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {FLEET_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);

  const load = async () => {
    try {
      const res = await admin.listUsers();
      setClients(res.users);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (client) => {
    const id = client._id || client.id;
    setUpdatingId(id);
    try {
      const res = await admin.setUserStatus(id, !client.isActive);
      setClients((prev) => prev.map((c) => ((c._id || c.id) === id ? { ...c, isActive: res.user.isActive } : c)));
    } catch (err) {
      setError(err.message || 'Failed to update client');
    } finally {
      setUpdatingId(null);
    }
  };

  const removeClient = async (client) => {
    const id = client._id || client.id;
    if (!confirm(`Remove ${client.name} (${client.company})? Their trucks and ledger entries will be deleted too.`)) return;
    try {
      await admin.removeUser(id);
      setClients((prev) => prev.filter((c) => (c._id || c.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove client');
    }
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-600 mt-1">Every registered account on the platform</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading && <div className="text-center py-12 text-slate-500">Loading clients...</div>}
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
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Client</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Company</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Fleet Size</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Trucks</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.map((client) => {
                      const id = client._id || client.id;
                      return (
                        <tr key={id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm">
                            <p className="font-medium text-slate-900">{client.name}</p>
                            <p className="text-xs text-slate-500">{client.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{client.company}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{client.fleet}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">{client.truckCount}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              client.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {client.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleActive(client)}
                                disabled={updatingId === id}
                                title={client.isActive ? 'Deactivate' : 'Activate'}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  client.isActive
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                {client.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {client.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => setEditingClient(client)}
                                title="Edit Client"
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeClient(client)}
                                title="Remove Client"
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
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
                <p className="p-6 text-sm text-slate-500 text-center">No clients found.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={(updated) => {
            setClients((prev) => prev.map((c) => ((c._id || c.id) === (updated._id || updated.id) ? { ...c, ...updated } : c)));
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}
