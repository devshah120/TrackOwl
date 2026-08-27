import { useState, useEffect } from 'react';
import { ChevronDown, LogOut, Menu, X, Bell, ArrowLeft, Plus, Trash2, Star } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, Calendar, Truck, Settings } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { fleet } from '../services/api';
import {
  VEHICLE_TYPES,
  FUEL_TYPES,
  BODY_TYPES,
  VEHICLE_STATUSES,
} from '../constants/vehicle';

// One blank driver row. `_id` is absent until the server assigns one, which is
// how the backend tells a new driver from an edit of an existing one.
const emptyDriver = () => ({
  name: '',
  mobile: '',
  licenseNumber: '',
  licenseExpiry: '',
  salary: '',
  isPrimary: false,
});

// Every field in this form wears the same box; naming it keeps the markup
// readable now that there are four sections of them.
const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export function AddNewTruck() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
  // A truck carries one or more drivers; the first row starts out primary.
  const [drivers, setDrivers] = useState([{ ...emptyDriver(), isPrimary: true }]);

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

        // Fall back to the legacy single `driver` for trucks saved before
        // drivers moved to their own collection and not yet migrated.
        const existing = truck.drivers?.length
          ? truck.drivers
          : truck.driver
            ? [truck.driver]
            : [];

        setDrivers(
          existing.length
            ? existing.map((d, i) => ({
                _id: d._id || d.id,
                name: d.name || '',
                mobile: d.mobile || '',
                licenseNumber: d.licenseNumber || '',
                licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : '',
                salary: d.salary ?? '',
                isPrimary: d.isPrimary ?? i === 0,
              }))
            : [{ ...emptyDriver(), isPrimary: true }]
        );
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load truck');
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  const handleDriverChange = (index, field, value) => {
    setDrivers((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const addDriver = () => setDrivers((prev) => [...prev, emptyDriver()]);

  const removeDriver = (index) => {
    setDrivers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!next.length) return [{ ...emptyDriver(), isPrimary: true }];
      // Dropping the primary leaves none — promote the first remaining row.
      if (!next.some((d) => d.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };

  // Primary is exclusive: marking one clears the rest.
  const setPrimary = (index) =>
    setDrivers((prev) => prev.map((d, i) => ({ ...d, isPrimary: i === index })));

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

    // Rows left completely blank are dropped rather than rejected, so an extra
    // row added by mistake doesn't block the save.
    const filled = drivers.filter((d) => d.name.trim() || d.mobile.trim());
    const incomplete = filled.find((d) => !d.name.trim() || !/^\d{10}$/.test(d.mobile.trim()));
    if (incomplete) {
      setError('Every driver needs a name and a valid 10-digit mobile number.');
      return;
    }

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
        drivers: filled.map((d) => ({
          ...(d._id ? { _id: d._id } : {}),
          name: d.name.trim(),
          mobile: d.mobile.trim(),
          licenseNumber: d.licenseNumber,
          licenseExpiry: d.licenseExpiry || undefined,
          salary: d.salary === '' ? undefined : Number(d.salary),
          isPrimary: Boolean(d.isPrimary),
        })),
      };
      if (isEditing) {
        await fleet.update(id, payload);
      } else {
        await fleet.create(payload);
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
              <h1 className="text-3xl font-bold text-slate-900">{isEditing ? 'Edit Truck' : 'Add New Truck'}</h1>
              <p className="text-slate-600 mt-1">
                {isEditing ? 'Update truck and driver details' : 'Register a new truck and assign a driver'}
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
            {/* Truck Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Truck Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Truck Number</label>
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

            {/* Driver Details — a truck can carry several drivers. */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-900">Driver Details</h2>
                <button
                  type="button"
                  onClick={addDriver}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Driver
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Assign one or more drivers to this truck. The primary driver is the one shown on
                the fleet list and used as the default on trip documents.
              </p>

              <div className="space-y-4">
                {drivers.map((driver, index) => (
                  <div
                    key={driver._id || index}
                    className={`rounded-lg border p-4 ${
                      driver.isPrimary ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          Driver {index + 1}
                        </span>
                        {driver.isPrimary && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!driver.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimary(index)}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Make this the primary driver"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Set as primary
                          </button>
                        )}
                        {drivers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDriver(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove this driver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Driver Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Rajesh Kumar"
                          value={driver.name}
                          onChange={(e) => handleDriverChange(index, 'name', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Mobile Number</label>
                        <input
                          type="tel"
                          placeholder="e.g., 9876543210"
                          value={driver.mobile}
                          onChange={(e) => handleDriverChange(index, 'mobile', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">License Number</label>
                        <input
                          type="text"
                          placeholder="e.g., DL-0219950000123"
                          value={driver.licenseNumber}
                          onChange={(e) => handleDriverChange(index, 'licenseNumber', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">License Expiry</label>
                        <input
                          type="date"
                          value={driver.licenseExpiry}
                          onChange={(e) => handleDriverChange(index, 'licenseExpiry', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Monthly Salary (₹)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={driver.salary}
                          onChange={(e) => handleDriverChange(index, 'salary', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Truck'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
