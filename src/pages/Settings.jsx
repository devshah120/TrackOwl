import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, Download, Upload, AlertCircle, Save, User, Building, CreditCard, PenTool, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { Topbar } from '../components/Topbar';
import { SignaturePad } from '../components/SignaturePad';
import { user as userApi, companies as companiesApi } from '../services/api';

// Uploaded signatures and logos are downscaled in the browser before they are
// sent, so a photo of a signed sheet — or a print-resolution logo — does not
// land in the database at full camera size.
const MAX_SIGNATURE_WIDTH = 600;
const MAX_LOGO_WIDTH = 400;

// The zones a fleet run out of India realistically operates in — the full IANA
// list is thousands of entries and would make the picker useless. The server
// accepts any valid zone name, so this list can grow without a backend change.
const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Colombo',
  'Asia/Singapore',
  'UTC',
];

const downscaleImage = (file, maxWidth = MAX_SIGNATURE_WIDTH) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that file'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a readable image'));
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

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

  // Company Master state — the transporter's own company record, which heads
  // every generated LR and invoice. Contacts are a list; the flagged one is
  // the number and address printed on documents.
  const [companySettings, setCompanySettings] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    address: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
    contacts: [],
    timezone: 'Asia/Kolkata',
    status: 'active',
  });
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyError, setCompanyError] = useState('');
  const logoInputRef = useRef(null);

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
  });

  // Signature state — `savedSignature` is what the server holds, `mode` picks
  // between the drawing pad and an uploaded image.
  const [signature, setSignature] = useState({ dataUrl: '', signatoryName: '' });
  const [signatureMode, setSignatureMode] = useState('draw');
  const [pendingUpload, setPendingUpload] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const padRef = useRef(null);
  const fileInputRef = useRef(null);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Bank details and the signature still live on the login profile; the
        // company record is its own master. Both are needed to fill this page,
        // so they are fetched together.
        const [res, companyRes] = await Promise.all([
          userApi.getProfile(),
          companiesApi.get(),
        ]);
        if (cancelled) return;
        const u = res.user;
        const c = companyRes.company;

        // An account that has not saved the master yet gets a form seeded from
        // the signup profile, so the first save is a confirmation rather than
        // re-typing details the system already holds.
        setCompanySettings({
          name: c?.name || u.company || '',
          legalName: c?.legalName || '',
          gstin: c?.gstin || u.gstNumber || '',
          pan: c?.pan || u.panNumber || '',
          address: {
            line1: c?.address?.line1 || u.address || '',
            line2: c?.address?.line2 || '',
            city: c?.address?.city || u.city || '',
            state: c?.address?.state || '',
            pincode: c?.address?.pincode || '',
            country: c?.address?.country || 'India',
          },
          contacts: c?.contacts?.length
            ? c.contacts.map((ct) => ({
                name: ct.name || '',
                designation: ct.designation || '',
                phone: ct.phone || '',
                email: ct.email || '',
                isPrimary: Boolean(ct.isPrimary),
              }))
            : [{
                name: u.name || '',
                designation: '',
                phone: u.mobile || '',
                email: u.email || '',
                isPrimary: true,
              }],
          timezone: c?.timezone || 'Asia/Kolkata',
          status: c?.status || 'active',
        });
        setCompanyLogo(c?.logo?.dataUrl || '');
        setBankDetails({
          accountName: u.bankDetails?.accountName || '',
          accountNumber: u.bankDetails?.accountNumber || '',
          bankName: u.bankDetails?.bankName || '',
          ifscCode: u.bankDetails?.ifscCode || '',
          branchName: u.bankDetails?.branchName || '',
        });
        setSignature({
          dataUrl: u.signature?.dataUrl || '',
          signatoryName: u.signature?.signatoryName || '',
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

  const setCompanyField = (field, value) =>
    setCompanySettings((prev) => ({ ...prev, [field]: value }));

  const setAddressField = (field, value) =>
    setCompanySettings((prev) => ({ ...prev, address: { ...prev.address, [field]: value } }));

  const setContactField = (index, field, value) =>
    setCompanySettings((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  const addContact = () =>
    setCompanySettings((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        // The first contact added to an empty list is the primary one by
        // default, matching what the server would decide anyway.
        { name: '', designation: '', phone: '', email: '', isPrimary: prev.contacts.length === 0 },
      ],
    }));

  const removeContact = (index) =>
    setCompanySettings((prev) => {
      const contacts = prev.contacts.filter((_, i) => i !== index);
      // Removing the primary contact promotes the next one, so documents never
      // lose the number they print.
      if (contacts.length && !contacts.some((c) => c.isPrimary)) contacts[0].isPrimary = true;
      return { ...prev, contacts };
    });

  // Exactly one contact can be primary, so selecting one clears the rest.
  const makePrimaryContact = (index) =>
    setCompanySettings((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({ ...c, isPrimary: i === index })),
    }));

  const handleLogoFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCompanyError('');

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setCompanyError('Logo must be a PNG or JPG image.');
      event.target.value = '';
      return;
    }

    try {
      setCompanyLogo(await downscaleImage(file, MAX_LOGO_WIDTH));
    } catch (err) {
      setCompanyError(err.message || 'Could not read that image');
    } finally {
      // Reset so re-picking the same file still fires a change event.
      event.target.value = '';
    }
  };

  const handleSaveCompanySettings = async () => {
    setCompanyError('');

    if (!companySettings.name.trim()) {
      setCompanyError('Company name is required.');
      return;
    }
    // Caught here so the user is not told "contact name is required" by the
    // server after a round-trip they could have been spared.
    if (companySettings.contacts.some((c) => !c.name.trim() && (c.phone || c.email))) {
      setCompanyError('Every contact needs a name.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await companiesApi.save({
        ...companySettings,
        // Blank rows are what an untouched "Add contact" looks like; the server
        // drops them too, but sending them back would re-render empty fields.
        contacts: companySettings.contacts.filter((c) => c.name.trim() || c.phone || c.email),
        logo: { dataUrl: companyLogo },
      });
      setSuccessMessage('Company details saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Keep the login profile's company name in step, since the topbar and
      // the account menu still read it from there.
      userApi
        .updateProfile({ company: res.company?.name || companySettings.name })
        .catch(() => {});
    } catch (err) {
      setCompanyError(err.message || 'Failed to save company details');
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

  const handleSignatureFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSignatureError('');

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSignatureError('Please choose a PNG or JPG image.');
      event.target.value = '';
      return;
    }

    try {
      setPendingUpload(await downscaleImage(file));
    } catch (err) {
      setSignatureError(err.message || 'Could not read that image');
    } finally {
      // Reset so re-picking the same file still fires a change event.
      event.target.value = '';
    }
  };

  const handleSaveSignature = async () => {
    setSignatureError('');

    // Whichever tab is active supplies the image being saved.
    const dataUrl = signatureMode === 'draw'
      ? padRef.current?.toDataUrl()
      : pendingUpload || signature.dataUrl;

    if (!dataUrl) {
      setSignatureError(signatureMode === 'draw'
        ? 'Draw your signature before saving.'
        : 'Choose a signature image before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await userApi.updateProfile({
        signature: { dataUrl, signatoryName: signature.signatoryName },
      });
      setSignature({ ...signature, dataUrl });
      setPendingUpload('');
      padRef.current?.clear();
      setSuccessMessage('Signature saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setSignatureError(err.message || 'Failed to save signature');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSignature = async () => {
    setIsSaving(true);
    setSignatureError('');
    try {
      await userApi.updateProfile({ signature: { dataUrl: '' } });
      setSignature({ dataUrl: '', signatoryName: '' });
      setPendingUpload('');
      padRef.current?.clear();
      setSuccessMessage('Signature removed.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setSignatureError(err.message || 'Failed to remove signature');
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
      name: '',
      legalName: '',
      gstin: '',
      pan: '',
      address: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
      contacts: [],
      timezone: 'Asia/Kolkata',
      status: 'active',
    });
    setCompanyLogo('');
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
              onClick={() => setActiveTab('signature')}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'signature'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-4 h-4" />
              Signature
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

          {/* Company Master Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {companyError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {companyError}
                </div>
              )}

              {/* Identity */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Company Information</h2>
                    <p className="text-sm text-slate-500 mt-1">Used as the header on every LR, invoice and declaration.</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      companySettings.status === 'active'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {companySettings.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companySettings.name}
                        onChange={(e) => setCompanyField('name', e.target.value)}
                        placeholder="Acme Logistics"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Trading name — appears on all documents</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Legal Name</label>
                      <input
                        type="text"
                        value={companySettings.legalName}
                        onChange={(e) => setCompanyField('legalName', e.target.value)}
                        placeholder="Acme Logistics Private Limited"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Registered entity, if different</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">GSTIN</label>
                      <input
                        type="text"
                        value={companySettings.gstin}
                        onChange={(e) => setCompanyField('gstin', e.target.value.toUpperCase())}
                        placeholder="27AABCT1234H1Z0"
                        maxLength={15}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">PAN</label>
                      <input
                        type="text"
                        value={companySettings.pan}
                        onChange={(e) => setCompanyField('pan', e.target.value.toUpperCase())}
                        placeholder="AABCT1234H"
                        maxLength={10}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
                      <select
                        value={companySettings.timezone}
                        onChange={(e) => setCompanyField('timezone', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Trip times are shown in this zone</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                      <select
                        value={companySettings.status}
                        onChange={(e) => setCompanyField('status', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Inactive companies stop heading new documents
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Company Logo</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Printed at the top-left of generated documents. PNG or JPG, under 500KB.
                </p>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="w-32 h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                    {companyLogo ? (
                      <img src={companyLogo} alt="Company logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Building className="w-10 h-10 text-slate-300" />
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {companyLogo ? 'Replace Logo' : 'Upload Logo'}
                    </button>
                    {companyLogo && (
                      <button
                        type="button"
                        onClick={() => setCompanyLogo('')}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-slate-500">Large images are resized automatically.</p>
                  </div>
                </div>
              </div>

              {/* Registered address */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Registered Address</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 1</label>
                    <input
                      type="text"
                      value={companySettings.address.line1}
                      onChange={(e) => setAddressField('line1', e.target.value)}
                      placeholder="12 MG Road"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 2</label>
                    <input
                      type="text"
                      value={companySettings.address.line2}
                      onChange={(e) => setAddressField('line2', e.target.value)}
                      placeholder="Unit 4, Industrial Estate"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                      <input
                        type="text"
                        value={companySettings.address.city}
                        onChange={(e) => setAddressField('city', e.target.value)}
                        placeholder="Pune"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                      <input
                        type="text"
                        value={companySettings.address.state}
                        onChange={(e) => setAddressField('state', e.target.value)}
                        placeholder="Maharashtra"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
                      <input
                        type="text"
                        value={companySettings.address.pincode}
                        onChange={(e) => setAddressField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="411001"
                        inputMode="numeric"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="md:w-1/3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                    <input
                      type="text"
                      value={companySettings.address.country}
                      onChange={(e) => setAddressField('country', e.target.value)}
                      placeholder="India"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Contacts</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      The primary contact&rsquo;s phone and email are printed on documents.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contact
                  </button>
                </div>

                {companySettings.contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                    No contacts yet. Add one so your documents carry a phone number.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {companySettings.contacts.map((contact, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="primaryContact"
                              checked={Boolean(contact.isPrimary)}
                              onChange={() => makePrimaryContact(index)}
                              className="w-4 h-4 text-blue-600"
                            />
                            Primary contact
                          </label>
                          <button
                            type="button"
                            onClick={() => removeContact(index)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            aria-label="Remove contact"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) => setContactField(index, 'name', e.target.value)}
                              placeholder="Raj Kumar"
                              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                            <input
                              type="text"
                              value={contact.designation}
                              onChange={(e) => setContactField(index, 'designation', e.target.value)}
                              placeholder="Operations Manager"
                              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) =>
                                setContactField(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))
                              }
                              placeholder="9876543210"
                              inputMode="numeric"
                              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                            <input
                              type="email"
                              value={contact.email}
                              onChange={(e) => setContactField(index, 'email', e.target.value)}
                              placeholder="ops@acme.in"
                              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveCompanySettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Company Details'}
                </button>
              </div>
            </div>
          )}

          {/* Signature Tab */}
          {activeTab === 'signature' && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Authorised Signatory</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  This signature is stamped on the signatory area of generated Lorry Receipts,
                  invoices and goods declarations. Leave it empty to sign documents by hand.
                </p>
              </div>

              {signatureError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {signatureError}
                </div>
              )}

              {/* Current saved signature */}
              {signature.dataUrl && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Signature</label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="border border-slate-200 rounded-lg bg-white px-4 py-3">
                      <img
                        src={signature.dataUrl}
                        alt="Saved signature"
                        className="h-16 max-w-[240px] object-contain"
                      />
                    </div>
                    <button
                      onClick={handleRemoveSignature}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Draw / Upload switch */}
              <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 mb-4">
                {[['draw', 'Draw'], ['upload', 'Upload']].map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => { setSignatureMode(mode); setSignatureError(''); }}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      signatureMode === mode
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {signatureMode === 'draw' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {signature.dataUrl ? 'Draw a new signature' : 'Draw your signature'}
                    </label>
                    <SignaturePad ref={padRef} onChange={() => setSignatureError('')} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Upload signature image
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                    >
                      {pendingUpload ? (
                        <img
                          src={pendingUpload}
                          alt="Signature preview"
                          className="h-20 mx-auto object-contain"
                        />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                          <p className="text-sm text-slate-600">Click to choose a PNG or JPG file</p>
                          <p className="text-xs text-slate-500 mt-1">
                            A signature on white paper works best. Large images are resized automatically.
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleSignatureFile}
                      className="hidden"
                    />
                    {pendingUpload && (
                      <button
                        onClick={() => setPendingUpload('')}
                        className="mt-2 text-sm text-slate-600 hover:text-slate-900"
                      >
                        Choose a different file
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Signatory Name <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={signature.signatoryName}
                    onChange={(e) => setSignature({ ...signature, signatoryName: e.target.value })}
                    placeholder="Name printed under the signature"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveSignature}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Signature'}
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
