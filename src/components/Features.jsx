import { motion } from 'framer-motion';
import { BentoCard } from './Card';
import { FiMapPin, FiFileText, FiTruck, FiBarChart2, FiShare2, FiTrendingUp, FiUsers, FiPieChart } from 'react-icons/fi';

export const Features = () => {
  const features = [
    {
      icon: FiMapPin,
      title: 'Live GPS Tracking',
      description: 'Real-time vehicle location tracking with accuracy up to 5 meters',
      span: 'col-span-1'
    },
    {
      icon: FiFileText,
      title: 'GST Invoice Automation',
      description: 'Auto-generate and manage compliant GST invoices in seconds',
      span: 'col-span-1'
    },
    {
      icon: FiTruck,
      title: 'LR Management',
      description: 'Digital logistics receipts with QR codes and e-signatures',
      span: 'col-span-1'
    },
    {
      icon: FiBarChart2,
      title: 'Daily Ledger',
      description: 'Automated daily reconciliation and financial reporting',
      span: 'col-span-1'
    },
    {
      icon: FiShare2,
      title: 'Customer Tracking Link',
      description: 'Shareable tracking links for end-to-end shipment visibility',
      span: 'col-span-1'
    },
    {
      icon: FiTrendingUp,
      title: 'Expense Tracking',
      description: 'Monitor fuel, maintenance, and operational expenses in real-time',
      span: 'col-span-1'
    },
    {
      icon: FiUsers,
      title: 'Driver Management',
      description: 'Comprehensive driver profiles with performance metrics',
      span: 'col-span-1'
    },
    {
      icon: FiPieChart,
      title: 'Fleet Analytics',
      description: 'Advanced insights on fuel efficiency, ROI, and productivity',
      span: 'col-span-1'
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
    <section id="features" className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute top-0 left-1/4 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl"
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
          <p className="text-sm font-semibold text-blue-600 mb-4">POWERFUL FEATURES</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Comprehensive tools designed specifically for Indian logistics and fleet management
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className={feature.span}
            >
              <BentoCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                gradient={i % 3 === 0}
                className="h-full min-h-[200px] flex flex-col justify-between"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
