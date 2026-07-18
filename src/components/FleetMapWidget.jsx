import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { tracking } from '../services/api';
import truckPng from '../assets/truck-icon.png';

const POLL_MS = 5000;
const INDIA_CENTER = [22.9868, 72.6100];

const STATUS_COLOR = {
  moving: '#22c55e',
  idle: '#f59e0b',
  offline: '#64748b',
};

// Same marker as the Live Tracking page (FleetMap.jsx), reused here so the
// dashboard widget and the full map read as the same fleet, not two datasets.
const truckIcon = (status, course = 0, selected = false) => {
  const size = selected ? 52 : 42;
  const ring = STATUS_COLOR[status] || STATUS_COLOR.offline;
  const box = size + 16;

  return L.divIcon({
    className: '',
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
    popupAnchor: [0, -box / 2],
    html: `
      <div style="position:relative;width:${box}px;height:${box}px;">
        <div style="
          position:absolute;inset:6px;border-radius:50%;
          background:${ring}22;border:2px solid ${ring};
          ${status === 'moving' ? `box-shadow:0 0 0 4px ${ring}33;` : ''}
        "></div>
        ${
          status === 'moving'
            ? `<div style="
                 position:absolute;inset:0;
                 transform:rotate(${course || 0}deg);
               ">
                 <div style="
                   position:absolute;top:-1px;left:50%;margin-left:-4px;
                   width:0;height:0;
                   border-left:4px solid transparent;
                   border-right:4px solid transparent;
                   border-bottom:7px solid ${ring};
                 "></div>
               </div>`
            : ''
        }
        <img src="${truckPng}" alt="" style="
          position:absolute;top:50%;left:50%;
          width:${size * 0.72}px;height:auto;
          transform:translate(-50%,-50%);
          filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))
                 ${status === 'offline' ? ' grayscale(1) opacity(.55)' : ''};
        "/>
      </div>`,
  });
};

function PanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [position, map]);
  return null;
}

export function FleetMapWidget({ height = '500px', selectedTruck, onSelectTruck }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await tracking.getDevices();
        if (cancelled) return;
        setDevices(data.devices || []);
        setError(null);
        if (!selectedTruck && data.devices?.length && onSelectTruck) {
          onSelectTruck(data.devices[0].id || data.devices[0]._id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the tracking API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = devices.find((d) => (d.id || d._id) === selectedTruck) || null;
  const selectedPos = selected?.lastPosition?.latitude
    ? [selected.lastPosition.latitude, selected.lastPosition.longitude]
    : null;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden" style={{ height }}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-600">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-red-600 px-4 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden" style={{ height }}>
      <MapContainer center={selectedPos || INDIA_CENTER} zoom={selectedPos ? 15 : 6} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <PanTo position={selectedPos} />

        {devices.map((d) => {
          if (!d.lastPosition?.latitude) return null;
          const id = d.id || d._id;
          return (
            <Marker
              key={id}
              position={[d.lastPosition.latitude, d.lastPosition.longitude]}
              icon={truckIcon(d.status, d.lastPosition.course, id === selectedTruck)}
              eventHandlers={{ click: () => onSelectTruck?.(id) }}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                {Math.round(d.lastPosition.speed || 0)} km/h ·{' '}
                {d.lastPosition.ignition ? 'ignition on' : 'ignition off'}
              </Popup>
            </Marker>
          );
        })}

        {devices.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
            <p className="bg-white/90 rounded-lg px-4 py-2 text-sm text-slate-500 shadow">
              No vehicles yet — add one from Live Tracking.
            </p>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
