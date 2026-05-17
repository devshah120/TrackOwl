import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import loginTruckImg from '../assets/login-truck.jpg';

export function Login({ onBackHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const USERS = [
    { name: 'Dipesh', email: 'hello@trackowl.in', password: 'TrackOwl@2026', company: 'TrackOwl', fleet: '50+ trucks', role: 'admin' },
    { name: 'Demo Client', email: 'demo@trackowl.in', password: 'Demo@1234', company: 'Demo Transport Co.', fleet: '6–20 trucks', role: 'client' }
  ];

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);

    const emailLower = email.trim().toLowerCase();
    const errors = {};

    if (!emailLower || !emailLower.includes('@')) {
      errors.email = 'Please enter a valid email.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    setTimeout(() => {
      let user = USERS.find(u => u.email === emailLower);

      if (!user) {
        try {
          const reg = JSON.parse(localStorage.getItem('to_users') || '[]');
          user = reg.find(u => u.email === emailLower);
        } catch (e) {}
      }

      if (!user) {
        showAlert('No account found with this email.', 'error');
        setLoading(false);
        return;
      }

      if (user.password !== password) {
        showAlert('Incorrect password. Please try again.', 'error');
        setLoading(false);
        return;
      }

      localStorage.setItem('to_session', JSON.stringify({
        name: user.name,
        email: user.email,
        company: user.company,
        fleet: user.fleet,
        role: user.role
      }));

      showAlert(`Welcome, ${user.name}! Opening dashboard…`, 'success');
      setTimeout(() => {
        window.location.href = user.role === 'admin' ? 'super-admin.html' : 'dashboard.html';
      }, 700);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={loginTruckImg}
          alt="Fleet trucks"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-blue-600/40"></div>

        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <div>
            <button onClick={onBackHome} className="flex items-center gap-2 text-white hover:opacity-80">
              <span className="text-xl font-bold">
                Track<span className="text-amber-300">Owl</span>
              </span>
            </button>
          </div>

          <div>
            <h2 className="text-4xl font-bold mb-4 font-display">
              India's smartest fleet tracking &amp; billing platform
            </h2>
            <p className="text-lg mb-12 text-white/90">
              Live GPS maps, GST invoices, LR generation, and daily ledger — all in one dashboard.
            </p>

            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-3xl font-bold">500+</div>
                <div className="text-white/80">Fleets</div>
              </div>
              <div>
                <div className="text-3xl font-bold">12K+</div>
                <div className="text-white/80">Trucks</div>
              </div>
              <div>
                <div className="text-3xl font-bold">₹299</div>
                <div className="text-white/80">/ truck / mo</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <button onClick={onBackHome} className="lg:hidden flex items-center gap-2 mb-6 text-slate-900 hover:opacity-70">
              <span className="text-xl font-bold">
                Track<span className="text-amber-300">Owl</span>
              </span>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 font-display">Welcome back</h1>
            <p className="text-slate-600 mt-2">Sign in to your fleet dashboard</p>
          </div>

          {/* Alert Box */}
          {alert && (
            <div className={`flex gap-3 p-4 rounded-lg mb-6 text-sm ${
              alert.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' :
              alert.type === 'success' ? 'bg-green-50 text-green-900 border border-green-200' :
              'bg-blue-50 text-blue-900 border border-blue-200'
            }`}>
              <span>{alert.msg}</span>
            </div>
          )}


          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700">Forgot password?</a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-sm text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* WhatsApp Button */}
          <a
            href="https://wa.me/919727419800"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FaWhatsapp className="w-4 h-4" />
            Contact support on WhatsApp
          </a>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-slate-600">
            New client? <a href="/register" className="text-blue-600 hover:text-blue-700 font-medium">Register your fleet →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
