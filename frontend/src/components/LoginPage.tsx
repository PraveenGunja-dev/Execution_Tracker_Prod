import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/application#analytics';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);

      // Set flag to show tracker after login if coming from analytics page
      if (redirect.includes('application')) {
        localStorage.setItem('showTrackerAfterLogin', 'true');
      }

      // Redirect to the intended page
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    // In a real app, you would check if the user is already logged in
    // and redirect them if they are
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0B74B0]/10 to-[#75479C]/10 dark:from-gray-900 dark:to-gray-800 p-4"
    >
      {/* Login Card */}
      <div className="relative z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden w-full max-w-md">
        {/* Header with gradient */}
        <div className="bg-linear-to-r from-[#0B74B0] to-[#75479C] p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#0B74B0]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Welcome Back
          </h2>
          <p className="text-blue-100">
            Sign in to continue
          </p>
        </div>

        <div className="p-10">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[#BD3861]/10 text-[#BD3861] rounded-xl text-xs border border-[#BD3861]/20 font-bold uppercase tracking-widest">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {/* SSO Login Button (The single primary action) */}
          <button
            onClick={() => window.location.href = `${API_BASE}/api/sso/login`}
            className="w-full mb-8 py-4 bg-linear-to-r from-[#0B74B0] via-[#75479C] to-[#BD3861] text-white rounded-xl font-black uppercase tracking-[0.2em] transition-all duration-300 ease-in-out transform hover:scale-[1.02] flex items-center justify-center shadow-[0_10px_20px_rgba(11,116,176,0.3)] border border-white/10"
          >
            Login with Adani SSO
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.4em]">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 font-bold">or use credentials</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B74B0] focus:border-[#0B74B0] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B74B0] focus:border-[#0B74B0] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-[#0B74B0] to-[#75479C] hover:from-[#0B74B0]/90 hover:to-[#75479C]/90 text-white font-medium py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} Adani Group. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}