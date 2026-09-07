import { useState } from 'react';
import { Paperclip, Upload, Trash2, Download, FileText } from 'lucide-react';
import { Card, Field, EmptyState, ErrorNote } from './shared';
import { inputClass, readFileAsDataUrl } from './helpers';
import { tripOrders } from '../../services/api';
import { TRIP_DOCUMENT_TYPE_LABELS, formatDateTime } from '../../constants/trip';

// Files attached to the trip: the LR, the invoice, the e-way bill, receipts and
// anything else that belongs in the file.
//
// The list carries metadata only — a trip with a dozen scans runs to megabytes,
// none of which is needed to show a table of filenames. Each file is fetched
// when someone actually opens it, the same way vehicle and driver documents
// already work in this app.
export function TripDocumentsTab({ trip, reload, canEdit }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ docType: 'other', title: '', documentNumber: '' });
  const [pending, setPending] = useState(null);

  const pickFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const result = await readFileAsDataUrl(file);
      setPending(result);
      // A blank title defaults to the filename, so the list is readable even
      // when the operator uploads and moves on.
      setDraft((d) => ({ ...d, title: d.title || file.name.replace(/\.[^.]+$/, '') }));
    } catch (err) {
      setError(err.message || 'Could not read that file');
    }
  };

  const upload = async () => {
    if (!pending) return;
    setUploading(true);
    setError('');
    try {
      await tripOrders.addDocument(trip._id, { ...draft, ...pending });
      setPending(null);
      setDraft({ docType: 'other', title: '', documentNumber: '' });
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to attach the document');
    } finally {
      setUploading(false);
    }
  };

  const open = async (docId, filename) => {
    setError('');
    try {
      const res = await tripOrders.getDocument(trip._id, docId);
      const { dataUrl, mimeType } = res.document;

      // A PDF opens in a tab; an image is shown inline. Both go through a blob
      // URL rather than navigating to the data URI directly, which some
      // browsers refuse for top-level navigation.
      const [meta, base64] = dataUrl.split(',');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || meta.match(/data:([^;]+)/)?.[1] || '' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not open that document');
    }
  };

  const remove = async (docId) => {
    if (!window.confirm('Remove this document from the trip?')) return;
    setError('');
    try {
      await tripOrders.removeDocument(trip._id, docId);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not remove the document');
    }
  };

  const documents = trip.documents || [];

  return (
    <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      {canEdit && (
        <Card title="Attach a Document">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <Field label="Document Type">
              <select
                value={draft.docType}
                onChange={(e) => setDraft((d) => ({ ...d, docType: e.target.value }))}
                className={inputClass}
              >
                {Object.entries(TRIP_DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Document Number">
              <input
                type="text"
                value={draft.documentNumber}
                onChange={(e) => setDraft((d) => ({ ...d, documentNumber: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="File" hint="Images are downscaled; PDFs upload as they are">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => pickFile(e.target.files?.[0])}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </Field>
          </div>

          {pending && (
            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600 truncate">
                Ready to attach: <span className="font-medium">{pending.filename}</span>
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={upload}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Attach'}
                </button>
                <button
                  onClick={() => setPending(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title={`Documents (${documents.length})`}>
        {documents.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="No documents attached"
            hint="Attach the LR, invoice, e-way bill, POD or any receipts that belong with this trip."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Type</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Title</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Number</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900">Uploaded</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc._id}>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        {TRIP_DOCUMENT_TYPE_LABELS[doc.docType] || doc.docType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {doc.title || doc.filename || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-600">{doc.documentNumber || '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">
                      {formatDateTime(doc.uploadedAt)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => open(doc._id, doc.filename)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => remove(doc._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
