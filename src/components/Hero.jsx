import { motion } from 'framer-motion';
import { Button } from './Button';
import { ArrowRight, TrendingUp, MapPin, AlertCircle, FileText } from 'lucide-react';

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
          {/* Main Dashboard Card */}
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-3xl blur-2xl"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 4, repeat: Infinity }}
            />

            <div className="relative glassmorphism rounded-3xl overflow-hidden p-8 shadow-2xl border border-white/30">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />
              </div>

              {/* Floating Dashboard Cards */}
              <div className="hidden lg:block relative h-96 sm:h-[500px] lg:h-[600px]">
                {/* GPS Tracking Card - Top Left */}
                <motion.div
                  initial={{ opacity: 0, x: -50, y: -50 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="absolute top-8 left-8 w-40 sm:w-48 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-semibold text-gray-600">LIVE GPS</span>
                  </div>
                  <div className="w-full h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg mb-3 flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <p className="text-xs text-gray-600">45 vehicles active</p>
                </motion.div>

                {/* Revenue Analytics - Top Right */}
                <motion.div
                  initial={{ opacity: 0, x: 50, y: -50 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="absolute top-8 right-8 w-40 sm:w-48 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-600">REVENUE</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">₹2.4L</p>
                  <p className="text-xs text-emerald-600">↑ 12.5% this week</p>
                </motion.div>

                {/* Active Trips - Middle Left */}
                <motion.div
                  initial={{ opacity: 0, x: -50, y: 50 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="absolute bottom-20 left-8 w-40 sm:w-48 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30"
                >
                  <div className="text-xs font-semibold text-gray-600 mb-3">ACTIVE TRIPS</div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${60 + i * 10}%` }}
                          transition={{ delay: 0.8 + i * 0.1, duration: 1 }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">32 trips in progress</p>
                </motion.div>

                {/* Alerts - Middle Right */}
                <motion.div
                  initial={{ opacity: 0, x: 50, y: 50 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.8 }}
                  className="absolute bottom-20 right-8 w-40 sm:w-48 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <span className="text-xs font-semibold text-gray-600">ALERTS</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-gray-600">Vehicle maintenance due</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-gray-600">Speeding detected</span>
                    </div>
                  </div>
                </motion.div>

                {/* Center GST Invoice */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 w-48 sm:w-56 mx-auto"
                >
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/30">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <span className="text-xs font-semibold text-gray-600">GST INVOICE</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Invoice #:</span>
                        <span className="font-semibold">INV-2024-001</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-semibold">₹45,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">GST:</span>
                        <span className="font-semibold text-emerald-600">₹8,100</span>
                      </div>
                      <div className="h-px bg-gray-200 my-2" />
                      <div className="flex justify-between font-bold">
                        <span className="text-gray-900">Total:</span>
                        <span className="text-blue-600">₹53,100</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Mobile/Tablet View - Stacked Layout */}
              <div className="lg:hidden flex flex-col gap-4">
                {/* GST Invoice - Featured on mobile */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/30 w-full max-w-sm mx-auto"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <span className="text-xs font-semibold text-gray-600">GST INVOICE</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Invoice #:</span>
                      <span className="font-semibold">INV-2024-001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold">₹45,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">GST:</span>
                      <span className="font-semibold text-emerald-600">₹8,100</span>
                    </div>
                    <div className="h-px bg-gray-200 my-2" />
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-blue-600">₹53,100</span>
                    </div>
                  </div>
                </motion.div>

                {/* Revenue Analytics */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30 w-full max-w-sm mx-auto"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-600">REVENUE</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">₹2.4L</p>
                  <p className="text-xs text-emerald-600">↑ 12.5% this week</p>
                </motion.div>

                {/* GPS Tracking Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/30 w-full max-w-sm mx-auto"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-semibold text-gray-600">LIVE GPS</span>
                  </div>
                  <div className="w-full h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg mb-3 flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <p className="text-xs text-gray-600">45 vehicles active</p>
                </motion.div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  );
};
