import { motion } from 'framer-motion';
import fleetImg from '../assets/gallery-fleet.jpg';
import logisticsImg from '../assets/gallery-logistics.jpg';
import roadImg from '../assets/gallery-road.jpg';
import '../styles/gallery.css';

export const ProductShowcaseSection = () => {
  const showcases = [
    {
      title: 'Fleet overview',
      image: fleetImg,
    },
    {
      title: 'Logistics hub',
      image: logisticsImg,
    },
    {
      title: 'On the road',
      image: roadImg,
    },
  ];

  return (
    <section className="py-20 relative overflow-hidden bg-white gallery-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Built for Indian highways & fleets
          </h2>
          <p className="text-xl text-gray-600">
            From single truck owners to 50+ vehicle operators
          </p>
        </motion.div>

        <div className="gallery-grid">
          {/* Large Card - Fleet overview */}
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="gallery-item gallery-item-wide"
          >
            <img
              src={showcases[0].image}
              alt={showcases[0].title}
              loading="lazy"
            />
            <figcaption>{showcases[0].title}</figcaption>
          </motion.figure>

          {/* Small Card - Logistics hub */}
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="gallery-item"
          >
            <img
              src={showcases[1].image}
              alt={showcases[1].title}
              loading="lazy"
            />
            <figcaption>{showcases[1].title}</figcaption>
          </motion.figure>

          {/* Small Card - On the road */}
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="gallery-item"
          >
            <img
              src={showcases[2].image}
              alt={showcases[2].title}
              loading="lazy"
            />
            <figcaption>{showcases[2].title}</figcaption>
          </motion.figure>
        </div>
      </div>
    </section>
  );
};
