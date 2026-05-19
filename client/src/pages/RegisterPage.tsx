import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      login(data.token, data.user);
      toast.success('Account created!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-roadtrip-900 to-gray-900 px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 40% 30%, #0066ff 0%, transparent 50%), radial-gradient(circle at 60% 70%, #0066ff 0%, transparent 50%)' }} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <svg className="w-14 h-14 text-roadtrip-400 mx-auto mb-4" viewBox="0 0 100 100" fill="currentColor">
            <path d="M30 65 L50 25 L70 65 Z" />
          </svg>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-white/50 text-sm mt-2">Start sharing your roadtrips</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Name</label>
              <input type="text" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <input type="email" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <input type="password" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-roadtrip-600 hover:bg-roadtrip-500 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 shadow-lg shadow-roadtrip-600/25">
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-white/40 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-roadtrip-400 font-medium hover:text-roadtrip-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
