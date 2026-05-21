import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, AlertCircle, Wifi, WifiOff, Loader } from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { TruckIcon } from '../components/TruckIcon';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629,
};

export function FleetMap() {
  const [selectedTruck, setSelectedTruck] = useState('TRK-001');
  const [infoWindowOpen, setInfoWindowOpen] = useState('TRK-001');
  const [trucks, setTrucks] = useState([
    {
      id: 'TRK-001',
      name: 'Ashok Leyland 16ft',
      status: 'moving',
      lat: 28.7041,
      lng: 77.1025,
      speed: 65,
      direction: 45,
      location: 'Delhi-Mumbai Highway',
      lastUpdate: '2 mins ago',
      driver: 'Rajesh Kumar',
      route: 'Delhi → Mumbai',
    },
    {
      id: 'TRK-002',
      name: 'Tata 18ft',
      status: 'idle',
      lat: 28.5244,
      lng: 77.1855,
      speed: 0,
      direction: 0,
      location: 'Jaipur Warehouse',
      lastUpdate: '5 mins ago',
      driver: 'Amit Singh',
      route: 'Awaiting Load',
    },
    {
      id: 'TRK-003',
      name: 'Mahindra 20ft',
      status: 'moving',
      lat: 12.9716,
      lng: 77.5946,
      speed: 72,
      direction: 120,
      location: 'Bangalore-Chennai Route',
      lastUpdate: '1 min ago',
      driver: 'Priya Sharma',
      route: 'Bangalore → Chennai',
    },
    {
      id: 'TRK-004',
      name: 'Hino 10ft',
      status: 'stopped',
      lat: 18.5204,
      lng: 73.8567,
      speed: 0,
      direction: 180,
      location: 'Pune Rest Stop',
      lastUpdate: '15 mins ago',
      driver: 'Vikram Patel',
      route: 'Pune-Nashik Highway',
    },
    {
      id: 'TRK-005',
      name: 'Volvo FH16',
      status: 'offline',
      lat: 19.0760,
      lng: 72.8777,
      speed: 0,
      direction: 270,
      location: 'Mumbai Depot',
      lastUpdate: '2 hours ago',
      driver: 'Manish Verma',
      route: 'Offline',
    },
  ]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });

  const selectedTruckData = trucks.find(t => t.id === selectedTruck);

  // Simulate truck movement
  useEffect(() => {
    const interval = setInterval(() => {
      setTrucks(prevTrucks =>
        prevTrucks.map(truck => {
          if (truck.status === 'moving') {
            const latChange = (Math.random() - 0.5) * 0.005;
            const lngChange = (Math.random() - 0.5) * 0.005;
            const newDirection = (truck.direction + Math.random() * 10 - 5) % 360;
            return {
              ...truck,
              lat: truck.lat + latChange,
              lng: truck.lng + lngChange,
              direction: newDirection < 0 ? newDirection + 360 : newDirection,
            };
          }
          return truck;
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'moving':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'stopped':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'offline':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'moving':
        return <Navigation className="w-4 h-4" />;
      case 'idle':
        return <AlertCircle className="w-4 h-4" />;
      case 'stopped':
        return <AlertCircle className="w-4 h-4" />;
      case 'offline':
        return <WifiOff className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fleet Live Map</h1>
          <p className="text-slate-600 mt-1">Real-time vehicle tracking and monitoring</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 h-[600px] flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-600">Loading Google Maps...</p>
            <p className="text-sm text-slate-500 mt-2">Make sure REACT_APP_GOOGLE_MAPS_API_KEY is set in .env</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Fleet Live Map</h1>
        <p className="text-slate-600 mt-1">Real-time vehicle tracking and monitoring</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden h-[600px] flex flex-col">
            {/* Map Container */}
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={selectedTruckData ? { lat: selectedTruckData.lat, lng: selectedTruckData.lng } : defaultCenter}
              zoom={6}
              options={{
                styles: [
                  {
                    featureType: 'all',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#64748b' }],
                  },
                  {
                    featureType: 'water',
                    elementType: 'geometry.fill',
                    stylers: [{ color: '#e0f2fe' }],
                  },
                ],
              }}
            >
              {/* Truck Markers */}
              {trucks.map((truck) => (
                <MarkerF
                  key={truck.id}
                  position={{ lat: truck.lat, lng: truck.lng }}
                  onClick={() => {
                    setSelectedTruck(truck.id);
                    setInfoWindowOpen(truck.id);
                  }}
                  icon={{
                    url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxmaWx0ZXIgaWQ9InRydWNrR2xvdyI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMiIgcmVzdWx0PSJjb2xvcmVkQmx1ciIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iY29sb3JlZEJsdXIiLz48ZmVNZXJnZU5vZGUgaW49IlNvdXJjZUdyYXBoaWMiLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PGxpbmVhckdyYWRpZW50IGlkPSJ0cnVja0dyYWRpZW50IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzFlM2E4YTtzdG9wLW9wYWNpdHk6MSIgLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMxZTQwYWY7c3RvcC1vcGFjaXR5OjEiIC8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3QgeD0iMjgiIHk9IjM1IiB3aWR0aD0iNTIiIGhlaWdodD0iMzUiIHJ4PSIzIiBmaWxsPSJ1cmwoI3RydWNrR3JhZGllbnQpIiBzdHJva2U9IiMwZjE3MmEiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHJlY3QgeD0iMTAiIHk9IjQwIiB3aWR0aD0iMTgiIGhlaWdodD0iMjUiIHJ4PSIyIiBmaWxsPSIjMWU0MGFmIiBzdHJva2U9IiMwZjE3MmEiIHN0cm9rZS13aWR0aD0iMS41Ii8+PHJlY3QgeD0iMTIiIHk9IjQyIiB3aWR0aD0iMTQiIGhlaWdodD0iOCIgcng9IjEiIGZpbGw9IiNlMGYyZmUiIG9wYWNpdHk9IjAuOCIvPjxyZWN0IHg9IjI4IiB5PSI0OCIgd2lkdGg9IjIiIGhlaWdodD0iMTUiIGZpbGw9IiMwZjE3MmEiLz48Y2lyY2xlIGN4PSI3NSIgY3k9IjcyIiByPSI2IiBmaWxsPSIjMGYxNzJhIiBzdHJva2U9IiMxZTQwYWYiIHN0cm9rZS13aWR0aD0iMSIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzIiIHI9IjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIxIi8+PGNpcmNsZSBjeD0iMjIiIGN5PSI3MiIgcj0iNiIgZmlsbD0iIzBmMTcyYSIgc3Ryb2tlPSIjMWU0MGFmIiBzdHJva2Utd2lkdGg9IjEiLz48Y2lyY2xlIGN4PSIyMiIgY3k9IjcyIiByPSI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iMSIvPjxwb2x5Z29uIHBvaW50cz0iNjAsMzIgNjUsMjggNzAsMzIiIGZpbGw9IiMzYjgyZjYiIG9wYWNpdHk9IjAuOSIvPjwvc3ZnPg==',
                    scaledSize: truck.status === 'moving' ? { width: 40, height: 40 } : { width: 35, height: 35 },
                  }}
                >
                  {infoWindowOpen === truck.id && (
                    <InfoWindowF
                      onCloseClick={() => setInfoWindowOpen(null)}
                      options={{
                        pixelOffset: { width: 0, height: -40 },
                      }}
                    >
                      <div className="bg-white rounded shadow p-3 max-w-xs">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-slate-900 text-sm">{truck.name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(truck.status)}`}>
                            {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <p><strong>ID:</strong> {truck.id}</p>
                          <p><strong>Driver:</strong> {truck.driver}</p>
                          <p><strong>Speed:</strong> {truck.speed} km/h</p>
                          <p><strong>Route:</strong> {truck.route}</p>
                        </div>
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              ))}
            </GoogleMap>

            {/* Map Footer Info */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3" />
                <span>{trucks.filter(t => t.status !== 'offline').length} Active • {trucks.filter(t => t.status === 'offline').length} Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Truck Details */}
        <div className="space-y-4">
          {/* Selected Truck Details */}
          {selectedTruckData && (
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Selected Vehicle</p>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedTruckData.name}</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(selectedTruckData.status)}`}>
                  {getStatusIcon(selectedTruckData.status)}
                  {selectedTruckData.status.charAt(0).toUpperCase() + selectedTruckData.status.slice(1)}
                </span>
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">ID</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.id}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Driver</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.driver}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Route</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.route}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Location</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    {selectedTruckData.location}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Speed</p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.speed} km/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Direction</p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.direction.toFixed(0)}°</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Last Update</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedTruckData.lastUpdate}</p>
                </div>
              </div>

              <button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors">
                View Full Route
              </button>
            </div>
          )}

          {/* Fleet Summary */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Fleet Summary</h3>
            <div className="space-y-3">
              {trucks.map((truck) => (
                <button
                  key={truck.id}
                  onClick={() => {
                    setSelectedTruck(truck.id);
                    setInfoWindowOpen(truck.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedTruck === truck.id
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{truck.id}</p>
                      <p className="text-xs text-slate-500 mt-1">{truck.driver}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(truck.status)}`}>
                      {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
