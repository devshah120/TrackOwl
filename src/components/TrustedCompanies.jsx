import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import DHLLogo from '../assets/dhl.svg';
import AmazonLogo from '../assets/amazon.svg';
import NestleLogo from '../assets/nestle.svg';
import FoxconnLogo from '../assets/foxconn.svg';
import ShopeeLogo from '../assets/shopee.svg';

const CountUpDisplay = ({ metric, index }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime = null;
    const duration = 4; // Increased from 2.5 to 4 seconds

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      setCount(Math.floor(metric.value * progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, metric.value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      onViewportEnter={() => setHasStarted(true)}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
      viewport={{ once: true }}
      className="glassmorphism rounded-2xl p-8 border border-white/20 text-center"
    >
      <motion.div
        className="text-4xl sm:text-5xl font-bold text-blue-600 mb-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.4 + index * 0.1, duration: 0.8 }}
        viewport={{ once: true }}
      >
        {count.toLocaleString()}+
      </motion.div>
      <p className="text-gray-800 font-semibold">{metric.label}</p>
    </motion.div>
  );
};

export const TrustedCompanies = () => {
  const companies = [
    { name: 'DHL', logo: DHLLogo },
    { name: 'Amazon', logo: AmazonLogo },
    { name: 'Nestle', logo: NestleLogo },
    { name: 'Foxconn', logo: FoxconnLogo },
    { name: 'Shopee', logo: ShopeeLogo },
  ];
  const metrics = [
    { label: 'Active Users', value: 1000 },
    { label: 'Daily Deliveries', value: 5000 },
    { label: 'Fleet Size', value: 3000 },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-sm font-semibold text-blue-600 mb-4">TRUSTED BY INDUSTRY LEADERS</p>
          <h2 className="text-4xl font-bold text-gray-900">
            Powering India's Fleet Logistics
          </h2>
        </motion.div>

        {/* Companies Logo Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="glassmorphism rounded-2xl p-8 border border-white/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-items-center">
              {companies.map((company, i) => (
                <motion.div
                  key={company.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="h-16 flex items-center justify-center"
                >
                  <img src={company.logo} alt={company.name} className="h-12 w-auto object-contain" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8"
        >
          {metrics.map((metric, i) => (
            <CountUpDisplay
              key={metric.label}
              metric={metric}
              index={i}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
