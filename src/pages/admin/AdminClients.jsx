import { useEffect, useState } from 'react';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';

export function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

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
                            <button
                              onClick={() => toggleActive(client)}
                              disabled={updatingId === id}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                client.isActive
                                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              {client.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              {client.isActive ? 'Deactivate' : 'Activate'}
                            </button>
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
    </div>
  );
}
