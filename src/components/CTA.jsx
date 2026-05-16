import { motion } from 'framer-motion';
import { Button } from './Button';
import { ArrowRight } from 'lucide-react';

export const CTA = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 opacity-10"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl"
        animate={{ y: [0, -40, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-400/30 rounded-full blur-3xl"
        animate={{ y: [0, 40, 0] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Fleet?
          </h2>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Join thousands of fleet operators who are already using TrackOwl to
            streamline operations and maximize efficiency.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button variant="primary" size="lg">
              Start Free Trial <ArrowRight size={20} />
            </Button>
            <Button variant="secondary" size="lg">
              Schedule Demo
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            viewport={{ once: true }}
            className="text-sm text-gray-500 mt-6"
          >
            14-day free trial • No credit card required • Cancel anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};
