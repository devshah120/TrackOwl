import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { Loader2, AlertCircle } from 'lucide-react';
import truckPng from '../assets/truck-icon.png';
import { INDIA_CENTER, STATUS_COLOR } from './mapConstants';

// Shared Google Maps layer for every fleet screen (Live Tracking, Trip Routes,
// the dashboard widget, and the admin map). Those four used to each carry their
// own copy of the Leaflet setup and truck marker; keeping it in one place means
// the vehicle looks and behaves the same everywhere.

// The Maps JS API must be loaded with the same `libraries` array every time or
// the loader warns and reloads; hoisting it to a module constant keeps the
// reference stable across renders.
const LIBRARIES = [];

// Publishable Maps JS key. Unlike the web-service calls (Places, Directions,
// Geocoding) which go through our backend proxy, the map tiles are rendered by
// Google's own script in the browser and cannot be proxied — this key is meant
// to be public and must be locked to your domains with an HTTP-referrer
// restriction in the Google Cloud Console.
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Muted basemap so the coloured truck markers and route lines stay the loudest
// things on screen — the same intent as the old light Leaflet tiles.
const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e0f2fe' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
];

const MAP_OPTIONS = {
  styles: MAP_STYLES,
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
};

// The truck marker, drawn as an SVG data URI so it can carry the status ring and
// heading arrow that the PNG alone can't. Google sizes markers in pixels and
// anchors them by point, so the whole badge is drawn into one square box.
//
// The truck art is a 3/4 perspective render, so it is deliberately NOT rotated —
// spinning it would read as the vehicle tipping over. Heading is shown by the
// arrow orbiting the ring instead.
const truckIconUrl = (status, course = 0, selected = false) => {
  const size = selected ? 52 : 42;
  const ring = STATUS_COLOR[status] || STATUS_COLOR.offline;
  const box = size + 16;
  const c = box / 2;
  const dim = status === 'offline';

  const arrow =
    status === 'moving'
      ? `<g transform="rotate(${course || 0} ${c} ${c})">
           <polygon points="${c - 4},7 ${c + 4},7 ${c},0" fill="${ring}"/>
         </g>`
      : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
      <circle cx="${c}" cy="${c}" r="${c - 6}" fill="${ring}" fill-opacity="0.13"
              stroke="${ring}" stroke-width="2"/>
      ${status === 'moving' ? `<circle cx="${c}" cy="${c}" r="${c - 3}" fill="${ring}" fill-opacity="0.2"/>` : ''}
      ${arrow}
      <image href="${truckPng}" x="${c - (size * 0.72) / 2}" y="${c - (size * 0.72) / 2}"
             width="${size * 0.72}" height="${size * 0.72}"
             opacity="${dim ? 0.55 : 1}"/>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
};

// A simple lettered pin for trip endpoints (A = From, B = To).
const pinIconUrl = (color, letter) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 35C14 35 26 22 26 13A12 12 0 1 0 2 13C2 22 14 35 14 35Z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="14" y="18" text-anchor="middle" font-family="sans-serif"
            font-size="12" font-weight="700" fill="#fff">${letter}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
};

// Google's Size/Point constructors only exist once the script has loaded, so
// icon objects are built inside components rather than at module scope.
const useIcons = (loaded) =>
  useMemo(() => {
    if (!loaded || !window.google) return null;
    const { Size, Point } = window.google.maps;
    return {
      truck: (status, course, selected) => {
        const box = (selected ? 52 : 42) + 16;
        return {
          url: truckIconUrl(status, course, selected),
          scaledSize: new Size(box, box),
          anchor: new Point(box / 2, box / 2),
        };
      },
      pin: (color, letter) => ({
        url: pinIconUrl(color, letter),
        scaledSize: new Size(28, 36),
        anchor: new Point(14, 35),
      }),
    };
  }, [loaded]);

// Shared loading / error chrome so all four screens fail the same way.
function MapShell({ children }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      {children}
    </div>
  );
}

/**
 * Fleet map.
 *
 * @param devices     vehicles to plot; each needs { lastPosition, status, name }
 * @param selectedId  id of the highlighted vehicle (drawn larger)
 * @param onSelect    called with a device id when its marker is clicked
 * @param route       optional { polyline, origin, destination } for Trip Routes
 * @param fitTo       optional [{lat,lng}, ...] to frame; overrides panning
 */
