import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MapPin, Warehouse, Truck, User, Building2 } from 'lucide-react';

export const PremiumFeatures = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    'Transportation ERP',
    'Transport Management System',
    'Fleet Management System',
  ];

  const features = [
    {
      id: 0,
      title: 'Transportation ERP',
      description: 'Seamless cloud-based solution for paperless consignment recording, digital EPOD. Effectively track revenue, analyze data, track outstanding bills ensuring transparent bills/payment management.',
      featureList: [
        'Consignment Operations Management',
        'FTL/PTL Delivery Management',
        'Ledger & Accounting Management',
        'E-Way Bill Management',
        'Driver Management',
        'GPS Tracking',
        'Invoice Automation',
      ],
      color: 'from-blue-500/20 to-cyan-500/20',
      accentColor: 'from-blue-600 to-cyan-500',
    },
    {
      id: 1,
      title: 'Transport Management System',
      description: 'Optimize your logistics operations with intelligent route planning, real-time tracking, and comprehensive fleet visibility. Reduce costs and improve delivery performance.',
      featureList: [
        'Route Optimization',
        'Real-time Fleet Tracking',
        'Load Planning & Management',
        'Driver Assignment',
        'Fuel Efficiency Monitoring',
        'Delay Prevention',
        'Customer Notifications',
      ],
      color: 'from-purple-500/20 to-pink-500/20',
      accentColor: 'from-purple-600 to-pink-500',
    },
    {
      id: 2,
      title: 'Fleet Management System',
      description: 'Complete fleet visibility with predictive maintenance scheduling, fuel monitoring, and performance analytics. Maximize uptime and minimize operational costs.',
      featureList: [
        'Vehicle Maintenance Scheduling',
        'Fuel Consumption Tracking',
        'Performance Analytics',
        'Cost Management',
        'Driver Behavior Monitoring',
        'Document Management',
        'Compliance Reporting',
      ],
      color: 'from-emerald-500/20 to-green-500/20',
      accentColor: 'from-emerald-600 to-green-500',
    },
  ];

  const currentFeature = features[activeTab];

  // Logistics Flow Visualization
  const LogisticsVisualization = () => (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${currentFeature.accentColor} opacity-5 rounded-3xl`} />

      {/* SVG-like diagram with isometric feel */}
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full max-w-lg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Warehouse/Consignor - Top Left */}
        <motion.g
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <rect x="30" y="40" width="80" height="70" rx="8" fill="#E0E7FF" stroke="#818CF8" strokeWidth="2" />
          <rect x="35" y="45" width="25" height="30" rx="4" fill="#C7D2FE" />
          <rect x="70" y="45" width="25" height="30" rx="4" fill="#C7D2FE" />
          <rect x="35" y="82" width="25" height="20" rx="3" fill="#A5B4FC" />
          <rect x="70" y="82" width="25" height="20" rx="3" fill="#A5B4FC" />
          <text x="70" y="135" fontSize="12" fontWeight="600" fill="#1F2937" textAnchor="middle">
            Consignor
          </text>
        </motion.g>

        {/* Pickup HUB - Top Right */}
        <motion.g
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <circle cx="320" cy="60" r="45" fill="#F0FFFE" stroke="#14B8A6" strokeWidth="2" />
          <circle cx="315" cy="55" r="8" fill="#2DD4BF" />
          <circle cx="325" cy="60" r="8" fill="#2DD4BF" />
          <circle cx="318" cy="70" r="8" fill="#2DD4BF" />
          <circle cx="322" cy="70" r="8" fill="#2DD4BF" />
          <text x="320" y="130" fontSize="12" fontWeight="600" fill="#1F2937" textAnchor="middle">
            Pickup HUB
          </text>
        </motion.g>

        {/* Delivery HUB - Bottom Right */}
        <motion.g
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <rect x="270" y="300" width="90" height="75" rx="8" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
          <rect x="280" y="310" width="20" height="25" rx="3" fill="#FCD34D" />
          <rect x="310" y="310" width="20" height="25" rx="3" fill="#FCD34D" />
          <rect x="340" y="310" width="20" height="25" rx="3" fill="#FCD34D" />
          <rect x="280" y="345" width="20" height="20" rx="3" fill="#F59E0B" />
          <rect x="310" y="345" width="20" height="20" rx="3" fill="#F59E0B" />
          <rect x="340" y="345" width="20" height="20" rx="3" fill="#F59E0B" />
          <text x="315" y="385" fontSize="12" fontWeight="600" fill="#1F2937" textAnchor="middle">
            Delivery HUB
          </text>
        </motion.g>

        {/* Truck/Vehicle - Center */}
        <motion.g
          animate={{ x: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        >
          <rect x="160" y="180" width="70" height="40" rx="6" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
          <circle cx="175" cy="225" r="8" fill="#1F2937" />
          <circle cx="215" cy="225" r="8" fill="#1F2937" />
          <polygon points="230,195 240,195 235,175" fill="#EF4444" />
          <text x="195" y="270" fontSize="11" fontWeight="600" fill="#1F2937" textAnchor="middle">
            Truck
          </text>
        </motion.g>

        {/* Customer - Bottom Left */}
        <motion.g
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <circle cx="60" cy="330" r="30" fill="#F3E8FF" stroke="#D946EF" strokeWidth="2" />
          <circle cx="60" cy="315" r="8" fill="#D946EF" />
          <path d="M 45 340 Q 60 350 75 340" stroke="#D946EF" strokeWidth="2" fill="none" />
          <path d="M 50 330 L 40 340 M 70 330 L 80 340" stroke="#D946EF" strokeWidth="2" />
          <text x="60" y="375" fontSize="12" fontWeight="600" fill="#1F2937" textAnchor="middle">
            Customer
          </text>
        </motion.g>

        {/* Connection Lines */}
        <motion.g stroke="#CBD5E1" strokeWidth="2" fill="none" strokeDasharray="5,5">
          <path d="M 110 80 Q 200 100 260 90" opacity="0.4" />
          <path d="M 110 100 Q 200 180 180 200" opacity="0.4" />
          <path d="M 290 200 Q 300 250 315 295" opacity="0.4" />
          <path d="M 100 150 Q 100 250 100 290" opacity="0.4" />
        </motion.g>

        {/* Flow Indicators */}
        <motion.circle
          cx="200"
          cy="140"
          r="4"
          fill="#3B82F6"
          animate={{ r: [4, 6, 4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>

      {/* Corner decorative elements */}
      <div className="absolute top-6 right-6 w-12 h-12 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-lg" />
      <div className="absolute bottom-6 left-6 w-16 h-16 bg-gradient-to-br from-emerald-400/20 to-green-400/20 rounded-full blur-lg" />
    </div>
  );

  return (
    <section className="relative py-32 overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-white">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-40 -z-10" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full blur-3xl opacity-40 -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-blue-600 mb-4 tracking-wide">COMPREHENSIVE SOLUTIONS</p>
          <h2 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Powerful features to supercharge your productivity
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Enterprise-grade logistics solutions designed for modern transportation businesses
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="flex justify-center mb-20"
        >
          <div className="inline-flex bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full p-1.5 shadow-lg">
            {tabs.map((tab, index) => (
              <motion.button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`relative px-6 sm:px-8 py-3 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                  activeTab === index
                    ? 'text-blue-600 bg-white shadow-lg'
                    : 'text-white hover:text-gray-100'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab}
                {activeTab === index && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            {/* Left Content */}
            <motion.div className="space-y-8">
              {/* Title and Description */}
              <div className="space-y-4">
                <h3 className="text-4xl sm:text-5xl font-bold text-gray-900">
                  {currentFeature.title}
                </h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {currentFeature.description}
                </p>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                {currentFeature.featureList.map((feature, index) => (
                  <motion.button
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.4 }}
                    whileHover={{ x: 8 }}
                    className="group flex items-center gap-4 text-left w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all duration-300"
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${currentFeature.accentColor} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-800 font-semibold group-hover:text-gray-900">
                      {feature}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`group px-8 py-4 rounded-full font-semibold text-white bg-gradient-to-r ${currentFeature.accentColor} shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center gap-2`}
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>

            {/* Right Visualization */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`relative rounded-3xl p-8 bg-gradient-to-br ${currentFeature.color} backdrop-blur-xl border border-white/30 shadow-2xl min-h-96 flex items-center justify-center overflow-hidden`}
            >
              <LogisticsVisualization />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
