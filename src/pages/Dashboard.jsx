import { useState } from 'react';
import { TrendingUp, Truck, AlertCircle, Check } from 'lucide-react';
import { FleetMapWidget } from '../components/FleetMapWidget';

export function Dashboard() {
  const [selectedTruck, setSelectedTruck] = useState('TRK-001');

  // Sample data - replace with API calls
  const stats = [
    {
      title: 'Total Freight Billed',
      value: '₹45,230',
      subtitle: 'All trips combined',
      icon: TrendingUp,
      color: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      title: 'Amount Collected',
      value: '₹38,450',
      subtitle: 'Payments received so far',
      icon: Check,
      color: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      title: 'Pending Balance',
      value: '₹6,780',
      subtitle: 'Amount still outstanding',
      icon: AlertCircle,
      color: 'bg-yellow-100',
      textColor: 'text-yellow-600',
    },
    {
      title: 'Net Profit',
      value: '₹12,450',
      subtitle: 'Collected minus all expenses',
      icon: TrendingUp,
      color: 'bg-purple-100',
      textColor: 'text-purple-600',
    },
  ];

  const fleetStatus = [
    { status: 'Running', count: 8, color: 'bg-green-500', textColor: 'text-green-600' },
    { status: 'Idle', count: 3, color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    { status: 'Stopped', count: 2, color: 'bg-red-500', textColor: 'text-red-600' },
  ];

  const trucks = [
    { id: 'TRK-001', name: 'Ashok Leyland 16ft', status: 'moving', location: 'Ahmedabad', driver: 'Rajesh Kumar' },
    { id: 'TRK-002', name: 'Tata 18ft', status: 'idle', location: 'Jaipur Warehouse', driver: 'Amit Singh' },
    { id: 'TRK-003', name: 'Mahindra 20ft', status: 'moving', location: 'Bangalore-Chennai Route', driver: 'Priya Sharma' },
    { id: 'TRK-004', name: 'Hino 10ft', status: 'stopped', location: 'Pune Rest Stop', driver: 'Vikram Patel' },
    { id: 'TRK-005', name: 'Volvo FH16', status: 'offline', location: 'Mumbai Depot', driver: 'Manish Verma' },
  ];

  const recentTrips = [
    { id: 1, route: 'Delhi → Mumbai', distance: '1,400 km', freight: '₹8,500', status: 'Completed' },
    { id: 2, route: 'Bangalore → Chennai', distance: '350 km', freight: '₹4,200', status: 'In Transit' },
    { id: 3, route: 'Jaipur → Delhi', distance: '260 km', freight: '₹3,100', status: 'Completed' },
    { id: 4, route: 'Pune → Nashik', distance: '210 km', freight: '₹2,800', status: 'In Transit' },
  ];

  const pendingPayments = [
    { buyer: 'ABC Logistics Ltd', amount: '₹2,500', daysOverdue: 5 },
    { buyer: 'XYZ Cargo Services', amount: '₹1,800', daysOverdue: 2 },
    { buyer: 'Freight Express Co.', amount: '₹2,480', daysOverdue: 8 },
    { buyer: 'Patel Express Co.', amount: '₹5,480', daysOverdue: 4 },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'moving':
        return 'bg-blue-100 text-blue-800';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'Running':
        return 'bg-green-100 text-green-800';
      case 'Idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'Stopped':
        return 'bg-red-100 text-red-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'In Transit':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back! Here's your fleet overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
              <p className="text-slate-600 text-sm font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
              <p className="text-slate-500 text-xs mt-2">{stat.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Fleet Live Map and Truck Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map on Left */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Live Map</h2>
          <FleetMapWidget height="600px" selectedTruck={selectedTruck} onSelectTruck={setSelectedTruck} />
        </div>

        {/* Truck Status Cards on Right */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Summary</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {trucks.map((truck) => (
              <button
                key={truck.id}
                onClick={() => setSelectedTruck(truck.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedTruck === truck.id
                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{truck.id}</p>
                    <p className="text-xs text-slate-600 mt-1">{truck.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{truck.driver}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(truck.status)}`}>
                    {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">📍 {truck.location}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Trips and Pending Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Trips</h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Route</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Distance</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Freight</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => (
                  <tr key={trip.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{trip.route}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.distance}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{trip.freight}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(trip.status)}`}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Payments */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Pending Payments</h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Buyer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment, idx) => (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{payment.buyer}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{payment.amount}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-red-600">{payment.daysOverdue} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
