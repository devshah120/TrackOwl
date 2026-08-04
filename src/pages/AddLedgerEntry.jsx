import { useState, useEffect } from 'react';
import { ChevronDown, LogOut, Menu, X, Bell, ArrowLeft, Upload, FileText as FileIcon, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, Calendar, Truck, Settings } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { ledger, fleet } from '../services/api';

// Receipt photos are downscaled in the browser before upload, so a phone
// snapshot of a fuel bill doesn't land in the database at full camera size.
// PDFs are passed through untouched — they cannot be drawn to a canvas.
const MAX_RECEIPT_WIDTH = 1200;
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

const readReceipt = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that file'));
  reader.onload = () => {
    if (file.type === 'application/pdf') {
      resolve({ dataUrl: reader.result, filename: file.name, mimeType: file.type });
      return;
    }
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a readable image or PDF'));
    img.onload = () => {
      const scale = Math.min(1, MAX_RECEIPT_WIDTH / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      // JPEG rather than PNG: receipts are photos, and PNG would be far larger.
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.8),
        filename: file.name,
        mimeType: 'image/jpeg',
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

export function AddLedgerEntry() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [trucks, setTrucks] = useState([]);
  // The attached receipt: { dataUrl, filename, mimeType }, or null for none.
  const [receipt, setReceipt] = useState(null);
  const [formData, setFormData] = useState({
    entryType: 'income',
    category: 'Fuel',
    description: '',
    amount: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    truck: '',
    driver: '',
  });

  // The fleet drives both dropdowns — drivers are filtered to the chosen truck.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fleet.list();
        if (!cancelled) setTrucks(res.trucks || []);
      } catch {
        // A failed fleet load must not block saving a plain entry, so the
        // dropdowns just stay empty and the rest of the form still works.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await ledger.list();
        const entry = res.entries.find((e) => (e._id || e.id) === id);
        if (!entry || cancelled) return;
        setFormData({
          entryType: entry.type,
          category: entry.category,
          description: entry.description || '',
          amount: entry.amount ?? '',
          paymentMethod: entry.paymentMethod,
          date: entry.date ? entry.date.slice(0, 10) : '',
          reference: entry.reference || '',
          truck: entry.truck?._id || entry.truck || '',
          driver: entry.driver?._id || entry.driver || '',
        });
        // The list omits the image itself; keep the metadata so the user sees
        // a receipt is attached, and only fetch the file if they preview it.
        if (entry.receipt?.filename) {
          setReceipt({
            dataUrl: '',
            filename: entry.receipt.filename,
            mimeType: entry.receipt.mimeType || '',
            stored: true,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load entry');
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  const driversOf = (truck) => {
    if (!truck) return [];
    if (truck.drivers?.length) return truck.drivers;
    return truck.driver ? [truck.driver] : [];
  };

  const selectedTruck = trucks.find((t) => (t._id || t.id) === formData.truck);
  const availableDrivers = driversOf(selectedTruck);

  const handleTruckChange = (e) => {
    const truckId = e.target.value;
    const truck = trucks.find((t) => (t._id || t.id) === truckId);
    const list = driversOf(truck);
    setFormData((prev) => ({
      ...prev,
      truck: truckId,
      // Default to the truck's primary driver; a truck with exactly one driver
      // needs no second choice at all.
      driver: truckId ? (list.find((d) => d.isPrimary)?._id || list[0]?._id || '') : '',
    }));
  };

  const handleReceiptChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a removal
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      setError('That receipt is too large — please upload a file under 3 MB.');
      return;
    }
    try {
      setError('');
      setReceipt(await readReceipt(file));
    } catch (err) {
      setError(err.message || 'Could not read that file');
    }
  };

  const previewReceipt = async () => {
    try {
      // Freshly picked files are already in memory; stored ones are fetched.
      const dataUrl = receipt.dataUrl || (await ledger.getReceipt(id)).receipt.dataUrl;
      const win = window.open();
      if (!win) return;
      if (receipt.mimeType === 'application/pdf') {
        win.location = dataUrl;
      } else {
        win.document.write(`<img src="${dataUrl}" style="max-width:100%">`);
      }
    } catch (err) {
      setError(err.message || 'Could not open that receipt');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips & Documents', icon: FileText },
    { id: 'ledger', label: 'Daily Ledger', icon: Calendar },
    { id: 'fleet', label: 'Fleet & Drivers', icon: Truck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (itemId) => {
    if (itemId === 'dashboard') {
      navigate('/dashboard');
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCancel = () => {
    navigate('/daily-ledger');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        type: formData.entryType,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        date: formData.date,
        reference: formData.reference,
        truck: formData.truck || '',
        driver: formData.driver || '',
      };

      // Only send `receipt` when it actually changed: omitting it leaves the
      // stored file alone, while null clears it.
      if (!receipt) {
        payload.receipt = null;
      } else if (receipt.dataUrl) {
        payload.receipt = {
          dataUrl: receipt.dataUrl,
          filename: receipt.filename,
          mimeType: receipt.mimeType,
        };
      }
      if (isEditing) {
        await ledger.update(id, payload);
      } else {
        await ledger.create(payload);
      }
      navigate('/daily-ledger');
    } catch (err) {
      setError(err.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-6xl mx-auto space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/daily-ledger')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{isEditing ? 'Edit Entry' : 'Add New Entry'}</h1>
              <p className="text-slate-600 mt-1">
                {isEditing ? 'Update this income or expense entry' : 'Create a new income or expense entry'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
            {/* Entry Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Entry Type</label>
              <select
                name="entryType"
                value={formData.entryType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Fuel</option>
                <option>Toll</option>
                <option>Salary</option>
                <option>Maintenance</option>
                <option>Trip</option>
                <option>Other</option>
              </select>
            </div>

            {/* Truck & Driver — which vehicle this money relates to. Optional,
                since office overheads belong to no truck. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Truck</label>
                <select
                  name="truck"
                  value={formData.truck}
                  onChange={handleTruckChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {trucks.length ? 'Not truck-specific' : 'No trucks in the fleet yet'}
                  </option>
                  {trucks.map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.number}{t.model ? ` — ${t.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Driver</label>
                <select
                  name="driver"
                  value={formData.driver}
                  onChange={handleInputChange}
                  disabled={!formData.truck}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {!formData.truck
                      ? 'Select a truck first'
                      : availableDrivers.length
                        ? 'Not driver-specific'
                        : 'No drivers on this truck'}
                  </option>
                  {availableDrivers.map((d) => (
                    <option key={d._id || d.id} value={d._id || d.id}>
                      {d.name}{d.isPrimary && availableDrivers.length > 1 ? ' (primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <input
                type="text"
                name="description"
                placeholder="e.g., Fuel - MH-01-AB-1234"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Amount and Payment Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  name="amount"
                  placeholder="0"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Bank Transfer</option>
                  <option>Card</option>
                  <option>UPI</option>
                </select>
              </div>
            </div>

            {/* Date and Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Reference</label>
                <input
                  type="text"
                  name="reference"
                  placeholder="e.g., INV-2026-001"
                  value={formData.reference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Receipt — the scanned bill backing this entry. */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Reference Receipt</label>
              {receipt ? (
                <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg bg-slate-50">
                  <FileIcon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">{receipt.filename}</p>
                    <p className="text-xs text-slate-500">
                      {receipt.stored ? 'Saved to this entry' : 'Ready to upload'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={previewReceipt}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove receipt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-700">Upload receipt</span>
                  <span className="text-xs text-slate-500 mt-0.5">JPG, PNG or PDF — up to 3 MB</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleReceiptChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Form Actions */}
            <div className="pt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
