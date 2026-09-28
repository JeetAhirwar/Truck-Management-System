import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const saved = localStorage.getItem('user');
      if (token && saved) setUser(JSON.parse(saved));
    } catch (e) {} finally { setLoading(false); }
  }, []);
  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };
  const logout = () => {
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); } catch (e) {}
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
