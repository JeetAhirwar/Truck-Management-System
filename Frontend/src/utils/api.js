import axios from 'axios';
// Production (Vercel): set VITE_API_URL="https://truckappbackend.vercel.app/api"
// in the Vercel dashboard to call the backend directly. When unset, calls go
// to same-origin /api, which vercel.json proxies to the backend — this also
// avoids CORS issues entirely.
// Local dev: the Vite proxy (vite.config.js) forwards /api to localhost:5000.
// No default Content-Type: forcing application/json here makes axios convert
// FormData bodies to JSON (silently dropping the file) and breaks multipart.
// Axios sets application/json automatically for plain objects, and lets the
// browser set multipart/form-data + boundary for FormData.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {}
  return config;
});
api.interceptors.response.use(r => r, (err) => {
  try {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
  } catch (e) {}
  return Promise.reject(err);
});
export default api;
