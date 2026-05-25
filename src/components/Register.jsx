import { useState } from 'react';
import { Eye, EyeOff, User, Mail, Phone, Lock, Building2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loginTruckImg from '../assets/login-truck.jpg';
import { useAuth } from '../context/AuthContext';

export function Register({ onBackHome }) {
  const [step, setStep] = useState(1);
  const [alert, setAlert] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState(null);

  // Step 1 data
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');

  // Step 2 data
  const [company, setCompany] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { register, isLoading } = useAuth();
  const navigate = useNavigate();

  const fleetOptions = [
    { label: '1–5 trucks', value: '1–5 trucks' },
    { label: '6–20 trucks', value: '6–20 trucks' },
    { label: '21–50 trucks', value: '21–50 trucks' },
    { label: '50+ trucks', value: '50+ trucks' }
  ];

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const checkPasswordStrength = (pw) => {
    if (pw.length < 8) return 'weak';
    if (!/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'medium';
    return 'strong';
  };

  const handlePasswordChange = (e) => {
    const pw = e.target.value;
    setPassword(pw);
    setPasswordStrength(checkPasswordStrength(pw));
  };

  const validateStep1 = () => {
    const errors = {};

    if (!name.trim()) errors.name = 'Please enter your full name.';
    if (!email.trim() || !email.includes('@')) errors.email = 'Please enter a valid email.';
    if (!/^\d{10}$/.test(mobile.replace(/\D/g, ''))) errors.mobile = 'Enter a valid 10-digit mobile number.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';

    if (Object.keys(errors).length > 0) {
      Object.keys(errors).forEach(key => {
        showAlert(errors[key], 'error');
      });
      return false;
    }
    return true;
  };

  const handleStep1Continue = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const validateStep2 = () => {
    const errors = {};

    if (!company.trim()) errors.company = 'Please enter your company name.';
    if (!selectedFleet) errors.fleet = 'Please select your fleet size.';
    if (!termsAccepted) errors.terms = 'You must accept the terms.';

    if (Object.keys(errors).length > 0) {
      Object.keys(errors).forEach(key => {
        showAlert(errors[key], 'error');
      });
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;

    try {
      const emailLower = email.trim().toLowerCase();
      const response = await register({
        name,
        email: emailLower,
        password,
        mobile: mobile.replace(/\D/g, ''),
        company,
        fleet: selectedFleet
      });

      localStorage.setItem('to_session', JSON.stringify({
        name: response.user.name,
        email: response.user.email,
        company: response.user.company,
        fleet: response.user.fleet,
        role: response.user.role
      }));

      setStep(3);
    } catch (err) {
      showAlert(err.message || 'Registration failed. Please try again.', 'error');
    }
  };

  const getPasswordStrengthColor = () => {
    if (!password) return 'bg-slate-200';
    if (passwordStrength === 'weak') return 'bg-red-500';
    if (passwordStrength === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthLabel = () => {
    if (!password) return 'Enter password';
    if (passwordStrength === 'weak') return 'Too short';
    if (passwordStrength === 'medium') return 'Add uppercase & number';
    return 'Strong ✓';
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={loginTruckImg}
          alt="Fleet of trucks"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-blue-600/40"></div>

        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <div>
            <button onClick={onBackHome} className="flex items-center gap-2 text-white hover:opacity-80">
              <span className="text-xl font-bold">
                Track<span className="text-blue-600">Owl</span>
              </span>
            </button>
          </div>

          <div>
            <h2 className="text-4xl font-bold mb-4 font-display">
              Join 500+ fleet operators across India
            </h2>
            <p className="text-lg mb-12 text-white/90">
              Set up in under 2 minutes. Free trial — no credit card required.
            </p>

            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-3xl font-bold">Free</div>
                <div className="text-white/80">30-day trial</div>
              </div>
              <div>
                <div className="text-3xl font-bold">₹299</div>
                <div className="text-white/80">/ truck / mo</div>
              </div>
              <div>
                <div className="text-3xl font-bold">24/7</div>
                <div className="text-white/80">Support</div>
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
                Track<span className="text-blue-600">Owl</span>
              </span>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 font-display">
              {step === 1 && 'Create your account'}
              {step === 2 && 'Tell us about your fleet'}
              {step === 3 && 'Account created!'}
            </h1>
            <p className="text-slate-600 mt-2">
              {step === 1 && 'Free 30-day trial — no credit card needed'}
              {step === 2 && 'Almost done!'}
              {step === 3 && ''}
            </p>
          </div>

          {/* Steps Bar */}
          {step < 3 && (
            <div className="flex items-center justify-between mb-8">
              <div className={`flex flex-col items-center ${step >= 1 ? 'text-blue-600' : 'text-slate-300'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  1
                </div>
                <span className="text-xs mt-1">Account</span>
              </div>
              <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 2 ? 'text-blue-600' : 'text-slate-300'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  2
                </div>
                <span className="text-xs mt-1">Fleet</span>
              </div>
              <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 3 ? 'text-blue-600' : 'text-slate-300'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  ✓
                </div>
                <span className="text-xs mt-1">Done</span>
              </div>
            </div>
          )}

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

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rajesh Patel"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="name"
                  />
                </div>
              </div>

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

              {/* Mobile Field */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Mobile number</label>
                <div className="flex gap-2">
                  <div className="px-3 py-2 bg-slate-100 rounded-lg flex items-center text-sm text-slate-600 font-medium whitespace-nowrap">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    maxLength="10"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    onChange={handlePasswordChange}
                    placeholder="Min 8 characters"
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Bar */}
                <div className="mt-2">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${getPasswordStrengthColor()}`} style={{ width: password ? '100%' : '0%' }}></div>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">{getPasswordStrengthLabel()}</span>
                </div>
              </div>

              <button
                onClick={handleStep1Continue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-6"
              >
                Continue →
              </button>

              <p className="text-center text-sm text-slate-600">
                Already have an account? <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</a>
              </p>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Company Field */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Company / transport name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Patel Roadlines Pvt. Ltd."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Fleet Size Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-3">Fleet size</label>
                <div className="grid grid-cols-2 gap-3">
                  {fleetOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFleet(option.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-sm font-medium text-center ${
                        selectedFleet === option.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 mt-0.5 accent-blue-600"
                  />
                  I agree to TrackOwl's Terms of Service and Privacy Policy
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account…' : 'Create account & start trial'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2 font-display">Welcome to TrackOwl!</h2>
              <p className="text-slate-600 mb-6">Your account has been created successfully!</p>
              <button onClick={() => navigate('/dashboard')} className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-center">
                Open Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
