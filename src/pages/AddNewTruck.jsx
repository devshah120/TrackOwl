import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut, Menu, X, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, Calendar, Truck, Settings } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { DocumentsSection } from '../components/DocumentsSection';
import { usePermissions } from '../hooks/usePermissions';
import { fleet, vehicleDocuments } from '../services/api';
import {
  VEHICLE_TYPES,
  FUEL_TYPES,
  BODY_TYPES,
  VEHICLE_STATUSES,
} from '../constants/vehicle';
import { VEHICLE_DOCUMENT_TYPES, VEHICLE_DOCUMENT_LABELS } from '../constants/documents';

// Every field in this form wears the same box; naming it keeps the markup
// readable now that there are four sections of them.
const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export function AddNewTruck() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Documents captured on a *new* vehicle have nowhere to be filed until the
  // truck exists, so the section buffers them and this ref flushes them once
  // the create call returns an id.
  const documentsRef = useRef(null);
  // Flat form state: the nested capacity/purchase shape the API expects is
  // assembled at submit time, which keeps every input a plain controlled field.
  const [formData, setFormData] = useState({
    truckNumber: '',
    model: '',
    registrationDate: '',
    insuranceExpiry: '',
    vehicleType: 'Truck',
    make: '',
    manufactureYear: '',
    fuelType: 'Diesel',
    odometer: '',
    status: 'Idle',
    capacityWeightKg: '',
    capacityVolumeM3: '',
    bodyType: 'Open',
    purchaseDate: '',
    purchasePrice: '',
    purchaseVendor: '',
    financedBy: '',
  });

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fleet.list();
        const truck = res.trucks.find((t) => (t._id || t.id) === id);
        if (!truck || cancelled) return;
        // `?? ''` rather than `|| ''` for the numbers: a genuine 0 odometer or
        // price must survive into the field instead of showing as blank.
        setFormData({
          truckNumber: truck.number || '',
          model: truck.model || '',
          registrationDate: truck.registrationDate ? truck.registrationDate.slice(0, 10) : '',
          insuranceExpiry: truck.insuranceExpiry ? truck.insuranceExpiry.slice(0, 10) : '',
          vehicleType: truck.vehicleType || 'Truck',
          make: truck.make || '',
          manufactureYear: truck.manufactureYear ?? '',
          fuelType: truck.fuelType || 'Diesel',
          odometer: truck.odometer ?? '',
          status: truck.status || 'Idle',
          capacityWeightKg: truck.capacity?.weightKg ?? '',
          capacityVolumeM3: truck.capacity?.volumeM3 ?? '',
          bodyType: truck.capacity?.bodyType || 'Open',
          purchaseDate: truck.purchase?.date ? truck.purchase.date.slice(0, 10) : '',
          purchasePrice: truck.purchase?.price ?? '',
          purchaseVendor: truck.purchase?.vendor || '',
          financedBy: truck.purchase?.financedBy || '',
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load truck');
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

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
    navigate('/fleet-and-drivers');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setSubmitting(true);
    try {
      const payload = {
        number: formData.truckNumber,
        model: formData.model,
        registrationDate: formData.registrationDate || undefined,
        insuranceExpiry: formData.insuranceExpiry || undefined,
        vehicleType: formData.vehicleType,
        make: formData.make,
        manufactureYear: formData.manufactureYear === '' ? null : Number(formData.manufactureYear),
        fuelType: formData.fuelType,
        odometer: formData.odometer === '' ? 0 : Number(formData.odometer),
        status: formData.status,
        capacity: {
          weightKg: formData.capacityWeightKg === '' ? null : Number(formData.capacityWeightKg),
          volumeM3: formData.capacityVolumeM3 === '' ? null : Number(formData.capacityVolumeM3),
          bodyType: formData.bodyType,
        },
        purchase: {
          date: formData.purchaseDate || undefined,
          price: formData.purchasePrice === '' ? null : Number(formData.purchasePrice),
          vendor: formData.purchaseVendor,
          financedBy: formData.financedBy,
        },
      };
      if (isEditing) {
        // Documents on an existing truck are written straight through by the
        // section itself, so there is nothing to flush here.
        await fleet.update(id, payload);
      } else {
        const res = await fleet.create(payload);
        const newId = res.truck?._id || res.truck?.id;
        // The truck is saved either way; only the paperwork can fail here, so
        // it is reported without losing the vehicle the operator just created.
        try {
          await documentsRef.current?.flush(newId);
        } catch (docErr) {
          setError(
            `Vehicle saved, but a document could not be attached: ${docErr.message || 'unknown error'}. ` +
            'Open the vehicle again to re-add it.'
          );
          setSubmitting(false);
          return;
        }
      }
      navigate('/fleet-and-drivers');
    } catch (err) {
      setError(err.message || 'Failed to save truck');
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
              onClick={() => navigate('/fleet-and-drivers')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</h1>
              <p className="text-slate-600 mt-1">
                {isEditing ? 'Update vehicle details' : 'Register a new vehicle'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vehicle Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Vehicle Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle Number</label>
                  <input
                    type="text"
                    name="truckNumber"
                    placeholder="e.g., MH-01-AB-1234"
                    value={formData.truckNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
                  <input
                    type="text"
                    name="model"
                    placeholder="e.g., Tata 407"
                    value={formData.model}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Details — registration, classification and status. */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Vehicle Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Registration Date</label>
                  <input
                    type="date"
                    name="registrationDate"
                    value={formData.registrationDate}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Insurance Expiry</label>
                  <input
                    type="date"
                    name="insuranceExpiry"
                    value={formData.insuranceExpiry}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle Type</label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Make</label>
                  <input
                    type="text"
                    name="make"
                    placeholder="e.g., Tata"
                    value={formData.make}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Manufacture Year</label>
                  <input
                    type="number"
                    name="manufactureYear"
                    placeholder="e.g., 2021"
                    min="1980"
                    max={new Date().getFullYear() + 1}
                    value={formData.manufactureYear}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fuel Type</label>
                  <select
                    name="fuelType"
                    value={formData.fuelType}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Odometer (km)</label>
                  <input
                    type="number"
                    name="odometer"
                    placeholder="0"
                    min="0"
                    value={formData.odometer}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                  {isEditing && (
                    <p className="mt-1 text-xs text-slate-500">
                      An odometer reading can only be increased.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    {VEHICLE_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Capacity — what the vehicle can carry. */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Capacity</h2>
              <p className="text-sm text-slate-500 mb-4">
                Used to match vehicles against load requirements when planning trips.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payload Weight (kg)</label>
                  <input
                    type="number"
                    name="capacityWeightKg"
                    placeholder="e.g., 9000"
                    min="0"
                    value={formData.capacityWeightKg}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Volume (m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="capacityVolumeM3"
                    placeholder="e.g., 32"
                    min="0"
                    value={formData.capacityVolumeM3}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Body Type</label>
                  <select
                    name="bodyType"
                    value={formData.bodyType}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    {BODY_TYPES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Purchase Details — how the asset was acquired. */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Purchase Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Date</label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Price (₹)</label>
                  <input
                    type="number"
                    name="purchasePrice"
                    placeholder="0"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vendor / Dealer</label>
                  <input
                    type="text"
                    name="purchaseVendor"
                    placeholder="e.g., Sharma Motors"
                    value={formData.purchaseVendor}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Financed By</label>
                  <input
                    type="text"
                    name="financedBy"
                    placeholder="Bank or NBFC — leave blank if owned outright"
                    value={formData.financedBy}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Documents — RC, insurance, PUC, fitness, permit and road
                tax, each with its own number, dates and scanned copy. */}
            <DocumentsSection
              ref={documentsRef}
              ownerId={isEditing ? id : null}
              api={vehicleDocuments}
              ownerKey="truck"
              types={VEHICLE_DOCUMENT_TYPES}
              labels={VEHICLE_DOCUMENT_LABELS}
              canEdit={can('trucks', isEditing ? 'update' : 'create')}
              title="Vehicle Documents"
              description="RC, insurance, PUC, fitness, permit and road tax. Anything with an expiry date is chased in the notification bell."
            />

            {/* Form Actions */}
            <div className="flex gap-3">
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
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Vehicle'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
