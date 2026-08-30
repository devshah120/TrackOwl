import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Plus, Upload, FileText as FileIcon, Trash2, X, AlertCircle } from 'lucide-react';
import {
  expiryState,
  expiryLabel,
  getExpiryColor,
  getExpiryDot,
} from '../constants/documents';

// Scans are downscaled in the browser before upload, exactly as ledger receipts
// are — a phone photo of an RC book should not land in the database at full
// camera size. PDFs pass through untouched: they cannot be drawn to a canvas.
const MAX_WIDTH = 1600;
const MAX_BYTES = 3 * 1024 * 1024;

const readAttachment = (file) => new Promise((resolve, reject) => {
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
      const scale = Math.min(1, MAX_WIDTH / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      // JPEG rather than PNG: these are photos of paper, and PNG would be far
      // larger for no visible gain. 0.85 keeps small print legible.
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        filename: file.name,
        mimeType: 'image/jpeg',
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const inputClass =
  'w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-2';

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const emptyDraft = (defaultType) => ({
  docType: defaultType,
  documentNumber: '',
  issuedBy: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
  attachment: null,
});

// Inline document manager for one truck or one driver.
//
// It handles both halves of the add/edit problem. When `ownerId` is set the
// record already exists, so every change is written straight through to the
// API. On a create form there is no id to file documents against yet, so rows
// are buffered in local state and the parent flushes them by calling
// `flush(newId)` on the ref once the truck or driver has been saved. That keeps
// "add a truck and its RC in one go" working without inventing a draft record
// server-side.
//
// Props:
//   ownerId    — truck or driver id, or null while creating
//   api        — vehicleDocuments or driverDocuments from services/api
//   ownerKey   — 'truck' | 'driver', the field name the API expects
//   types      — the docType list for this kind of owner
//   labels     — docType -> human label
//   canEdit    — whether to show the add/remove controls at all
//   title/description — section heading
export const DocumentsSection = forwardRef(function DocumentsSection(
  { ownerId, api, ownerKey, types, labels, canEdit = true, title = 'Documents', description },
  ref
) {
  const [documents, setDocuments] = useState([]);
  // Rows captured before the parent record exists, flushed on save.
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(types[0]));

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.list({ [ownerKey]: ownerId });
        if (!cancelled) setDocuments(res.documents || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId, api, ownerKey]);

  // Writes every buffered row against a freshly created record. Returns the
  // count saved so the parent can report it; a failure here is surfaced to the
  // parent rather than swallowed, because a truck saved without its RC is
  // something the operator needs to know about.
  const flush = useCallback(async (newOwnerId) => {
    if (!pending.length || !newOwnerId) return 0;
    for (const row of pending) {
      await api.create({ ...row, [ownerKey]: newOwnerId });
    }
    setPending([]);
    return pending.length;
  }, [pending, api, ownerKey]);

  useImperativeHandle(ref, () => ({ flush, pendingCount: pending.length }), [flush, pending.length]);

  const resetDraft = () => {
    setDraft(emptyDraft(types[0]));
    setAdding(false);
  };

  const handleDraftChange = (e) => {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a removal
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('That file is too large — please upload a document under 3 MB.');
      return;
    }
    try {
      setError('');
      // Read before the update: the state updater is synchronous and cannot
      // await, so the file has to be fully decoded first.
      const attachment = await readAttachment(file);
      setDraft((prev) => ({ ...prev, attachment }));
    } catch (err) {
      setError(err.message || 'Could not read that file');
    }
  };

  const handleAdd = async () => {
    setError('');
    if (!draft.docType) {
      setError('Pick a document type.');
      return;
    }
    if (draft.issueDate && draft.expiryDate && new Date(draft.expiryDate) < new Date(draft.issueDate)) {
      setError('Expiry date cannot be before the issue date.');
      return;
    }

    const payload = {
      docType: draft.docType,
      documentNumber: draft.documentNumber.trim(),
      issuedBy: draft.issuedBy.trim(),
      notes: draft.notes.trim(),
      // Sent explicitly rather than omitted so a cleared date persists.
      issueDate: draft.issueDate || null,
      expiryDate: draft.expiryDate || null,
      attachment: draft.attachment,
    };

    // No parent record yet: buffer the row and show it in the table straight
    // away, so the form reads the same either side of the first save.
    if (!ownerId) {
      setPending((prev) => [...prev, payload]);
      resetDraft();
      return;
    }

    setBusy(true);
    try {
      const res = await api.create({ ...payload, [ownerKey]: ownerId });
      setDocuments((prev) => [...prev, res.document]);
      resetDraft();
    } catch (err) {
      setError(err.message || 'Failed to save document');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSaved = async (doc) => {
    const label = labels[doc.docType] || doc.docType;
    if (!window.confirm(`Remove the ${label} document? This cannot be undone.`)) return;
    setError('');
    setBusy(true);
    try {
      await api.remove(doc._id || doc.id);
      setDocuments((prev) => prev.filter((d) => (d._id || d.id) !== (doc._id || doc.id)));
    } catch (err) {
      setError(err.message || 'Failed to remove document');
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePending = (index) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  };

  const openAttachment = async (doc) => {
    try {
      setError('');
      // A row still buffered locally already holds its file; a saved one is
      // fetched, because the list response deliberately omits the data URI.
      const attachment = doc.attachment?.dataUrl
        ? doc.attachment
        : (await api.getAttachment(doc._id || doc.id)).attachment;

      const win = window.open();
      if (!win) return;
      if (attachment.mimeType === 'application/pdf') {
        win.location = attachment.dataUrl;
      } else {
        win.document.write(`<img src="${attachment.dataUrl}" style="max-width:100%">`);
      }
    } catch (err) {
      setError(err.message || 'Could not open that file');
    }
  };

  // Saved and buffered rows render through one list, so the table looks the
  // same whether the parent record exists yet or not.
  const rows = [
    ...documents.map((doc) => ({ doc, pendingIndex: null })),
    ...pending.map((doc, i) => ({ doc, pendingIndex: i })),
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(''); }}
            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Document
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Draft row — the add form, shown inline rather than in a modal so it
          sits in the same flow as the rest of the record. */}
      {adding && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Document Type *</label>
              <select name="docType" value={draft.docType} onChange={handleDraftChange} className={inputClass}>
                {types.map((t) => (
                  <option key={t} value={t}>{labels[t] || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Document Number</label>
              <input
                type="text"
                name="documentNumber"
                placeholder="e.g., POL-2026-99812"
                value={draft.documentNumber}
                onChange={handleDraftChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Issued By</label>
              <input
                type="text"
                name="issuedBy"
                placeholder="e.g., RTO Pune / ICICI Lombard"
                value={draft.issuedBy}
                onChange={handleDraftChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Issue Date</label>
              <input
                type="date"
                name="issueDate"
                value={draft.issueDate}
                onChange={handleDraftChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Expiry Date</label>
              <input
                type="date"
                name="expiryDate"
                value={draft.expiryDate}
                onChange={handleDraftChange}
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave blank for a document that does not expire.
              </p>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input
                type="text"
                name="notes"
                placeholder="Optional"
                value={draft.notes}
                onChange={handleDraftChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Scanned copy */}
          <div>
            <label className={labelClass}>Scanned Copy</label>
            {draft.attachment ? (
              <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg bg-white">
                <FileIcon className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate">{draft.attachment.filename}</p>
                  <p className="text-xs text-slate-500">Ready to upload</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, attachment: null }))}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors bg-white">
                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-700">Upload scanned copy</span>
                <span className="text-xs text-slate-500 mt-0.5">JPG, PNG or PDF — up to 3 MB</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetDraft}
              className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {/* type="button" throughout: this section is rendered inside the
                truck/driver <form>, and a default submit button here would save
                the whole record instead of adding a document. */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Add Document'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-sm">Loading documents...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
          <FileIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No documents on file yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Document</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Number</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Issued By</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Issue Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Expiry</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Copy</th>
                {canEdit && <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(({ doc, pendingIndex }, i) => {
                // A saved document carries its state from the API; a buffered
                // one is derived here so the badge is right before the save.
                const state = doc.expiryState || expiryState(doc.expiryDate);
                const hasFile = doc.hasAttachment || Boolean(doc.attachment?.dataUrl);
                return (
                  <tr key={doc._id || doc.id || `pending-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {labels[doc.docType] || doc.docType}
                      {pendingIndex !== null && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                          Unsaved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {doc.documentNumber || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {doc.issuedBy || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {formatDate(doc.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {doc.expiryDate ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getExpiryDot(state)}`}></div>
                          <span className="text-slate-700">{formatDate(doc.expiryDate)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryColor(state)}`}>
                            {expiryLabel(doc.expiryDate, state)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">No expiry</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={() => openAttachment(doc)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            pendingIndex !== null ? handleRemovePending(pendingIndex) : handleRemoveSaved(doc)
                          }
                          disabled={busy}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60"
                          title="Remove document"
                        >
                          {pendingIndex !== null ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending.length > 0 && (
        <p className="text-xs text-amber-700 mt-3">
          {pending.length} document{pending.length > 1 ? 's' : ''} will be saved when you save this record.
        </p>
      )}
    </div>
  );
});
