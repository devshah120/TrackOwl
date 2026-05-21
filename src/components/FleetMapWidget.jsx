import { useState, useEffect } from 'react';
import { MapPin, Navigation, AlertCircle, Wifi, WifiOff, Loader } from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import truckIcon from '../assets/truck-icon.png';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629,
};

export function FleetMapWidget({ height = '500px', selectedTruck: propSelectedTruck = 'TRK-001', onSelectTruck }) {
  const [selectedTruck, setSelectedTruck] = useState('TRK-001');
  const [infoWindowOpen, setInfoWindowOpen] = useState('TRK-001');

  const activeSelectedTruck = propSelectedTruck || selectedTruck;

  const handleSelectTruck = (truckId) => {
    setSelectedTruck(truckId);
    setInfoWindowOpen(truckId);
    if (onSelectTruck) {
      onSelectTruck(truckId);
    }
  };
  const [trucks, setTrucks] = useState([
    {
      id: 'TRK-001',
      name: 'Ashok Leyland 16ft',
      status: 'moving',
      lat: 23.0225,
      lng: 72.5714,
      speed: 65,
      direction: 45,
      location: 'Ahmedabad',
      lastUpdate: '2 mins ago',
      driver: 'Rajesh Kumar',
      route: 'Ahmedabad Route',
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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const selectedTruckData = trucks.find(t => t.id === activeSelectedTruck);

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

  if (!isLoaded) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden" style={{ height }}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-600">Loading Map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, height: '100%' }}
        center={selectedTruckData ? { lat: selectedTruckData.lat, lng: selectedTruckData.lng } : defaultCenter}
        zoom={selectedTruckData ? 10 : 6}
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
            {
              featureType: 'road',
              elementType: 'geometry.fill',
              stylers: [{ color: '#f3f4f6' }],
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
              handleSelectTruck(truck.id);
            }}
            icon={{
              url: truckIcon,
              scaledSize: truck.status === 'moving' ? { width: 48, height: 48 } : { width: 44, height: 44 },
              anchor: new window.google.maps.Point(24, 24),
            }}
          >
            {activeSelectedTruck === truck.id && infoWindowOpen === truck.id ? (
              <InfoWindowF
                onCloseClick={() => setInfoWindowOpen(null)}
                position={{ lat: truck.lat, lng: truck.lng }}
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
            ) : null}
          </MarkerF>
        ))}
      </GoogleMap>
    </div>
  );
}
