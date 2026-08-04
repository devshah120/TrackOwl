import { useState, useEffect } from 'react';
import { ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';
import { billing, drivers as driversApi } from '../services/api';

// Dates come back from the API as ISO strings but the <input type="date">
// fields want plain YYYY-MM-DD.
const asDateInput = (value) => (value ? String(value).slice(0, 10) : '');

// Numeric fields render as text inputs, so 0 defaults are shown as empty
// rather than a literal "0" the user has to clear before typing.
const asNumberInput = (value) => (value === 0 || value === undefined || value === null ? '' : String(value));

export function AddNewTrip() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // The real driver roster. A truck can carry several drivers, so this lists
  // every driver the client has and shows which truck each is assigned to —
  // picking one fills in the truck as well.
  const [drivers, setDrivers] = useState([]);
  const [driversError, setDriversError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await driversApi.list();
        if (cancelled) return;
        setDrivers(
          res.drivers.map((d) => ({
            id: d._id || d.id,
            name: d.name,
            mobile: d.mobile || '',
            salary: d.salary,
            licenseNumber: d.licenseNumber || '',
            licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : '',
            truckNumber: d.truck?.number || '',
            truckModel: d.truck?.model || '',
            isPrimary: d.isPrimary,
          }))
        );
      } catch (err) {
        if (!cancelled) setDriversError(err.message || 'Failed to load drivers');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Editing an existing trip: pull the saved record and refill the whole form,
  // so the same page serves both "create" and "edit" rather than a cut-down
  // modal that could only reach a handful of fields.
  const [loadingTrip, setLoadingTrip] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await billing.list();
        const trip = res.billingTrips.find((t) => (t._id || t.id) === id);
        if (cancelled) return;
        if (!trip) {
          setSaveError('That trip could not be found.');
          return;
        }

        const r = trip.references || {};
        const g = trip.goods || {};
        const p = trip.payment || {};

        setFormData((prev) => ({
          ...prev,
          tripDate: asDateInput(trip.date),
          truckNumber: trip.truck || '',
          driverName: trip.driver?.name || '',
          driverMobile: trip.driver?.mobile || '',
          driverLicenseNumber: trip.driver?.licenseNumber || '',
          // The route field is a single "From → To" string on this form.
          route: [trip.fromLocation, trip.toLocation].filter(Boolean).join(' → '),
          loadingDate: asDateInput(trip.loadingDate),
          deliveryDate: asDateInput(trip.deliveryDate),

          lrNumber: trip.lr || '',
          billNumber: trip.bill || '',
          invoiceNo: trip.invoiceNo || '',
          gstPayableBy: trip.gstPayableBy || 'Consignee',
          lrCharges: asNumberInput(trip.lrCharges),
          gstRate: asNumberInput(trip.gstRate),

          deliveryNote: r.deliveryNote || '',
          paymentTerms: r.paymentTerms || '',
          supplierRef: r.supplierRef || '',
          otherRef: r.otherRef || '',
          buyerOrderNo: r.buyerOrderNo || '',
          buyerOrderDate: r.buyerOrderDate || '',
          despatchDocNo: r.despatchDocNo || '',
          deliveryNoteDate: r.deliveryNoteDate || '',
          despatchedThrough: r.despatchedThrough || '',
          destination: r.destination || '',
          termsOfDelivery: r.termsOfDelivery || '',

          supplierName: trip.consignor?.name || '',
          supplierGst: trip.consignor?.gst || '',
          supplierAddress: trip.consignor?.address || '',
          supplierContact: trip.consignor?.contact || '',

          buyerName: trip.consignee?.name || trip.partyName || '',
          buyerGst: trip.consignee?.gst || '',
          buyerAddress: trip.consignee?.address || '',
          buyerContact: trip.consignee?.contact || '',

          goodsDescription: g.description || '',
          quantity: asNumberInput(g.quantity),
          unit: g.unit || 'Kg',
          totalWeight: asNumberInput(g.weight),
          weightUnit: g.weightUnit || 'Kg',
          declaredValue: asNumberInput(g.declaredValue),
          freightRate: asNumberInput(g.freightRate),
          totalFreightAmount: asNumberInput(trip.amount),

          paymentMethod: p.method || 'Bank Transfer',
          // Status on the record is payment state; this form words fully paid
          // as "Completed" (see toBillingStatus).
          paymentStatus: trip.status === 'Paid' ? 'Completed' : trip.status || 'Pending',
          advanceAmount: asNumberInput(p.advance),
          balanceAmount: asNumberInput(p.balance),
          paymentNotes: p.notes || '',
        }));
      } catch (err) {
        if (!cancelled) setSaveError(err.message || 'Failed to load trip');
      } finally {
        if (!cancelled) setLoadingTrip(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  // The saved trip stores the driver's details, not which roster entry they
  // came from. Once both have loaded, match them back up so the dropdown shows
  // the right driver instead of sitting blank on an otherwise filled form.
  useEffect(() => {
    if (!isEditing || !drivers.length) return;
    setFormData((prev) => {
      if (prev.driverId || !prev.driverName) return prev;
      const match = drivers.find(
        (d) =>
          d.name === prev.driverName &&
          (!prev.driverMobile || d.mobile === prev.driverMobile)
      );
      return match ? { ...prev, driverId: match.id } : prev;
    });
  }, [drivers, isEditing]);

  // Form state
  const [formData, setFormData] = useState({
    // Basic Trip Information
    tripDate: '',
    truckNumber: '',
    driverId: '',
    driverName: '',
    driverMobile: '',
    driverLicenseNumber: '',
    route: '',
    loadingDate: '',
    deliveryDate: '',
    status: 'In Transit',

    // Document references printed on the LR / invoice.
    lrNumber: '',
    billNumber: '',
    invoiceNo: '',
    gstPayableBy: 'Consignee',
    lrCharges: '',
    gstRate: '',

    // Reference boxes across the head of the tax invoice.
    deliveryNote: '',
    paymentTerms: '',
    supplierRef: '',
    otherRef: '',
    buyerOrderNo: '',
    buyerOrderDate: '',
    despatchDocNo: '',
    deliveryNoteDate: '',
    despatchedThrough: '',
    destination: '',
    termsOfDelivery: '',

    // Party Details - Supplier
    supplierName: '',
    supplierGst: '',
    supplierAddress: '',
    supplierContact: '',

    // Party Details - Buyer
    buyerName: '',
    buyerGst: '',
    buyerAddress: '',
    buyerContact: '',

    // Goods Details
    goodsDescription: '',
    quantity: '',
    unit: 'Kg',
    totalWeight: '',
    weightUnit: 'Kg',
    declaredValue: '',
    freightRate: '',
    totalFreightAmount: '',

    // Payment Details
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Pending',
    advanceAmount: '',
    balanceAmount: '',
    paymentNotes: '',
  });

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
    { id: 'trips', label: 'Trips & Documents', icon: Calendar },
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDriverChange = (e) => {
    const driverId = e.target.value;
    const selectedDriver = drivers.find((d) => d.id === driverId);

    if (selectedDriver) {
      setFormData((prev) => ({
        ...prev,
        driverId: driverId,
        driverName: selectedDriver.name,
        driverMobile: selectedDriver.mobile,
        driverLicenseNumber: selectedDriver.licenseNumber,
        truckNumber: selectedDriver.truckNumber,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        driverId: '',
        driverName: '',
        driverMobile: '',
        driverLicenseNumber: '',
        truckNumber: '',
      }));
    }
  };

  const handleCalculateFreight = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const rate = parseFloat(formData.freightRate) || 0;
    const total = (quantity * rate).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      totalFreightAmount: total,
    }));
  };

  const handleCalculateBalance = () => {
    const totalFreight = parseFloat(formData.totalFreightAmount) || 0;
    const advance = parseFloat(formData.advanceAmount) || 0;
    const balance = (totalFreight - advance).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      balanceAmount: balance < 0 ? 0 : balance,
    }));
  };

  // The billing record only tracks payment state, so the trip's own
  // In Transit/Delivered status is not what the Status column shows —
  // Payment Status is. 'Completed' is that form's wording for fully paid.
  const toBillingStatus = (paymentStatus) =>
    paymentStatus === 'Completed' ? 'Paid' : paymentStatus === 'Partial' ? 'Partial' : 'Pending';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');

    // Freight total is filled by the Calculate button; fall back to
    // quantity × rate so a trip is never saved with a zero amount.
    const amount =
      parseFloat(formData.totalFreightAmount) ||
      (parseFloat(formData.quantity) || 0) * (parseFloat(formData.freightRate) || 0);

    if (!amount) {
      setSaveError('Enter a freight rate and quantity, or click "Calculate Total Freight".');
      return;
    }

    // "Mumbai → Bangalore" is how the route field is prompted; split it so the
    // LR's From and To boxes are filled separately. An unsplittable value goes
    // to From whole rather than being dropped.
    const [from, to] = formData.route.split(/\s*(?:→|->|to)\s*/i);

    setSaving(true);
    try {
      const payload = {
        truck: formData.truckNumber,
        partyName: formData.buyerName,
        amount,
        date: formData.tripDate,
        status: toBillingStatus(formData.paymentStatus),

        lr: formData.lrNumber,
        bill: formData.billNumber,
        invoiceNo: formData.invoiceNo,
        fromLocation: (from || '').trim(),
        toLocation: (to || '').trim(),
        gstPayableBy: formData.gstPayableBy,
        lrCharges: formData.lrCharges,
        gstRate: formData.gstRate,
        references: {
          deliveryNote: formData.deliveryNote,
          paymentTerms: formData.paymentTerms || formData.paymentMethod,
          supplierRef: formData.supplierRef,
          otherRef: formData.otherRef,
          buyerOrderNo: formData.buyerOrderNo,
          buyerOrderDate: formData.buyerOrderDate,
          despatchDocNo: formData.despatchDocNo,
          deliveryNoteDate: formData.deliveryNoteDate,
          despatchedThrough: formData.despatchedThrough || formData.truckNumber,
          destination: formData.destination,
          termsOfDelivery: formData.termsOfDelivery,
        },
        loadingDate: formData.loadingDate,
        deliveryDate: formData.deliveryDate,

        consignor: {
          name: formData.supplierName,
          gst: formData.supplierGst,
          address: formData.supplierAddress,
          contact: formData.supplierContact,
        },
        consignee: {
          name: formData.buyerName,
          gst: formData.buyerGst,
          address: formData.buyerAddress,
          contact: formData.buyerContact,
        },
        goods: {
          description: formData.goodsDescription,
          quantity: formData.quantity,
          unit: formData.unit,
          weight: formData.totalWeight,
          weightUnit: formData.weightUnit,
          declaredValue: formData.declaredValue,
          freightRate: formData.freightRate,
        },
        driver: {
          name: formData.driverName,
          mobile: formData.driverMobile,
          licenseNumber: formData.driverLicenseNumber,
        },
        payment: {
          method: formData.paymentMethod,
          advance: formData.advanceAmount,
          balance: formData.balanceAmount,
          notes: formData.paymentNotes,
        },
      };

      if (isEditing) {
        await billing.update(id, payload);
      } else {
        await billing.create(payload);
      }
      navigate('/trips-and-documents');
    } catch (err) {
      setSaveError(err.message || (isEditing ? 'Failed to save trip' : 'Failed to create trip'));
      setSaving(false);
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
              onClick={() => navigate('/trips-and-documents')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditing ? 'Edit Trip' : 'Add New Trip'}
              </h1>
              <p className="text-slate-600 mt-1">
                {isEditing
                  ? 'Update any detail of this trip, its documents, or its payment'
                  : 'Fill in all the details to create a new trip'}
              </p>
            </div>
          </div>

          {loadingTrip && (
            <div className="text-center py-12 text-slate-500">Loading trip...</div>
          )}

          {/* Form. Hidden until an edited trip has loaded, so the fields are
              never briefly blank before being filled in. */}
          <form onSubmit={handleSubmit} className={`space-y-6 ${loadingTrip ? 'hidden' : ''}`}>
            {/* Basic Trip Information */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Trip Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Trip Date</label>
                  <input
                    type="date"
                    name="tripDate"
                    value={formData.tripDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Route (From → To)</label>
                  <input
                    type="text"
                    name="route"
                    placeholder="e.g., Mumbai → Bangalore"
                    value={formData.route}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Loading Date</label>
                  <input
                    type="date"
                    name="loadingDate"
                    value={formData.loadingDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Date</label>
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>In Transit</option>
                    <option>Delivered</option>
                    <option>Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document References */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Document References</h2>
              <p className="text-sm text-slate-500 mb-4">
                Printed on the Lorry Receipt, Tax Invoice and Goods Declaration.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">LR Number</label>
                  <input
                    type="text"
                    name="lrNumber"
                    placeholder="e.g., 80101"
                    value={formData.lrNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bill Number</label>
                  <input
                    type="text"
                    name="billNumber"
                    placeholder="e.g., BILL-2201"
                    value={formData.billNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Number</label>
                  <input
                    type="text"
                    name="invoiceNo"
                    placeholder="e.g., INV-2201"
                    value={formData.invoiceNo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">GST Payable By</label>
                  <select
                    name="gstPayableBy"
                    value={formData.gstPayableBy}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Consignor</option>
                    <option>Consignee</option>
                    <option>Transporter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">L.R. Charges (₹)</label>
                  <input
                    type="number"
                    name="lrCharges"
                    placeholder="0"
                    value={formData.lrCharges}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">GST Rate (%)</label>
                  <input
                    type="number"
                    name="gstRate"
                    placeholder="e.g., 5"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.gstRate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Applied to freight + LR charges on the invoice.</p>
                </div>
              </div>
            </div>

            {/* Invoice References */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Invoice References</h2>
              <p className="text-sm text-slate-500 mb-4">
                Optional. These fill the reference boxes across the top of the Tax Invoice.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'deliveryNote', label: 'Delivery Note', placeholder: 'e.g., DN-77' },
                  { name: 'paymentTerms', label: 'Mode / Terms of Payment', placeholder: 'e.g., 30 Days Credit' },
                  { name: 'supplierRef', label: "Supplier's Ref.", placeholder: 'e.g., SR-12' },
                  { name: 'otherRef', label: 'Other Reference(s)', placeholder: 'Optional' },
                  { name: 'buyerOrderNo', label: "Buyer's Order No.", placeholder: 'e.g., PO-9081' },
                  { name: 'buyerOrderDate', label: "Buyer's Order Date", placeholder: 'e.g., 01-Aug-26' },
                  { name: 'despatchDocNo', label: 'Despatch Document No.', placeholder: 'e.g., DD-455' },
                  { name: 'deliveryNoteDate', label: 'Delivery Note Date', placeholder: 'e.g., 02-Aug-26' },
                  { name: 'destination', label: 'Destination', placeholder: 'Defaults to the route "To"' },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                    <input
                      type="text"
                      name={field.name}
                      placeholder={field.placeholder}
                      value={formData[field.name]}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Terms of Delivery</label>
                  <input
                    type="text"
                    name="termsOfDelivery"
                    placeholder="e.g., Door delivery at consignee premises"
                    value={formData.termsOfDelivery}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle & Driver Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Vehicle & Driver Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Driver</label>
                  <select
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleDriverChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {drivers.length ? 'Choose a driver...' : 'No drivers on the roster yet'}
                    </option>
                    {/* Trucks can share several drivers, so the truck number is
                        part of the label to tell them apart. */}
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                        {driver.truckNumber ? ` — ${driver.truckNumber}` : ' — unassigned'}
                      </option>
                    ))}
                  </select>
                  {driversError && (
                    <p className="mt-1 text-xs text-red-600">{driversError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver Name</label>
                  <input
                    type="text"
                    name="driverName"
                    value={formData.driverName}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver Mobile</label>
                  <input
                    type="tel"
                    name="driverMobile"
                    value={formData.driverMobile}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Driver License Number</label>
                  <input
                    type="text"
                    name="driverLicenseNumber"
                    value={formData.driverLicenseNumber}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Truck Number</label>
                  <input
                    type="text"
                    name="truckNumber"
                    value={formData.truckNumber}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Party Details - Supplier */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Supplier (Consignor)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Supplier Name</label>
                  <input
                    type="text"
                    name="supplierName"
                    placeholder="e.g., ABC Enterprises"
                    value={formData.supplierName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    name="supplierGst"
                    placeholder="e.g., 27AABCT1234G1Z0"
                    value={formData.supplierGst}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="supplierAddress"
                    placeholder="Enter address"
                    value={formData.supplierAddress}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact Number</label>
                  <input
                    type="tel"
                    name="supplierContact"
                    placeholder="e.g., 9876543210"
                    value={formData.supplierContact}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Party Details - Buyer */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Buyer (Consignee)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Buyer Name</label>
                  <input
                    type="text"
                    name="buyerName"
                    placeholder="e.g., XYZ Traders"
                    value={formData.buyerName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    name="buyerGst"
                    placeholder="e.g., 27AABCT1234G1Z0"
                    value={formData.buyerGst}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="buyerAddress"
                    placeholder="Enter address"
                    value={formData.buyerAddress}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact Number</label>
                  <input
                    type="tel"
                    name="buyerContact"
                    placeholder="e.g., 9876543210"
                    value={formData.buyerContact}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Goods Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Goods Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Goods Description</label>
                  <input
                    type="text"
                    name="goodsDescription"
                    placeholder="e.g., Electronics, Clothing, Food items"
                    value={formData.goodsDescription}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Kg</option>
                    <option>Ton</option>
                    <option>Boxes</option>
                    <option>Bags</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total Weight</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="totalWeight"
                      placeholder="0"
                      value={formData.totalWeight}
                      onChange={handleInputChange}
                      className="flex-1 min-w-0 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      name="weightUnit"
                      value={formData.weightUnit}
                      onChange={handleInputChange}
                      aria-label="Weight unit"
                      className="w-24 px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Kg</option>
                      <option>Ton</option>
                      <option>Quintal</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Declared Value (₹)</label>
                  <input
                    type="number"
                    name="declaredValue"
                    placeholder="0"
                    value={formData.declaredValue}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Freight Rate (₹ per {formData.unit})</label>
                  <input
                    type="number"
                    name="freightRate"
                    placeholder="0"
                    value={formData.freightRate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total Freight Amount (₹)</label>
                  <input
                    type="number"
                    name="totalFreightAmount"
                    value={formData.totalFreightAmount}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleCalculateFreight}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Calculate Total Freight
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>UPI/Mobile Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Status</label>
                  <select
                    name="paymentStatus"
                    value={formData.paymentStatus}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Pending</option>
                    <option>Partial</option>
                    <option>Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Advance Amount (₹)</label>
                  <input
                    type="number"
                    name="advanceAmount"
                    placeholder="0"
                    value={formData.advanceAmount}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Balance Amount (₹)</label>
                  <input
                    type="number"
                    name="balanceAmount"
                    value={formData.balanceAmount}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Notes</label>
                  <textarea
                    name="paymentNotes"
                    placeholder="e.g., Payment terms, banking details, reference numbers..."
                    value={formData.paymentNotes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleCalculateBalance}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Calculate Balance Amount
                  </button>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {saveError}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/trips-and-documents')}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {saving
                  ? (isEditing ? 'Saving...' : 'Creating...')
                  : (isEditing ? 'Save Changes' : 'Create Trip')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
