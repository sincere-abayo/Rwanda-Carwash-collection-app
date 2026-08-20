import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, Loader2, Droplets, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuthStore();
  const navigate = useNavigate();

  // If already logged in (e.g. session restored from storage), redirect immediately
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/field', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials.');
      
      login(data.user, data.token);
      
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/field');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 md:p-8 bg-slate-900 text-slate-100 relative overflow-hidden">
      {/* Background Graphic */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.25),rgba(255,255,255,0))] -z-10" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl overflow-hidden backdrop-blur-xl">
        
        {/* Left Column: Branding (Desktop only) */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-blue-900/60 via-slate-900 to-slate-950 p-8 flex-col justify-between border-r border-slate-700/60">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-xl tracking-tight text-white block">CYESHA</span>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">National Registry</span>
              </div>
            </div>

            <div className="mt-12 space-y-5">
              <h2 className="text-xl font-bold text-white leading-snug">
                Official Carwash Geospatial & Operational Database
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Centralized registry for Rwanda's commercial vehicle washing facilities, water usage audits, and environmental compliance.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Offline-First Field Data Synchronization</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>High-Precision GPS Coordinates & Mapping</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>5-Province Administrative Hierarchy</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Republic of Rwanda</span>
            <span>Version 2.4.0</span>
          </div>
        </div>

        {/* Right Column: Form (Mobile & Desktop) */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          
          {/* Mobile Top Brand Header */}
          <div className="md:hidden text-center mb-6">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
              <Droplets className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-white">CYESHA Registry</h1>
            <p className="text-slate-400 text-xs mt-1">Rwanda Carwash Management Portal</p>
          </div>

          <div className="mb-6 hidden md:block">
            <h1 className="text-xl font-bold text-white">Sign In to Account</h1>
            <p className="text-slate-400 text-xs mt-1">Enter your assigned username and password to proceed</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Username
              </label>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-900/80 text-white text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-900/80 text-white text-sm"
                required
              />
            </div>

            {error && (
              <div className="p-3 text-xs text-red-400 bg-red-950/50 border border-red-800/60 rounded-xl">
                {error}
              </div>
            )}

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/30 disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Sign In to System</span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

