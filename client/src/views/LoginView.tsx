import React, { useState } from 'react';
import { Zap, Lock, User, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { success, error } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      error('Please enter your username and password', 'Missing Credentials');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.login({ username, password });
      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        success(`Welcome back, ${res.user.name}!`, 'Signed In');
      }
    } catch (err: any) {
      error(err.message || 'Invalid username or password', 'Authentication Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-amber-100 selection:text-amber-900">
      <div className="max-w-md w-full">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 text-white shadow-md mb-3">
            <Zap className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">UpVolt Manager</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise IoT Hardware Inventory & Business SaaS
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm shadow-sm transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </form>
        </div>

        {/* System Invariant Guarantee */}
        <div className="mt-6 text-center text-xs text-slate-400 font-mono">
          Strict FIFO Costing • Atomic Inventory Invariants
        </div>
      </div>
    </div>
  );
};
