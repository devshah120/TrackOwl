import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'How accurate is the GPS tracking?',
      answer: 'Our GPS tracking system provides accuracy up to 5 meters in real-time. We use a combination of satellite positioning and cellular data for optimal accuracy even in areas with weak signal.'
    },
    {
      question: 'Can I export my data?',
      answer: 'Yes! You can export all your data including trip history, invoices, and analytics in multiple formats (CSV, PDF, Excel). Your data is always yours to control.'
    },
    {
      question: 'Is there a setup fee?',
      answer: 'No hidden fees! You only pay the monthly subscription. Our onboarding team will help you get started at no additional cost.'
    },
    {
      question: 'How long does implementation take?',
      answer: 'You can be up and running within 24 hours. Our quick onboarding process gets your fleet tracked immediately. Most customers start seeing ROI within the first week.'
    },
    {
      question: 'Do you provide API access?',
      answer: 'Yes! Our REST API allows you to integrate TrackOwl with your existing systems. Enterprise plans include dedicated API support and custom integrations.'
    },
    {
      question: 'What if I need to scale or change plans?',
      answer: 'You can upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing. No long-term contracts required.'
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute top-1/2 left-1/4 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl"
        animate={{ y: [0, 40, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-blue-600 mb-4">FREQUENTLY ASKED</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Questions? We Have Answers
          </h2>
          <p className="text-lg text-gray-600">
            Everything you need to know about TrackOwl
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="glassmorphism rounded-2xl overflow-hidden border border-white/20"
            >
              <motion.button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <span className="text-lg font-semibold text-gray-900 text-left">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0 ml-4"
                >
                  <ChevronDown size={24} className="text-blue-600" />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden border-t border-white/10"
                  >
                    <p className="p-6 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
