import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, Download, Upload, AlertCircle, Save, User, Building, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';
import { user as userApi } from '../services/api';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  // Company settings state
  const [companySettings, setCompanySettings] = useState({
    companyName: '',
    address: '',
    city: '',
    mobileNumber: '',
    gstNumber: '',
    panNumber: '',
  });

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await userApi.getProfile();
        if (cancelled) return;
        const u = res.user;
        setCompanySettings({
          companyName: u.company || '',
          address: u.address || '',
          city: u.city || '',
          mobileNumber: u.mobile || '',
          gstNumber: u.gstNumber || '',
          panNumber: u.panNumber || '',
        });
        setBankDetails({
          accountName: u.bankDetails?.accountName || '',
          accountNumber: u.bankDetails?.accountNumber || '',
          bankName: u.bankDetails?.bankName || '',
          ifscCode: u.bankDetails?.ifscCode || '',
          branchName: u.bankDetails?.branchName || '',
        });
      } catch (err) {
        if (!cancelled) setProfileError(err.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // User management state
  const [users, setUsers] = useState([
    {
      id: 'USR001',
      name: 'Raj Kumar',
      email: 'raj@trackowl.com',
      role: 'Admin',
      status: 'Active',
      dateAdded: '2026-01-15',
    },
    {
      id: 'USR002',
      name: 'Priya Singh',
      email: 'priya@trackowl.com',
      role: 'Manager',
      status: 'Active',
      dateAdded: '2026-02-20',
    },
    {
      id: 'USR003',
      name: 'Amit Patel',
      email: 'amit@trackowl.com',
      role: 'Operator',
      status: 'Inactive',
      dateAdded: '2026-03-10',
    },
  ]);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Operator' });

  const handleSaveCompanySettings = async () => {
    setIsSaving(true);
    try {
      await userApi.updateProfile({
        company: companySettings.companyName,
        address: companySettings.address,
        city: companySettings.city,
        mobile: companySettings.mobileNumber,
        gstNumber: companySettings.gstNumber,
        panNumber: companySettings.panNumber,
      });
      setSuccessMessage('Company settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save company settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBankDetails = async () => {
    setIsSaving(true);
    try {
      await userApi.updateProfile({ bankDetails });
      setSuccessMessage('Bank details saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save bank details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const dataToExport = {
      company: companySettings,
      bank: bankDetails,
      users: users,
      timestamp: new Date().toISOString(),
    };

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2)));
    element.setAttribute('download', `trackowl-backup-${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.company) setCompanySettings(data.company);
          if (data.bank) setBankDetails(data.bank);
          if (data.users) setUsers(data.users);
          setSuccessMessage('Data imported successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
          alert('Error reading file. Please ensure it is a valid backup file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAllData = () => {
    setShowConfirmDialog(true);
  };

  const confirmClearData = () => {
    setCompanySettings({
      companyName: '',
      address: '',
      city: '',
      mobileNumber: '',
      gstNumber: '',
      panNumber: '',
    });
    setBankDetails({
      accountName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
    });
    setUsers([]);
    setShowConfirmDialog(false);
    setSuccessMessage('All data cleared successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleAddUser = () => {
    if (newUser.name && newUser.email) {
      const user = {
        id: `USR${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: 'Active',
        dateAdded: new Date().toISOString().split('T')[0],
      };
      setUsers([...users, user]);
      setNewUser({ name: '', email: '', role: 'Operator' });
      setShowAddUserModal(false);
      setSuccessMessage('User added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleDeleteUser = (id) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-1">Manage company details, bank information, and user accounts</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {successMessage}
            </div>
          )}

          {profileError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {profileError}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'company'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" />
              Company Details
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'bank'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Bank Details
            </button>
            {/* <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'backup'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4" />
              Backup & Restore
            </button> */}
          </div>

          {/* Company Details Tab */}
          {activeTab === 'company' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Company Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={companySettings.companyName}
                    onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                    placeholder="Company name"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Appears on all documents</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                    <input
                      type="text"
                      value={companySettings.address}
                      onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                      placeholder="Street address"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                    <input
                      type="text"
                      value={companySettings.city}
                      onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mobile Number</label>
                  <input
                    type="tel"
                    value={companySettings.mobileNumber}
                    onChange={(e) => setCompanySettings({ ...companySettings, mobileNumber: e.target.value })}
                    placeholder="+91-0000000000"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">GST Number</label>
                    <input
                      type="text"
                      value={companySettings.gstNumber}
                      onChange={(e) => setCompanySettings({ ...companySettings, gstNumber: e.target.value })}
                      placeholder="27AABCT1234H1Z0"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">PAN Number</label>
                    <input
                      type="text"
                      value={companySettings.panNumber}
                      onChange={(e) => setCompanySettings({ ...companySettings, panNumber: e.target.value })}
                      placeholder="AABCT1234H"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveCompanySettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Bank Details</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">Bank details will be shown on invoices. Keep this information accurate and up-to-date.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Account Holder Name</label>
                  <input
                    type="text"
                    value={bankDetails.accountName}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                    placeholder="Account holder name"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                    <input
                      type="text"
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                      placeholder="Account number"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                      placeholder="Bank name"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">IFSC Code</label>
                    <input
                      type="text"
                      value={bankDetails.ifscCode}
                      onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                      placeholder="HDFC0000001"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Branch Name</label>
                    <input
                      type="text"
                      value={bankDetails.branchName}
                      onChange={(e) => setBankDetails({ ...bankDetails, branchName: e.target.value })}
                      placeholder="Branch name"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveBankDetails}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Management Tab - Commented Out */}
          {false && activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">User Accounts</h2>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date Added</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {users.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{userItem.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{userItem.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{userItem.role}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              userItem.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {userItem.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{userItem.dateAdded}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                title="Edit User"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userItem.id)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Backup & Restore Tab - Commented Out */}
        </div>
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add New User</h2>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Operator</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Data Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-red-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Clear All Data?
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 mb-6">
                This action cannot be undone. All company details, bank information, and user accounts will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearData}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
