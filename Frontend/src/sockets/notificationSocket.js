/**
 * Socket.IO client for the real-time notification push.
 *
 * Dev/build behaviour:
 *  - Local dev   (`npm run dev`): socket connects to the same origin and the
 *    Vite proxy forwards `/socket.io` to the Node backend on :5000. Instant.
 *  - Production  (`npm run build`): the backend is a Vercel serverless app
 *    which cannot hold long-lived websocket connections, so the socket stays
 *    off by default and the NotificationContext falls back to REST polling.
 *    Set VITE_SOCKET_ENABLED="1" when the backend runs on an always-on Node
 *    host (Railway / Render / Fly / a VPS) to re-enable instant push.
 */
import { io } from 'socket.io-client';

const ENABLED = import.meta.env.DEV || import.meta.env.VITE_SOCKET_ENABLED === '1';

let socket = null;

function resolveOrigin() {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  // Same-origin: the Vite/vercel proxy terminates /api, so the socket also
  // rides the same host.
  if (!apiBase || apiBase === '/api') return window.location.origin;
  return new URL(apiBase, window.location.origin).origin;
}

/**
 * Returns the shared notification socket, or `null` when realtime is disabled
 * for this environment. The caller must handle the null case.
 */
export function getNotificationSocket() {
  if (!ENABLED) return null;
  if (socket) return socket;

  let token = '';
  try {
    token = localStorage.getItem('token') || '';
  } catch (e) {}

  socket = io(resolveOrigin(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  // Failed handshake (bad/missing token, prod without Node) -> let the REST
  // poller carry the feed; never spam the console.
  socket.on('connect_error', () => {});
  return socket;
}

export function disposeNotificationSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}