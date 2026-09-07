import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Filter, Building2, Phone, AlertTriangle } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { customers as customersApi } from '../services/api';
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_COLORS } from '../constants/trip';

// Customer Master — the parties trips are booked for.
//
// Until this module, a customer existed only as free text on each billing trip,
// which meant the same company was re-typed for every consignment and nothing
// could be looked up across their trips. The billing records keep their own
// embedded consignor/consignee blocks — those are what historic LRs and
// invoices render from — while new trips point at a record here.
export function Customers() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = async () => {
    try {
      const res = await customersApi.list();
      setCustomers(res.customers || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => { await load(); })();
    // Runs once: the list is re-fetched explicitly after a delete rather than
    // by a dependency change.
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      const matches =
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.legalName || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.gstin || '').toLowerCase().includes(q) ||
        (c.billingAddress?.city || '').toLowerCase().includes(q);
      if (filterStatus === 'all') return matches;
      return matches && c.status === filterStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  const counts = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter((c) => c.status === 'Active').length,
      blacklisted: customers.filter((c) => c.status === 'Blacklisted').length,
    }),
    [customers]
  );

  const remove = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    try {
      await customersApi.remove(customer._id);
      await load();
    } catch (err) {
      // A customer with trips against it cannot be deleted; the server explains
      // why and suggests marking them Inactive instead.
      setError(err.message || 'Could not delete that customer');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
              <p className="text-slate-600 mt-1">
                Customer master — GSTIN, payment terms, contacts and billing addresses
              </p>
            </div>
            {can('customers', 'create') && (
              <button
                onClick={() => navigate('/customers/new')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Customer
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total Customers" value={counts.total} icon={Building2} bg="bg-blue-50" fg="text-blue-600" />
            <StatTile label="Active" value={counts.active} icon={Building2} bg="bg-green-50" fg="text-green-600" />
            <StatTile label="Blacklisted" value={counts.blacklisted} icon={AlertTriangle} bg="bg-red-50" fg="text-red-600" />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, code, GSTIN or city..."
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
                  {CUSTOMER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">GSTIN</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">City</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Terms</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        Loading customers...
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        {customers.length === 0
                          ? 'No customers yet. Add one so trips can be booked against it.'
                          : 'No customers match this search.'}
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.map((customer) => {
                    const primary =
                      customer.contacts?.find((c) => c.isPrimary) || customer.contacts?.[0];
                    return (
                      <tr key={customer._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-slate-900">{customer.name}</p>
                          {customer.legalName && customer.legalName !== customer.name && (
                            <p className="text-xs text-slate-500">{customer.legalName}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{customer.code || '—'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{customer.gstin || '—'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {customer.billingAddress?.city || '—'}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {primary ? (
                            <>
                              {primary.name}
                              {primary.mobile && (
                                <span className="block text-xs text-slate-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {primary.mobile}
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {customer.paymentTerms || '—'}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              CUSTOMER_STATUS_COLORS[customer.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {customer.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {can('customers', 'update') && (
                              <button
                                onClick={() => navigate(`/customers/${customer._id}`)}
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can('customers', 'delete') && (
                              <button
                                onClick={() => remove(customer)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </div>
      </main>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, bg, fg }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${fg}`} />
      </div>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
