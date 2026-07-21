import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X, LocateFixed } from 'lucide-react';
import { geo } from '../services/api';

// Turn a GeolocationPositionError into something a driver can act on.
const geoErrorMessage = (err) => {
  if (err?.code === 1) return 'Location permission denied — allow it in your browser settings.';
  if (err?.code === 2) return 'Could not get a GPS fix. Try again outdoors.';
  if (err?.code === 3) return 'Location request timed out. Try again.';
  return 'Could not get your location.';
};

// A text input with live place autocomplete (Nominatim/OSM). Calls onSelect with
// { name, lat, lng } when the user picks a suggestion. `value` is the currently
// selected place (or null); passing it back keeps the field in sync when the
// parent clears or presets it. Set `allowCurrentLocation` to offer a one-tap
// "use my GPS position" button.
export function PlaceSearchInput({
  label,
  placeholder,
  value,
  onSelect,
  icon: Icon = MapPin,
  allowCurrentLocation = false,
}) {
  const [text, setText] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  // Reflect an externally-set value (e.g. parent reset the form).
  useEffect(() => {
    setText(value?.name || '');
  }, [value]);

  // Debounced search: wait for a pause in typing, and cancel any in-flight
  // request so results can't arrive out of order.
  useEffect(() => {
    const q = text.trim();
    // Don't re-search the text we just filled in from a selection.
    if (!q || q === value?.name) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        const rows = await geo.searchPlaces(q, { signal: controller.signal });
        setResults(rows);
        setOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [text, value?.name]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (place) => {
    onSelect(place);
    setText(place.name);
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setText('');
    setResults([]);
    setLocError(null);
  };

  // Ask the browser for a GPS fix, name it via reverse geocoding, and select it
  // like any other place. Needs HTTPS (or localhost) — browsers block the
  // geolocation API on plain http origins.
  const useCurrentLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError('This browser does not support location.');
      return;
    }
    if (!window.isSecureContext) {
      setLocError('Location needs a secure (https) connection.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const place = await geo.reverseGeocode(coords);
          pick(place);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocError(geoErrorMessage(err));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
        {allowCurrentLocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex items-center gap-1 text-xs font-medium text-sky-600 transition hover:text-sky-700 disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" />
            )}
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        )}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        />
        {busy ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : (value || text) ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {locError && <p className="mt-1 text-xs text-red-600">{locError}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-[3000] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
