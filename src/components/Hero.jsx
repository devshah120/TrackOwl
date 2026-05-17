import { motion } from 'framer-motion';
import { Button } from './Button';
import { ArrowRight } from 'lucide-react';
import dashboardImage from '../assets/img_banner_hero_screen_upd_25eab7eb83.webp';

export const Hero = ({ onSignIn, onGetStarted }) => {
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
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  return (
    <section className="min-h-screen relative overflow-hidden pt-32 pb-20">
      {/* Animated background shapes */}
      <motion.div
        className="absolute top-20 left-0 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"
        animate={{ y: [0, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-40 right-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl"
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >

          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            <span className="text-gradient">
              India's Smartest Fleet
            </span>
            <br />
            <span className="text-gray-900">Operating System</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8"
          >
            Real-time GPS tracking, automated invoicing, and comprehensive fleet
            analytics. Streamline operations and maximize efficiency.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Button variant="primary" size="lg" onClick={onGetStarted}>
              Start Free Trial <ArrowRight size={20} />
            </Button>
            <Button variant="secondary" size="lg">
              Watch Demo
            </Button>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-sm text-gray-500"
          >
            No credit card required • 14-day free trial
          </motion.p>
        </motion.div>

        {/* Dashboard Showcase */}
        <motion.div
          variants={itemVariants}
          className="relative"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-3xl blur-2xl"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <img
              src={dashboardImage}
              alt="TrackOwl Dashboard"
              className="w-full h-auto object-cover rounded-3xl border border-white/30"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};
