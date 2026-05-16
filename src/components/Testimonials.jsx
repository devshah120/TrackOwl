import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

export const Testimonials = () => {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      company: 'Kumar Logistics',
      role: 'Founder & CEO',
      avatar: 'RK',
      text: 'TrackOwl has transformed how we manage our 50+ vehicle fleet. The real-time tracking and automated invoicing have cut our administrative overhead by 60%.',
      rating: 5
    },
    {
      name: 'Priya Sharma',
      company: 'Sharma Express',
      role: 'Operations Head',
      avatar: 'PS',
      text: 'The GST invoice automation alone has saved us thousands of hours. Our drivers love the mobile app, and customers appreciate the tracking links.',
      rating: 5
    },
    {
      name: 'Amit Patel',
      company: 'Patel Fleet Management',
      role: 'Fleet Manager',
      avatar: 'AP',
      text: 'From GPS tracking to expense management, everything is in one place. The analytics dashboard gives us insights we never had before.',
      rating: 5
    },
    {
      name: 'Neha Reddy',
      company: 'Reddy Transport Co.',
      role: 'Director',
      avatar: 'NR',
      text: 'Customer satisfaction has increased dramatically since we started sharing tracking links. TrackOwl made us a more professional operation.',
      rating: 5
    },
  ];

  const next = () => {
    setCurrent((current + 1) % testimonials.length);
  };

  const prev = () => {
    setCurrent((current - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    if (!autoplay) return;

    const interval = setInterval(() => {
      setCurrent((current + 1) % testimonials.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [autoplay, current, testimonials.length]);

  return (
    <section id="testimonials" className="py-20 relative overflow-hidden bg-white">
      <motion.div
        className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"
        animate={{ y: [0, -40, 0] }}
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
          <p className="text-sm font-semibold text-blue-600 mb-4">WHAT CUSTOMERS SAY</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Trusted by Industry Leaders
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of fleet operators who've transformed their business with TrackOwl
          </p>
        </motion.div>

        {/* Slider Container */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              <div className="glassmorphism rounded-2xl p-8 sm:p-12 border border-white/20 max-w-2xl mx-auto">
                {/* Stars */}
                <div className="flex gap-2 mb-6">
                  {[...Array(testimonials[current].rating)].map((_, i) => (
                    <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-lg sm:text-xl text-gray-700 mb-8 italic leading-relaxed">
                  "{testimonials[current].text}"
                </p>

                {/* Author Info */}
                <div className="flex items-center gap-4 pt-8 border-t border-white/20">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                    {testimonials[current].avatar}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{testimonials[current].name}</p>
                    <p className="text-sm text-gray-600">{testimonials[current].role}</p>
                    <p className="text-sm text-blue-600 font-semibold">{testimonials[current].company}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex gap-4 justify-center items-center mt-12">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                prev();
                setAutoplay(false);
              }}
              className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg"
            >
              <ChevronLeft size={24} />
            </motion.button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <motion.button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === current ? 'bg-blue-600 w-8' : 'bg-gray-300'
                  }`}
                  whileHover={{ scale: 1.2 }}
                />
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                next();
                setAutoplay(false);
              }}
              className="p-3 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg"
            >
              <ChevronRight size={24} />
            </motion.button>
          </div>

          {/* Counter */}
          <div className="text-center mt-8">
            <p className="text-gray-600">
              {current + 1} / {testimonials.length}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
