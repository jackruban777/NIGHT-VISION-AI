import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'login') {
        await login(email || 'alex.mercer@nightvision.ai', password);
      } else if (mode === 'register') {
        await register(name || 'Alex Mercer', email || 'alex.mercer@nightvision.ai', password);
      } else {
        setMessage('Password reset instructions sent to your email.');
        setLoading(false);
        return;
      }
      setLoading(false);
      onClose();
    } catch (err) {
      setLoading(false);
      setMessage('Authentication failed. Please check credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md card-premium border border-outline-variant shadow-2xl p-6 md:p-8 space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-white rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent-electric/10 border border-accent-electric/30 flex items-center justify-center text-accent-electric">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold uppercase tracking-wider text-white">
            {mode === 'login' ? 'Driver Login' : mode === 'register' ? 'Register Vehicle' : 'Reset Access Key'}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {mode === 'login'
              ? 'Access NightVision AI Telemetry & ADAS Suite'
              : mode === 'register'
              ? 'Connect your vehicle to NightVision AI Mesh'
              : 'Enter your email to recover driver account credentials'}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full bg-surface-container border border-outline-variant focus:border-accent-electric text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@nightvision.ai"
                className="w-full bg-surface-container border border-outline-variant focus:border-accent-electric text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors font-sans"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider block">Security Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[10px] text-accent-electric hover:underline font-label-caps uppercase"
                  >
                    Forgot Key?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-on-surface-variant absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container border border-outline-variant focus:border-accent-electric text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors font-sans"
                />
              </div>
            </div>
          )}

          {message && (
            <div className="p-3 bg-accent-electric/10 border border-accent-electric/30 rounded-xl text-xs text-accent-electric text-center">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent-electric hover:bg-accent-electric/90 text-on-primary-fixed font-bold rounded-xl font-label-caps text-xs uppercase tracking-wider transition-all active:scale-95 shadow-[0_0_20px_rgba(0,229,255,0.25)] disabled:opacity-50"
          >
            {loading
              ? 'Authenticating...'
              : mode === 'login'
              ? 'Authenticate Session'
              : mode === 'register'
              ? 'Create Driver Profile'
              : 'Send Recovery Key'}
          </button>
        </form>

        {/* Google Authentication Option */}
        {mode !== 'forgot' && (
          <div className="space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-outline-variant"></div>
              <span className="bg-[#1B1B1D] px-3 text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider">OR</span>
            </div>

            <button
              onClick={async () => {
                await loginWithGoogle();
                onClose();
              }}
              className="w-full py-3 bg-surface-container hover:bg-surface-container-high text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-3 border border-outline-variant/60 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.2 8.9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.2-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Toggle Mode Footer */}
        <div className="text-center pt-2">
          {mode === 'login' ? (
            <p className="text-xs text-on-surface-variant">
              New driver?{' '}
              <button onClick={() => setMode('register')} className="text-accent-electric font-semibold hover:underline">
                Register Profile
              </button>
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">
              Already registered?{' '}
              <button onClick={() => setMode('login')} className="text-accent-electric font-semibold hover:underline">
                Sign In
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
