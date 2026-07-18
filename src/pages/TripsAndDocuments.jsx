import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, FileText, Download, Eye, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';
import { billing } from '../services/api';

export function TripsAndDocuments() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('trips');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [paymentForm, setPaymentForm] = useState({ paymentType: 'Full Payment', amount: '', paymentMethod: 'Cash', date: '' });
  const [editForm, setEditForm] = useState({ truck: '', lr: '', bill: '', partyName: '', amount: '', date: '', status: 'Pending' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await billing.list();
        if (!cancelled) setTrips(res.billingTrips);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load trips');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.truck.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trip.lr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trip.bill || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const handleDeleteTrip = async (id) => {
    try {
      await billing.remove(id);
      setTrips((prev) => prev.filter((trip) => (trip._id || trip.id) !== id));
    } catch (err) {
      setLoadError(err.message || 'Failed to delete trip');
    }
  };

  const openPaymentModal = (trip) => {
    setSelectedTrip(trip);
    setPaymentForm({ paymentType: 'Full Payment', amount: String(trip.amount), paymentMethod: 'Cash', date: new Date().toISOString().slice(0, 10) });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedTrip) return;
    setSavingPayment(true);
    try {
      const tripId = selectedTrip._id || selectedTrip.id;
      const status = paymentForm.paymentType === 'Full Payment' ? 'Paid' : 'Partial';
      const res = await billing.update(tripId, { status, amount: Number(paymentForm.amount) });
      setTrips((prev) => prev.map((t) => ((t._id || t.id) === tripId ? res.billingTrip : t)));
      setShowPaymentModal(false);
    } catch (err) {
      setLoadError(err.message || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const openEditModal = (trip) => {
    setSelectedTrip(trip);
    setEditForm({
      truck: trip.truck,
      lr: trip.lr || '',
      bill: trip.bill || '',
      partyName: trip.partyName,
      amount: String(trip.amount),
      date: trip.date ? trip.date.slice(0, 10) : '',
      status: trip.status,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTrip) return;
    setSavingEdit(true);
    try {
      const tripId = selectedTrip._id || selectedTrip.id;
      const payload = { ...editForm, amount: Number(editForm.amount) };
      const res = await billing.update(tripId, payload);
      setTrips((prev) => prev.map((t) => ((t._id || t.id) === tripId ? res.billingTrip : t)));
      setShowEditModal(false);
    } catch (err) {
      setLoadError(err.message || 'Failed to save trip');
    } finally {
      setSavingEdit(false);
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

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">Loading trips...</div>
      )}

      {/* Trips Table */}
      {!loading && activeTab === 'trips' && (
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
                {filteredTrips.map((trip) => {
                  const tripId = trip._id || trip.id;
                  return (
                  <tr key={tripId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{tripId}</td>
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
                          onClick={() => openPaymentModal(trip)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                          title="Record Payment"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(trip)}
                          className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrip(tripId)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                          title="Delete"
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
        </div>
      )}

      {/* Documents Tab */}
      {!loading && activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => (
            <div key={trip._id || trip.id} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{trip._id || trip.id}</h3>
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
                    <p className="text-lg font-semibold text-slate-900">{selectedTrip._id || selectedTrip.id}</p>
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
                <select
                  value={paymentForm.paymentType}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Full Payment</option>
                  <option>Partial Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
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
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
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
                  onClick={handleRecordPayment}
                  disabled={savingPayment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {savingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trip Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Edit Trip</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Truck</label>
                <input
                  type="text"
                  value={editForm.truck}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, truck: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">LR</label>
                  <input
                    type="text"
                    value={editForm.lr}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, lr: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bill</label>
                  <input
                    type="text"
                    value={editForm.bill}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, bill: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Party Name</label>
                <input
                  type="text"
                  value={editForm.partyName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, partyName: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹)</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Paid</option>
                  <option>Partial</option>
                  <option>Pending</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
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
