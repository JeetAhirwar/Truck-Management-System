import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import logo from '../assets/transparent- logo.png';
import darkLogo from '../assets/dark mode logo.png';

export default function Login() {
  const [email, setEmail] = useState('admin@truck.com');
  const [password, setPassword] = useState('admin123');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await login(email, password);
      if (r.success) navigate('/');
      else setError(r.error);
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-8 shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src={dark ? darkLogo : logo} alt="VTMS" className="w-24 h-24 object-contain" />
            <div className="text-left">
              <h1 className="text-xl font-bold leading-none">VTMS</h1>
              <p className="text-slate-500 mt-1.5 text-[11px] tracking-[0.28em] italic font-light">
                Vehicle &amp; Transport Management System
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-5">
            {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{error}</div>}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input pl-10" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="input pl-10 pr-10" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}{loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-6">Demo: admin@truck.com / admin123</p>
          <Link
            to="/marketing"
            className="mt-3 block text-center text-xs text-slate-400 hover:text-brand-500 transition-colors"
          >
            View marketing page ›
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
