/**
 * NotificationsContext — owns the global notification feed.
 *
 *  - Loads the latest notifications + unread count from `/api/notifications`.
 *  - Attaches a Socket.IO listener while authenticated: every pushed
 *    `notification:new` is prepended, the badge bumps and a toast slides in.
 *  - Always keeps a REST polling fallback (60s + on tab focus) so the feed
 *    stays fresh even when the socket isn't available (Vercel serverless).
 *
 * Mount the provider inside AuthProvider (it needs the logged-in user).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Snackbar } from '@mui/material';
import {
  AccountBalanceWallet,
  Build,
  Cancel,
  CheckCircle,
  Description,
  Info,
  LocalShipping,
  NotificationsNone,
  Route as RouteIcon,
  WarningAmber,
} from '@mui/icons-material';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { getNotificationSocket } from '../sockets/notificationSocket';

const NotificationsContext = createContext(null);

/* ---------------------------------------------------------------- helpers */
const SEVERITY_TONE = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

export const typeMeta = (type) => {
  switch (type) {
    case 'document_expired':
      return { icon: Description, tone: SEVERITY_TONE.critical, label: 'Expired document' };
    case 'document_expiring':
      return { icon: WarningAmber, tone: SEVERITY_TONE.warning, label: 'Expiring document' };
    case 'fastag_low':
      return { icon: AccountBalanceWallet, tone: SEVERITY_TONE.critical, label: 'FASTag' };
    case 'maintenance_due':
      return { icon: Build, tone: '#ea580c', label: 'Maintenance' };
    case 'trip_started':
      return { icon: RouteIcon, tone: '#2563eb', label: 'Trip' };
    case 'trip_completed':
      return { icon: CheckCircle, tone: '#059669', label: 'Trip' };
    case 'trip_cancelled':
      return { icon: Cancel, tone: SEVERITY_TONE.critical, label: 'Trip' };
    case 'truck_created':
      return { icon: LocalShipping, tone: '#2563eb', label: 'Truck' };
    case 'system':
      return { icon: Info, tone: '#0284c7', label: 'System' };
    default:
      return { icon: NotificationsNone, tone: SEVERITY_TONE.info, label: 'Update' };
  }
};

export function timeAgo(iso) {
  if (!iso) return '';
  try {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
}

/* -------------------------------------------------------------- provider */
export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const itemsRef = useRef([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/unread-count'),
      ]);
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      itemsRef.current = list;
      setItems(list);
      setUnread(Number(countRes.data?.count || 0));
    } catch (e) {
      /* silent — next poll retries */
    }
  }, [isAuthenticated]);

  const onPush = useCallback((n) => {
    if (!n || !n._id) return;
    const deduped = [n, ...itemsRef.current.filter((x) => x._id !== n._id)].slice(0, 100);
    itemsRef.current = deduped;
    setItems(deduped);
    setUnread((u) => u + 1);
    setToast({
      id: n._id,
      severity: n.severity === 'critical' ? 'error' : n.severity === 'warning' ? 'warning' : 'info',
      title: n.title,
      message: n.message,
    });
  }, []);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (e) {}
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
    setUnread(0);
    try {
      await api.patch('/notifications/read-all');
    } catch (e) {}
  }, []);

  // Live socket (only when the environment allows it — see socket module).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = getNotificationSocket();
    if (!socket) return undefined;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    setConnected(socket.connected);
    socket.on('notification:new', onPush);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('notification:new', onPush);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [isAuthenticated, onPush]);

  // Start with the stored feed, then poll as a fallback everywhere.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({ items, unread, connected, refresh, markRead, markAllRead }),
    [items, unread, connected, refresh, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast?.severity || 'info'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ alignItems: 'center', maxWidth: 440 }}
        >
          <strong>{toast?.title}</strong>
          {toast?.message ? ` · ${toast.message}` : ''}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);