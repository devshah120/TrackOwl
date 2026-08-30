import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Topbar } from '../components/Topbar';
import { DocumentsSection } from '../components/DocumentsSection';
import { usePermissions } from '../hooks/usePermissions';
import { drivers as driversApi, driverDocuments, fleet } from '../services/api';
import { DRIVER_STATUSES, toDateInput } from '../constants/driver';
import { DRIVER_DOCUMENT_TYPES, DRIVER_DOCUMENT_LABELS } from '../constants/documents';

// Every field in this form wears the same box, matching AddNewTruck.
const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

// Flat form state: the nested emergencyContact shape the API expects is
// assembled at submit time, which keeps every input a plain controlled field.
const emptyForm = () => ({
  name: '',
  mobile: '',
  licenseNumber: '',
  licenseExpiry: '',
  joiningDate: '',
  salary: '',
  status: 'Available',
  truck: '',
  contactName: '',
  contactRelation: '',
  contactMobile: '',
});

// Add / Edit Driver — the driver master's own full page, mirroring
// AddNewTruck. Reached from the Drivers list; `:id` switches it to editing an
// existing driver.
export function AddNewDriver() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { can } = usePermissions();

  const [formData, setFormData] = useState(emptyForm());
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Documents captured on a *new* driver have nowhere to be filed until the
  // driver exists, so the section buffers them and this ref flushes them once
  // the create call returns an id.
  const documentsRef = useRef(null);

  // The truck list only feeds the assignment dropdown, so a seat without
  // `trucks` access still gets a working form instead of a dead page.
  const canReadTrucks = can('trucks', 'read');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [driverRes, truckRes] = await Promise.all([
          isEditing ? driversApi.list() : Promise.resolve({ drivers: [] }),
          canReadTrucks ? fleet.list().catch(() => ({ trucks: [] })) : Promise.resolve({ trucks: [] }),
        ]);
        if (cancelled) return;
        setTrucks(truckRes.trucks || []);

        if (isEditing) {
          const driver = (driverRes.drivers || []).find((d) => (d._id || d.id) === id);
          if (!driver) {
            setError('Driver not found.');
            return;
          }
          const contact = driver.emergencyContact || {};
          setFormData({
            name: driver.name || '',
            mobile: driver.mobile || '',
            licenseNumber: driver.licenseNumber || '',
            licenseExpiry: toDateInput(driver.licenseExpiry),
            joiningDate: toDateInput(driver.joiningDate),
            // `?? ''` rather than `|| ''`: a genuine 0 salary must survive into
            // the field instead of showing as blank.
            salary: driver.salary ?? '',
            status: driver.status || 'Available',
            truck: driver.truck?._id || driver.truck || '',
            contactName: contact.name || '',
            contactRelation: contact.relation || '',
            contactMobile: contact.mobile || '',
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load driver');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEditing, canReadTrucks]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => navigate('/drivers');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const name = formData.name.trim();
    const mobile = String(formData.mobile).replace(/\D/g, '');
    if (!name || mobile.length !== 10) {
      setError('A driver needs a name and a valid 10-digit mobile number.');
      return;
    }

    const contactMobile = String(formData.contactMobile).replace(/\D/g, '');
    if (contactMobile && contactMobile.length !== 10) {
      setError('The emergency contact number must be 10 digits, or left blank.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        mobile,
        licenseNumber: formData.licenseNumber.trim(),
        // Sent explicitly rather than omitted so clearing a date or salary
        // actually persists; the API only skips fields the caller never sent.
        licenseExpiry: formData.licenseExpiry || null,
        joiningDate: formData.joiningDate || null,
        salary: formData.salary === '' ? null : Number(formData.salary),
        status: formData.status,
        // Likewise for the truck, so emptying the dropdown unassigns the driver.
        truck: formData.truck || null,
        emergencyContact: {
          name: formData.contactName.trim(),
          relation: formData.contactRelation.trim(),
          mobile: contactMobile,
        },
      };

      if (isEditing) {
        // Documents on an existing driver are written straight through by the
        // section itself, so there is nothing to flush here.
        await driversApi.update(id, payload);
      } else {
        const res = await driversApi.create(payload);
        const newId = res.driver?._id || res.driver?.id;
        // The driver is saved either way; only the paperwork can fail here, so
        // it is reported without losing the driver the operator just created.
        try {
          await documentsRef.current?.flush(newId);
        } catch (docErr) {
          setError(
            `Driver saved, but a document could not be attached: ${docErr.message || 'unknown error'}. ` +
            'Open the driver again to re-add it.'
          );
          setSubmitting(false);
          return;
        }
      }
      navigate('/drivers');
    } catch (err) {
      setError(err.message || 'Failed to save driver');
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
              onClick={handleCancel}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditing ? 'Edit Driver' : 'Add New Driver'}
              </h1>
              <p className="text-slate-600 mt-1">
                {isEditing ? 'Update driver details' : 'Add a driver to your roster'}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading driver...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Details */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Driver Name *</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g., Rajesh Kumar"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Mobile Number *</label>
                    <input
                      type="tel"
                      name="mobile"
                      placeholder="e.g., 9876543210"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Licence & Employment */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Licence &amp; Employment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Licence Number</label>
                    <input
                      type="text"
                      name="licenseNumber"
                      placeholder="e.g., DL-0219950000123"
                      value={formData.licenseNumber}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Licence Expiry</label>
                    <input
                      type="date"
                      name="licenseExpiry"
                      value={formData.licenseExpiry}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Joining Date</label>
                    <input
                      type="date"
                      name="joiningDate"
                      value={formData.joiningDate}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Salary (₹)</label>
                    <input
                      type="number"
                      name="salary"
                      placeholder="0"
                      value={formData.salary}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Emergency Contact</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Who to call if something happens on the road. Optional, but worth having.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Contact Name</label>
                    <input
                      type="text"
                      name="contactName"
                      placeholder="e.g., Sunita Kumar"
                      value={formData.contactName}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Relation</label>
                    <input
                      type="text"
                      name="contactRelation"
                      placeholder="e.g., Spouse"
                      value={formData.contactRelation}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contact Mobile</label>
                    <input
                      type="tel"
                      name="contactMobile"
                      placeholder="e.g., 9876543211"
                      value={formData.contactMobile}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Status */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Assignment &amp; Status</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Assigned Truck</label>
                    <select
                      name="truck"
                      value={formData.truck}
                      onChange={handleInputChange}
                      className={inputClass}
                      disabled={!canReadTrucks}
                    >
                      <option value="">Unassigned</option>
                      {trucks.map((t) => {
                        const tid = t._id || t.id;
                        return (
                          <option key={tid} value={tid}>
                            {t.number}{t.model ? ` — ${t.model}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      A driver can stay on the roster without a truck.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className={inputClass}
                    >
                      {DRIVER_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Driver Documents — licence, identity proof, training and
                  medical certificates, each with its own expiry. */}
              <DocumentsSection
                ref={documentsRef}
                ownerId={isEditing ? id : null}
                api={driverDocuments}
                ownerKey="driver"
                types={DRIVER_DOCUMENT_TYPES}
                labels={DRIVER_DOCUMENT_LABELS}
                canEdit={can('drivers', isEditing ? 'update' : 'create')}
                title="Driver Documents"
                description="Licence, identity proof, training and medical certificates. Anything with an expiry date is chased in the notification bell."
              />

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : isEditing ? 'Update Driver' : 'Save Driver'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
