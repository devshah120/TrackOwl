import { useCallback, useEffect, useState } from 'react';
import { GoogleMap, CircleF, PolygonF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { INDIA_CENTER } from './mapConstants';

// The geofence map: every saved fence drawn in its colour, plus the one being
// edited. Click to place a circle's centre, or to add a polygon vertex.
//
// Loader options are identical to GoogleFleetMap's — the Maps loader refuses a
// second call with different options — and no drawing library is needed, so
// none is requested.
const LIBRARIES = [];
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function GeofenceMap({ fences = [], draft = null, onMapClick, onSelect, selectedId, className = 'h-[420px] w-full' }) {
  const { isLoaded, loadError } = useJsApiLoader({ id: 'trackowl-google-maps', googleMapsApiKey: MAPS_KEY, libraries: LIBRARIES });
  const [map, setMap] = useState(null);

  // Frame the saved fences once, so the office lands on its own sites rather
  // than the middle of India.
  useEffect(() => {
    if (!map || !window.google || !fences.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    for (const f of fences) {
      if (f.shape === 'circle' && f.center) bounds.extend(f.center);
      for (const p of f.polygon || []) bounds.extend(p);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
    // Only on first load of the list, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fences.length]);

  useEffect(() => {
    if (map && draft?.shape === 'circle' && draft.center) map.panTo(draft.center);
    // Pan when the centre is first placed, not while the radius changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draft?.center?.lat, draft?.center?.lng]);

  const onLoad = useCallback((m) => setMap(m), []);

  if (loadError) return <div className={`${className} grid place-items-center bg-slate-100 text-sm text-slate-500`}>Map failed to load</div>;
  if (!MAPS_KEY) return <div className={`${className} grid place-items-center bg-slate-100 text-sm text-slate-500 p-4 text-center`}>Set VITE_GOOGLE_MAPS_API_KEY to draw geofences on the map</div>;
  if (!isLoaded) return <div className={`${className} grid place-items-center bg-slate-100 text-sm text-slate-500`}>Loading map…</div>;

  const handleClick = (e) => onMapClick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });

  return (
    <GoogleMap
      mapContainerClassName={className}
      center={INDIA_CENTER}
      zoom={5}
      onLoad={onLoad}
      onClick={handleClick}
      options={{ streetViewControl: false, mapTypeControl: true, clickableIcons: false, draggableCursor: onMapClick ? 'crosshair' : undefined }}
    >
      {fences
        .filter((f) => !draft || f._id !== draft._id)
        .map((f) => {
          const style = {
            strokeColor: f.color || '#2563eb',
            fillColor: f.color || '#2563eb',
            fillOpacity: f._id === selectedId ? 0.3 : f.active === false ? 0.05 : 0.15,
            strokeWeight: f._id === selectedId ? 3 : 1.5,
            clickable: Boolean(onSelect),
          };
          return f.shape === 'polygon' ? (
            <PolygonF key={f._id} paths={f.polygon} options={style} onClick={() => onSelect?.(f)} />
          ) : f.center ? (
            <CircleF key={f._id} center={f.center} radius={f.radiusM} options={style} onClick={() => onSelect?.(f)} />
          ) : null;
        })}

      {draft?.shape === 'circle' && draft.center && (
        <>
          <CircleF center={draft.center} radius={Number(draft.radiusM) || 500} options={{ strokeColor: draft.color, fillColor: draft.color, fillOpacity: 0.25, strokeWeight: 2, clickable: false }} />
          <MarkerF position={draft.center} />
        </>
      )}
      {draft?.shape === 'polygon' && draft.polygon?.length > 0 && (
        <>
          <PolygonF paths={draft.polygon} options={{ strokeColor: draft.color, fillColor: draft.color, fillOpacity: 0.25, strokeWeight: 2, clickable: false }} />
          {draft.polygon.map((p, i) => (
            <MarkerF key={i} position={p} label={String(i + 1)} />
          ))}
        </>
      )}
    </GoogleMap>
  );
}
