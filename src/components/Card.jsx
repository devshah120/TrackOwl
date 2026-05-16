import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hoverEffect = true, ...props }) => {
  const content = (
    <div
      className={`rounded-2xl p-6 bg-white backdrop-blur-md border border-gray-300 shadow-card card-hover ${className}`}
      {...props}
    >
      {children}
    </div>
  );

  if (!hoverEffect) return content;

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      {content}
    </motion.div>
  );
};

export const GlassCard = ({ children, className = '', gradient = false, ...props }) => {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      className={`glassmorphism-dark rounded-2xl p-8 backdrop-blur-xl border border-white/10 shadow-card-dark ${gradient ? 'bg-gradient-to-br from-blue-500/10 to-emerald-500/10' : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const BentoCard = ({
  icon: Icon,
  title,
  description,
  className = '',
  gradient = false,
  ...props
}) => {
  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)' }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-2xl overflow-hidden p-6 sm:p-8 bg-white border border-gray-200 shadow-lg ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-white backdrop-blur-md -z-10" />
      <div className="absolute inset-0 border border-gray-300 rounded-2xl -z-10" />

      {gradient && (
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-emerald-400/20 rounded-full blur-3xl -z-20" />
      )}

      {Icon && (
        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 flex items-center justify-center mb-4 shadow-lg"
        >
          <Icon size={32} className="text-white" />
        </motion.div>
      )}

      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{description}</p>
    </motion.div>
  );
};
