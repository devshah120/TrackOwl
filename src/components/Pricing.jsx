import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Check, User, Users } from 'lucide-react';

export const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: 'Starter',
      description: 'For small fleets',
      monthlyPrice: 999,
      yearlyPrice: 9990,
      features: [
        'Up to 5 vehicles',
        'Basic GPS tracking',
        'Monthly reports',
        'Email support',
        'Basic analytics',
      ],
      highlight: false,
    },
    {
      name: 'Professional',
      description: 'For growing businesses',
      monthlyPrice: 4999,
      yearlyPrice: 49990,
      features: [
        'Up to 50 vehicles',
        'Real-time GPS tracking',
        'GST invoice automation',
        'Trip history & analytics',
        'Driver management',
        'Customer tracking links',
        'Priority support',
        'Advanced reporting',
        'Mobile app access',
      ],
      highlight: true,
    },
    {
      name: 'Enterprise',
      description: 'For large operations',
      monthlyPrice: 9999,
      yearlyPrice: 99990,
      features: [
        'Unlimited vehicles',
        'Real-time GPS tracking',
        'Full GST automation',
        'Advanced analytics & BI',
        'Multi-user management',
        'Custom integrations',
        'Dedicated support',
        'Custom workflows',
        'On-premise deployment',
      ],
      highlight: false,
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
    <section id="pricing" className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl"
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
          <p className="text-sm font-semibold text-blue-600 mb-4">SIMPLE PRICING</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Plans for Every Size Fleet
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your fleet. Always flexible, always fair.
          </p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-4 bg-gray-200 rounded-full p-1"
          >
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                !isYearly
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <User size={20} />
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                isYearly
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Users size={20} />
              Yearly
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={itemVariants}
              className={`relative ${plan.highlight ? 'md:scale-105' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold text-sm shadow-lg"
                  >
                    Most Popular
                  </motion.div>
                </div>
              )}

              <div className={`rounded-2xl p-8 h-full flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? 'bg-white border-2 border-blue-600 shadow-2xl'
                  : 'glassmorphism border-white/20'
              }`}>
                <div className="mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${
                    plan.highlight ? 'text-gray-900' : 'text-gray-900'
                  }`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${
                    plan.highlight ? 'text-gray-600' : 'text-gray-600'
                  }`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2 mb-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isYearly ? 'yearly' : 'monthly'}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                      >
                        <span className={`text-5xl font-bold ${
                          plan.highlight ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          ₹{isYearly ? plan.yearlyPrice.toLocaleString() : plan.monthlyPrice.toLocaleString()}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                    <span className={plan.highlight ? 'text-gray-600' : 'text-gray-600'}>
                      {isYearly ? '/year' : '/month'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    plan.highlight ? 'text-gray-600' : 'text-gray-600'
                  }`}>
                    {isYearly
                      ? `₹${(plan.yearlyPrice / 12).toLocaleString()}/month billed annually`
                      : 'Billed monthly'}
                  </p>
                </div>

                <Button
                  variant={plan.highlight ? 'accent' : 'primary'}
                  size="lg"
                  className="w-full mb-8"
                >
                  Get Started
                </Button>

                <div className="space-y-4 flex-1">
                  {plan.features.map((feature) => (
                    <motion.div
                      key={feature}
                      whileHover={{ x: 5 }}
                      className="flex items-center gap-3"
                    >
                      <Check size={20} className="text-emerald-500 flex-shrink-0" />
                      <span className={plan.highlight ? 'text-gray-700' : 'text-gray-700'}>
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
