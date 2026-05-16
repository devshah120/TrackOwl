import { motion } from 'framer-motion';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 justify-center';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-glow',
    secondary: 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
    accent: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg hover:shadow-glow-green',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const GlassButton = ({ children, className = '', ...props }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className={`glassmorphism px-6 py-3 rounded-lg font-semibold text-gray-900 backdrop-blur-md border border-white/20 hover:border-white/30 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};
