import { motion } from 'framer-motion';
import { Smartphone, BarChart3, MapPin } from 'lucide-react';

export const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Install GPS device',
      description: '₹2,000 one-time hardware. We fit tracker + SIM on your truck.',
      icon: MapPin,
      image: 'url(https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&q=80)',
    },
    {
      number: '02',
      title: 'Login to dashboard',
      description: 'Add trucks, drivers, parties — cloud sync in minutes.',
      icon: BarChart3,
      image: 'url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop)',
    },
    {
      number: '03',
      title: 'Track & bill',
      description: 'Live map + invoice + LR + ledger — grow every day.',
      icon: Smartphone,
      image: 'url(https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=300&fit=crop)',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
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
    <section className="py-20 relative overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-blue-600 mb-4">HOW IT WORKS</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Go live in 3 simple steps
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="group"
              >
                {/* Image Container */}
                <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden mb-6 shadow-lg">
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{
                      backgroundImage: step.image,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>

                {/* Step Number */}
                <div className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full font-bold text-lg mb-4">
                  {step.number}
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