export function GoogleFleetMap({
  devices = [],
  selectedId = null,
  onSelect,
  route = null,
  fitTo = null,
  className = 'h-full w-full',
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'trackowl-google-maps',
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState(null);
  const [openId, setOpenId] = useState(null);
  const icons = useIcons(isLoaded);

  // Remember whether we've already framed this map. The first fix should snap
  // the viewport into place; after that the user's own pan/zoom is respected and
  // only an explicit selection change moves the camera.
  const framedRef = useRef(false);

  const onLoad = useCallback((m) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const selected = devices.find((d) => (d.id || d._id) === selectedId) || null;
  const lat = selected?.lastPosition?.latitude ?? null;
  const lng = selected?.lastPosition?.longitude ?? null;

  // Keyed on the raw numbers, not the device object: the 5s poll hands us a new
  // object every tick, and depending on that would re-pan the map continuously
  // and fight the user's own panning.
  const selectedPos = useMemo(
    () => (lat == null ? null : { lat, lng }),
    [lat, lng]
  );

  // Frame an explicit set of points (Trip Routes passes the whole route plus the
  // live vehicle so the entire journey is visible).
  useEffect(() => {
    if (!map || !fitTo?.length || !window.google) return;
    if (fitTo.length === 1) {
      map.panTo(fitTo[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    fitTo.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 60);
    framedRef.current = true;
  }, [map, fitTo]);

  // Otherwise follow the selected vehicle.
  useEffect(() => {
    if (!map || fitTo?.length || !selectedPos) return;
    map.panTo(selectedPos);
    if (!framedRef.current) {
      map.setZoom(15);
      framedRef.current = true;
    }
  }, [map, selectedPos, fitTo]);

  if (!MAPS_KEY) {
    return (
      <MapShell>
        <div className="flex max-w-xs items-start gap-2 px-4 text-sm text-slate-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>Map key missing — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in the frontend env.</span>
        </div>
      </MapShell>
    );
  }

  if (loadError) {
    return (
      <MapShell>
        <p className="px-4 text-center text-sm text-red-600">Could not load Google Maps.</p>
      </MapShell>
    );
  }

  if (!isLoaded) {
    return (
      <MapShell>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
        </p>
      </MapShell>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName={className}
      center={selectedPos || INDIA_CENTER}
      zoom={selectedPos ? 15 : 6}
      options={MAP_OPTIONS}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {route?.polyline?.length > 0 && (
        <PolylineF
          path={route.polyline.map(([lat, lng]) => ({ lat, lng }))}
          options={{ strokeColor: '#0284c7', strokeWeight: 5, strokeOpacity: 0.8 }}
        />
      )}

      {route?.origin && (
        <MarkerF position={route.origin} icon={icons.pin('#16a34a', 'A')} title={route.originName} />
      )}
      {route?.destination && (
        <MarkerF
          position={route.destination}
          icon={icons.pin('#dc2626', 'B')}
          title={route.destinationName}
        />
      )}

      {devices.map((d) => {
        if (!d.lastPosition?.latitude) return null;
        const id = d.id || d._id;
        const position = { lat: d.lastPosition.latitude, lng: d.lastPosition.longitude };
        return (
          <MarkerF
            key={id}
            position={position}
            icon={icons.truck(d.status, d.lastPosition.course, id === selectedId)}
            onClick={() => {
              setOpenId(id);
              onSelect?.(id);
            }}
          >
            {openId === id && (
              <InfoWindowF position={position} onCloseClick={() => setOpenId(null)}>
                <div className="text-sm">
                  <strong>{d.name}</strong>
                  <br />
                  {Math.round(d.lastPosition.speed || 0)} km/h ·{' '}
                  {d.lastPosition.ignition ? 'ignition on' : 'ignition off'}
                  {d.owner && (
                    <>
                      <br />
                      {d.owner.company || d.owner.name || 'Unclaimed'}
                    </>
                  )}
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        );
      })}
    </GoogleMap>
  );
}
