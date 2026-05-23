import { useState, useEffect } from 'react';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loginTruckImg from '../assets/login-truck.jpg';

export function ForgotPassword({ onBackHome }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [countdown, setCountdown] = useState(600);
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: '', color: '' });
  const [canResend, setCanResend] = useState(false);

  const API_URL = 'http://localhost:5000/api/auth';

  useEffect(() => {
    if (step === 2 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, step]);

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const maskEmail = (email) => {
    return email.replace(/(.{2})(.*)(@.*)/, '$1****$3');
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkPasswordStrength = (password) => {
    if (password.length < 8) {
      setPasswordStrength({ level: 'Too short', color: 'bg-red-500' });
    } else if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
      setPasswordStrength({ level: 'Add uppercase & number', color: 'bg-yellow-500' });
    } else {
      setPasswordStrength({ level: 'Strong password ✓', color: 'bg-green-500' });
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const sendOTP = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      showAlert('Please enter a valid email address', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Failed to send OTP', 'error');
        return;
      }

      setMaskedEmail(data.maskedEmail);
      setCountdown(600);
      setCanResend(false);
      setStep(2);
      showAlert('OTP sent to your email', 'success');
    } catch (error) {
      showAlert('Network error: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Failed to resend OTP', 'error');
        return;
      }

      setCountdown(600);
      setCanResend(false);
      showAlert('New OTP sent to your email', 'info');
    } catch (error) {
      showAlert('Network error: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length < 6) {
      showAlert('Please enter all 6 digits', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'OTP verification failed', 'error');
        return;
      }

      setResetToken(data.resetToken);
      setStep(3);
      showAlert('OTP verified! Set your new password', 'success');
    } catch (error) {
      showAlert('Network error: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showAlert('Password must be at least 8 characters with uppercase and number', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Password reset failed', 'error');
        return;
      }

      showAlert('Password reset successfully! Redirecting to login…', 'success');
      setTimeout(() => window.location.href = '/login', 1500);
    } catch (error) {
      showAlert('Network error: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
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
            <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-white hover:opacity-80">
              <span className="text-xl font-bold">
                Track<span className="text-amber-300">Owl</span>
              </span>
            </button>
          </div>

          <div>
            <h2 className="text-4xl font-bold mb-4 font-display">
              Secure account recovery via email OTP
            </h2>
            <p className="text-lg text-white/90">
              We'll send a 6-digit OTP to your registered email. Valid for 10 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <button onClick={() => navigate('/login')} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft size={20} />
              Back to login
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {step === 1 && 'Forgot password?'}
              {step === 2 && 'Enter OTP'}
              {step === 3 && 'Set new password'}
            </h1>
            <p className="text-gray-600 mt-2">
              {step === 1 && 'Enter your registered email address'}
              {step === 2 && 'Check your email for the 6-digit code'}
              {step === 3 && 'Choose a strong new password'}
            </p>
          </div>

          {/* Step Progress Bar */}
          <div className="mb-10">
            {/* Background lines container */}
            <div className="flex items-center justify-between mb-6 relative h-16">
              {/* Gray background line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 -translate-y-1/2"></div>

              {/* Blue progress line */}
              <div
                className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 transition-all duration-300"
                style={{
                  width: step === 1 ? '0%' : step === 2 ? '50%' : '100%'
                }}
              ></div>

              {/* Step circles with labels */}
              <div className="flex flex-col items-center relative z-20 bg-white">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all relative z-20 ${
                    step >= 1
                      ? step === 1
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step > 1 ? '✓' : 1}
                </div>
                <p className={`text-xs font-medium mt-2 ${
                  step >= 1 ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Email
                </p>
              </div>

              <div className="flex flex-col items-center relative z-20 bg-white">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all relative z-20 ${
                    step >= 2
                      ? step === 2
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step > 2 ? '✓' : 2}
                </div>
                <p className={`text-xs font-medium mt-2 ${
                  step >= 2 ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  OTP
                </p>
              </div>

              <div className="flex flex-col items-center relative z-20 bg-white">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all relative z-20 ${
                    step >= 3
                      ? step === 3
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step > 3 ? '✓' : 3}
                </div>
                <p className={`text-xs font-medium mt-2 ${
                  step >= 3 ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Password
                </p>
              </div>
            </div>
          </div>

          {/* Alert - Only show errors */}
          {alert && alert.type === 'error' && (
            <div
              className={`p-4 rounded-lg mb-6 flex items-center gap-2 text-sm bg-red-50 text-red-800 border border-red-200`}
            >
              <span>⚠️</span>
              <span>{alert.msg}</span>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={sendOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address (registered with TrackOwl)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <form onSubmit={verifyOTP} className="space-y-6">
              <p className="text-sm text-gray-600">
                OTP sent to <strong>{maskedEmail}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Enter 6-digit OTP
                </label>
                <div className="flex gap-3 justify-center">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      maxLength="1"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        digit ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span>Expires in <strong>{formatCountdown(countdown)}</strong></span>
                <button
                  type="button"
                  onClick={resendOTP}
                  disabled={!canResend || isLoading}
                  className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 font-semibold"
                >
                  Resend OTP
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp(['', '', '', '', '', '']);
                }}
                className="w-full text-gray-600 hover:text-gray-900 py-2"
              >
                ← Change email
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={resetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      checkPasswordStrength(e.target.value);
                    }}
                    placeholder="Min 8 characters"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${(newPassword.length / 16) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-1">{passwordStrength.level}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
