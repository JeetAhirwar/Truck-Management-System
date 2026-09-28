import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Marketing from './pages/Marketing';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import Trucks from './pages/Trucks';
import Drivers from './pages/Drivers';
import Documents from './pages/Documents';
import Calculator from './pages/Calculator';
import Trips from './pages/Trips';
import Settings from './pages/Settings';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/marketing" element={<Marketing />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="trucks" element={<Trucks />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="documents" element={<Documents />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="trips" element={<Trips />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
