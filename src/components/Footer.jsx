import { motion } from 'framer-motion';
import { FaInstagram, FaFacebook, FaXTwitter } from 'react-icons/fa6';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    Product: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Dashboard', href: '#dashboard' },
      { label: 'Security', href: '#' },
    ],
    Company: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
    Legal: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Cookies', href: '#' },
      { label: 'Disclaimer', href: '#' },
    ],
  };

  const social = [
    { icon: FaInstagram, href: '#', label: 'Instagram' },
    { icon: FaFacebook, href: '#', label: 'Facebook' },
    { icon: FaXTwitter, href: '#', label: 'X' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
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
    <footer className="bg-gray-900 relative overflow-hidden">
      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        animate={{ x: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16 grid grid-cols-1 md:grid-cols-4 gap-12"
        >
          {/* Brand */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">TO</span>
              </div>
              <span className="text-xl font-bold text-white">TrackOwl</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              India's smartest fleet operating system. Real-time tracking, automation, and analytics for modern logistics.
            </p>
          </motion.div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <motion.div key={category} variants={itemVariants}>
              <h3 className="font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800" />

        {/* Bottom Footer */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-8 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <motion.p variants={itemVariants} className="text-gray-400 text-sm">
            © {currentYear} TrackOwl. All rights reserved.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex items-center gap-6"
          >
            {social.map(({ icon: Icon, href, label }) => (
              <motion.a
                key={label}
                href={href}
                aria-label={label}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icon size={20} />
              </motion.a>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
};
