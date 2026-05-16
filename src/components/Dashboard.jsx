import { motion } from 'framer-motion';
import { GlassCard } from './Card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard = () => {
  const revenueData = [
    { day: 'Mon', revenue: 45000 },
    { day: 'Tue', revenue: 52000 },
    { day: 'Wed', revenue: 48000 },
    { day: 'Thu', revenue: 61000 },
    { day: 'Fri', revenue: 55000 },
    { day: 'Sat', revenue: 67000 },
    { day: 'Sun', revenue: 59000 },
  ];

  const fleetData = [
    { status: 'Active', count: 45 },
    { status: 'Idle', count: 12 },
    { status: 'Maintenance', count: 8 },
  ];

  const tripHistory = [
    { id: 1, route: 'Mumbai → Pune', status: 'Completed', distance: '148 km', driver: 'Raj Kumar' },
    { id: 2, route: 'Delhi → Noida', status: 'In Progress', distance: '24 km', driver: 'Amit Singh' },
    { id: 3, route: 'Bangalore → Mysore', status: 'Completed', distance: '144 km', driver: 'Ravi Patel' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section id="dashboard" className="py-20 relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
      <motion.div
        className="absolute -bottom-40 right-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl"
        animate={{ y: [0, 40, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-blue-600 mb-4">DASHBOARD SHOWCASE</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Real-Time Fleet Intelligence
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Monitor your entire fleet with beautiful, intuitive dashboards
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="space-y-6"
        >
          {/* Top Charts Row */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Revenue Chart */}
            <GlassCard gradient>
              <h3 className="text-xl font-bold text-white mb-6">Weekly Revenue</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Fleet Status Chart */}
            <GlassCard gradient>
              <h3 className="text-xl font-bold text-white mb-6">Fleet Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={fleetData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="status" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>

          {/* Key Metrics */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { label: 'Total Trips', value: '1,284', change: '+12.5%', color: 'from-blue-500' },
              { label: 'Fuel Consumed', value: '4,562L', change: '-8.2%', color: 'from-orange-500' },
              { label: 'Total Distance', value: '12,453km', change: '+5.3%', color: 'from-emerald-500' },
              { label: 'Avg. Efficiency', value: '8.2km/L', change: '+2.1%', color: 'from-purple-500' },
            ].map((metric, i) => (
              <GlassCard key={metric.label} className="p-6">
                <p className="text-sm text-white/70 mb-2">{metric.label}</p>
                <p className="text-3xl font-bold text-white mb-2">{metric.value}</p>
                <p className="text-sm text-emerald-400">{metric.change}</p>
              </GlassCard>
            ))}
          </motion.div>

          {/* Trip History Table */}
          <motion.div
            variants={itemVariants}
            className="glassmorphism-dark rounded-2xl overflow-hidden border border-white/10"
          >
            <div className="p-8">
              <h3 className="text-xl font-bold text-white mb-6">Recent Trips</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-white/70">Route</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-white/70">Driver</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-white/70">Distance</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-white/70">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripHistory.map((trip) => (
                      <motion.tr
                        key={trip.id}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        className="border-b border-white/5 transition-colors"
                      >
                        <td className="py-4 px-4 text-white">{trip.route}</td>
                        <td className="py-4 px-4 text-white/70">{trip.driver}</td>
                        <td className="py-4 px-4 text-white/70">{trip.distance}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            trip.status === 'Completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {trip.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
