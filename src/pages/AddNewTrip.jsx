import { useState } from 'react';
import { ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';

export function AddNewTrip() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Driver data from FleetAndDrivers
  const [drivers] = useState([
    {
      id: 'DRV001',
      name: 'Rajesh Kumar',
      mobile: '9876543210',
      salary: 15000,
      licenseNumber: 'DL-0219950000123',
      licenseExpiry: '2027-06-30',
      truckNumber: 'MH-01-AB-1234',
      truckModel: 'Tata 407',
    },
    {
      id: 'DRV002',
      name: 'Priya Singh',
      mobile: '9876543211',
      salary: 14500,
      licenseNumber: 'DL-0120880000456',
      licenseExpiry: '2026-12-15',
      truckNumber: 'MH-01-CD-5678',
      truckModel: 'Ashok Leyland 3318',
    },
    {
      id: 'DRV003',
      name: 'Amit Patel',
      mobile: '9876543212',
      salary: 13500,
      licenseNumber: 'DL-0119920000789',
      licenseExpiry: '2028-03-10',
      truckNumber: 'MH-01-EF-9012',
      truckModel: 'Mahindra Bolero Pik-Up',
    },
    {
      id: 'DRV004',
      name: 'Vikram Sharma',
      mobile: '9876543213',
      salary: 15500,
      licenseNumber: 'DL-0119880000321',
      licenseExpiry: '2026-09-05',
      truckNumber: 'MH-01-GH-3456',
      truckModel: 'Tata 709',
    },
  ]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form Data:', formData);
    navigate('/trips-and-documents');
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
              <h1 className="text-3xl font-bold text-slate-900">Add New Trip</h1>
              <p className="text-slate-600 mt-1">Fill in all the details to create a new trip</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    <option value="">Choose a driver...</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
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
                  <input
                    type="number"
                    name="totalWeight"
                    placeholder="0"
                    value={formData.totalWeight}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Trip
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
