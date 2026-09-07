// Non-component helpers for the trip tabs.
//
// Kept out of shared.jsx because that file exports React components, and a
// module mixing components with plain functions breaks fast refresh: the dev
// server can no longer tell whether a change should re-render or reload.

export const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

// Reads a file the operator picked and hands back a data URI, matching how the
// vehicle-document and ledger-receipt uploads already work in this app.
//
// Images are downscaled first: a phone photo of a delivery note is several
// megabytes and the server caps the stored string at roughly 3 MB. PDFs pass
// through untouched, since they cannot be resized this way.
export const readFileAsDataUrl = (file, { maxDimension = 1600, quality = 0.8 } = {}) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));

    reader.onload = () => {
      const dataUrl = String(reader.result || '');

      if (!file.type.startsWith('image/')) {
        resolve({ dataUrl, filename: file.name, mimeType: file.type });
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        // Already small enough — re-encoding would only lose quality.
        if (scale === 1) {
          resolve({ dataUrl, filename: file.name, mimeType: file.type });
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', quality),
          filename: file.name,
          mimeType: 'image/jpeg',
        });
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
