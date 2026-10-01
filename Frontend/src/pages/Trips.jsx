import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  Chip,
  IconButton,
  LinearProgress,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Block,
  Visibility as VisibilityIcon,
  Search,
  Percent,
  Refresh,
  Route as RouteIcon,
  TrendingDown,
  TrendingUp,
  CurrencyRupee,
  CheckCircleOutlined,
  DirectionsCar,
} from '@mui/icons-material';
import api from '../utils/api';
import TripDetailsModal, { statusMeta } from '../components/TripDetailsModal';
import CancelTripDialog from '../components/CancelTripDialog';
import {
  EmptyState,
  PageHeader,
  SearchField,
  SoftChip,
  StatCard,
  StatGrid,
} from '../components/ui';

const rupees = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const shortRoute = (trip) => {
  const from = (trip.from || trip.origin?.label || '?').split(',')[0];
  const to = (trip.to || trip.destination?.label || '?').split(',')[0];
  return `${from} → ${to}`;
};

function ProfitCell({ trip }) {
  // A cancelled trip never earned anything, so the only real number left is
  // what was spent getting it ready.
  const cancelled = trip.status === 'Cancelled';
  const value = cancelled ? -Number(trip.totalExpense || 0) : Number(trip.profit || 0);
  const profitable = !cancelled && value >= 0;
  const Icon = profitable ? TrendingUp : TrendingDown;
  return (
    <Stack direction="row" spacing={0.75}  sx={{ alignItems: 'center' }}>
      <Icon sx={{ fontSize: 16, color: profitable ? 'success.main' : 'error.main' }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: profitable ? 'success.main' : 'error.main' }}>
          {rupees(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {cancelled ? 'spent, none earned' : `${trip.profitPercent}%`}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function Trips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' });
  // Trip waiting for a cancellation reason in the dialog.
  const [cancelling, setCancelling] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/trips');
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Applies a patch, refreshes state, returns the updated trip — or null so
     callers (the cancel dialog) can keep their own error inline. */
  const updateTrip = async (id, patch, onError) => {
    setUpdating(true);
    try {
      const { data } = await api.put(`/trips/${id}`, patch);
      setTrips((list) => list.map((t) => (t._id === id ? { ...t, ...data } : t)));
      setSelected((cur) => (cur && cur._id === id ? { ...cur, ...data } : cur));
      if (patch.status === 'Completed') {
        setSnack({
          open: true,
          severity: 'success',
          message: `${data.tripId} completed — ${data.truckNumber} is back in the pool.`,
        });
      }
      if (patch.status === 'Cancelled') {
        setSnack({
          open: true,
          severity: 'warning',
          message: `${data.tripId} cancelled — excluded from revenue, shown under losses.`,
        });
      }
      return data;
    } catch (err) {
      const message = err.response?.data?.error || 'Could not update trip';
      if (onError) onError(message);
      else setError(message);
      return null;
    } finally {
      setUpdating(false);
    }
  };

  const requestCancel = (trip) => {
    setCancelling(trip);
    setCancelError('');
  };

  const confirmCancel = async (reason) => {
    if (!cancelling) return;
    setCancelBusy(true);
    setCancelError('');
    const data = await updateTrip(
      cancelling._id,
      { status: 'Cancelled', cancelReason: reason },
      setCancelError
    );
    setCancelBusy(false);
    if (data) setCancelling(null);
  };

  /* Completing with updated numbers happens on the calculator. */
  const editTrip = (id) => {
    setSelected(null);
    navigate('/calculator', { state: { completeTripId: id } });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return [t.tripId, t.truckNumber, t.from, t.to, t.customer]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [trips, search, statusFilter]);

  const activeCount = trips.filter((t) => !['Completed', 'Cancelled'].includes(t.status)).length;
  /* Cancelled trips never earned anything, so earnings — including the net
     figure in the header — only ever count trips that actually ran. */
  const totalProfit = trips
    .filter((t) => t.status !== 'Cancelled')
    .reduce((sum, t) => sum + (t.profit || 0), 0);

  /* The cards answer the question of the selected status filter: earnings for
     the views that ran, loss for Cancelled. They track the visible rows. */
  const cards = useMemo(() => {
    const sum = (key, list) => list.reduce((s, t) => s + (Number(t[key]) || 0), 0);
    const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
    const isCancelled = (t) => t.status === 'Cancelled';
    const live = filtered.filter((t) => !isCancelled(t));

    if (statusFilter === 'Cancelled') {
      const lost = sum('revenue', filtered);
      const spent = sum('totalExpense', filtered);
      const rate = pct(trips.filter(isCancelled).length, trips.length);
      return [
        { icon: Block, label: 'Cancelled', value: filtered.length, tone: '#dc2626', hint: 'Trips called off', delay: 0 },
        { icon: CurrencyRupee, label: 'Revenue lost', value: rupees(lost), tone: '#d97706', hint: 'Booked but never earned', delay: 0.04 },
        { icon: TrendingDown, label: 'Money spent', value: rupees(spent), tone: '#dc2626', hint: 'Cost with no income', delay: 0.08 },
        { icon: Percent, label: 'Cancel rate', value: `${rate}%`, tone: '#7c3aed', hint: 'of all trips', delay: 0.12 },
      ];
    }

    if (statusFilter === 'Completed') {
      const revenue = sum('revenue', filtered);
      const profit = sum('profit', filtered);
      return [
        { icon: CheckCircleOutlined, label: 'Completed', value: filtered.length, tone: '#059669', hint: 'Delivered & closed', delay: 0 },
        { icon: CurrencyRupee, label: 'Revenue earned', value: rupees(revenue), tone: '#2563eb', hint: 'From completed trips', delay: 0.04 },
        { icon: TrendingUp, label: 'Net profit', value: rupees(profit), tone: profit >= 0 ? '#059669' : '#dc2626', hint: `${pct(profit, revenue)}% average margin`, delay: 0.08 },
        { icon: DirectionsCar, label: 'Avg per trip', value: rupees(filtered.length ? Math.round(profit / filtered.length) : 0), tone: '#4f46e5', hint: 'Profit per delivery', delay: 0.12 },
      ];
    }

    if (statusFilter === 'Started') {
      const booked = sum('revenue', filtered);
      const est = sum('totalExpense', filtered);
      const estProfit = booked - est;
      return [
        { icon: RouteIcon, label: 'In progress', value: filtered.length, tone: '#2563eb', hint: 'Started trips', delay: 0 },
        { icon: CurrencyRupee, label: 'Revenue booked', value: rupees(booked), tone: '#4f46e5', hint: 'Expected on delivery', delay: 0.04 },
        { icon: TrendingDown, label: 'Est. expenses', value: rupees(est), tone: '#d97706', hint: 'Fuel, toll & driver', delay: 0.08 },
        { icon: TrendingUp, label: 'Est. profit', value: rupees(estProfit), tone: estProfit >= 0 ? '#059669' : '#dc2626', hint: `${pct(estProfit, booked)}% est. margin`, delay: 0.12 },
      ];
    }

    const revenue = sum('revenue', live);
    const profit = sum('profit', live);
    return [
      { icon: RouteIcon, label: 'Total trips', value: filtered.length, tone: '#4f46e5', hint: search.trim() ? 'Matching search' : 'All time', delay: 0 },
      { icon: DirectionsCar, label: 'Active', value: filtered.filter((t) => !['Completed', 'Cancelled'].includes(t.status)).length, tone: '#2563eb', hint: 'Started or in transit', delay: 0.04 },
      { icon: TrendingUp, label: 'Net profit', value: rupees(profit), tone: profit >= 0 ? '#059669' : '#dc2626', hint: `${pct(profit, revenue)}% average margin`, delay: 0.08 },
      { icon: CheckCircleOutlined, label: 'Completed', value: filtered.filter((t) => t.status === 'Completed').length, tone: '#059669', hint: 'Delivered & closed', delay: 0.12 },
    ];
  }, [filtered, statusFilter, trips, search]);

  return (
    <Box sx={{ maxWidth: 1500 }}>
      <PageHeader
        title="Trips"
        caption="Trip history & earnings"
        subtitle={`${trips.length} recorded · ${activeCount} active · net ${rupees(totalProfit)}`}
        actions={
          <Stack direction="row" spacing={1}  sx={{alignItems: 'center',  width: { xs: '100%', md: 'auto' } }}>
            <SearchField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, truck, city…"
              sx={{ flex: 1 }}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={load} aria-label="Refresh trips" sx={{ border: 1, borderColor: 'divider' }}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <StatGrid sx={{ mt: 3, mb: 2.5 }}>
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </StatGrid>

      {error && (
        <Alert
          severity="error"
          variant="outlined"
          onClose={() => setError('')}
          sx={{ mb: 2, borderRadius: 2.5 }}
        >
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {['All', 'Started', 'Completed', 'Cancelled'].map((s) => (
          <Chip
            key={s}
            label={s === 'All' ? `All (${trips.length})` : s}
            color={statusFilter === s ? 'primary' : 'default'}
            variant={statusFilter === s ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter(s)}
            size="small"
          />
        ))}
      </Stack>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Truck</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell align="right">Distance</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="left">Profit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading &&
                  [1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton height={26} />
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading &&
                  filtered.map((trip) => {
                    const meta = statusMeta(trip.status);
                    return (
                      <TableRow
                        key={trip._id}
                        hover
                        sx={{ '&:last-child td, &:last-child th': { borderBottom: 0 } }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
                          >
                            {trip.tripId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {trip.truckNumber}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260, overflow: 'hidden' }}>
                          <Stack direction="row" spacing={1}  sx={{ alignItems: 'center' }}>
                            <RouteIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                            <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                              <Typography variant="body2" noWrap title={shortRoute(trip)}>
                                {shortRoute(trip)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'block' }}
                                title={(trip.from || '').split(',').slice(1).join(',').trim()}
                              >
                                {(trip.from || '').split(',').slice(1).join(',').trim() || ' '}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{trip.distance} km</Typography>
                          {trip.routeDuration && (
                            <Typography variant="caption" color="text.secondary">
                              {trip.routeDuration}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {trip.status === 'Cancelled' ? (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                {rupees(0)}
                              </Typography>
                              <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                of {rupees(trip.revenue)} booked
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2">{rupees(trip.revenue)}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <ProfitCell trip={trip} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75}  sx={{ alignItems: 'center' }}>
                            <SoftChip status={trip.status} label={meta.label} />
                            {trip.tollIsEstimated && (
                              <SoftChip tone="#d97706" label="est. toll" />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                            {trip.status !== 'Completed' && trip.status !== 'Cancelled' && (
                              <Tooltip title="Cancel trip">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => requestCancel(trip)}
                                  aria-label={`Cancel ${trip.tripId}`}
                                >
                                  <Block fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="View trip details">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setSelected(trip)}
                                aria-label={`View ${trip.tripId}`}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ borderBottom: 0 }}>
                      {trips.length === 0 ? (
                        <EmptyState
                          height={200}
                          icon={RouteIcon}
                          title="No trips recorded yet"
                          hint="Price a route in the calculator and press “Start Trip”."
                        />
                      ) : (
                        <EmptyState
                          height={200}
                          icon={Search}
                          title="No matching trips"
                          hint="Try a different search or status filter."
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </motion.div>

      <TripDetailsModal
        open={Boolean(selected)}
        trip={selected}
        loading={updating}
        onClose={() => setSelected(null)}
        onUpdate={updateTrip}
        onEditTrip={editTrip}
        onRequestCancel={requestCancel}
      />

      <CancelTripDialog
        open={Boolean(cancelling)}
        trip={cancelling}
        busy={cancelBusy}
        error={cancelError}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: '100%', borderRadius: 2.5 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
