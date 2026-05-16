import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export const ProductShowcase = () => {
  const [activeTab, setActiveTab] = useState(0);

  const products = [
    {
      id: 0,
      name: 'Transportation ERP',
      subtitle: 'Seamless cloud-based solution for paperless consignment recording, digital EPOD. Effectively track revenue, analyze data, track outstanding bills ensuring transparent bills/payment management.',
      features: [
        'Consignment Operations Management',
        'FTL/PTL Delivery Management',
        'Ledger & Accounting Management',
        'E-Way Bill Management',
      ],
      diagram: '🏢',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 1,
      name: 'Transport Management System',
      subtitle: 'Optimize your logistics operations with real-time tracking, route optimization, and fleet visibility.',
      features: [
        'Route Optimization',
        'Real-time Tracking',
        'Load Management',
        'Driver Assignment',
      ],
      diagram: '🚚',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 2,
      name: 'Fleet Management System',
      subtitle: 'Complete fleet visibility with maintenance scheduling, fuel monitoring, and performance analytics.',
      features: [
        'Vehicle Maintenance',
        'Fuel Tracking',
        'Performance Analytics',
        'Cost Management',
      ],
      diagram: '🛣️',
      color: 'from-green-500 to-emerald-500',
    },
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
    <section className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"
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
          <p className="text-sm font-semibold text-blue-600 mb-4">COMPREHENSIVE SOLUTIONS</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-blue-900 mb-4">
            Powerful features to supercharge your productivity
          </h2>
          <p className="text-lg text-blue-700 max-w-2xl mx-auto">
            Choose the perfect solution for your logistics needs
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex justify-center mb-16"
        >
          <div className="inline-flex bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full p-1 gap-2">
            {products.map((product, i) => (
              <button
                key={product.id}
                onClick={() => setActiveTab(i)}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  activeTab === i
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white hover:text-gray-200'
                }`}
              >
                {product.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left Content */}
          <motion.div variants={itemVariants} className="space-y-6">
            <div>
              <h3 className="text-3xl font-bold text-blue-900 mb-3">
                {products[activeTab].name}
              </h3>
              <p className="text-blue-700 text-lg leading-relaxed">
                {products[activeTab].subtitle}
              </p>
            </div>

            <div className="space-y-3">
              {products[activeTab].features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3 text-blue-800 font-semibold"
                >
                  <ChevronRight className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  {feature}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Diagram */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center"
          >
            <div className={`relative w-full h-80 bg-gradient-to-br ${products[activeTab].color} rounded-3xl flex items-center justify-center shadow-2xl`}>
              <div className="text-9xl opacity-80">
                {products[activeTab].diagram}
              </div>
              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-white/20 rounded-full blur-lg" />
              <div className="absolute bottom-6 left-4 w-16 h-16 bg-white/20 rounded-full blur-lg" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
