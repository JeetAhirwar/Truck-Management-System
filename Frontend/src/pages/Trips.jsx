import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Alert,
  Box,
  Card,
  Chip,
  IconButton,
  LinearProgress,
  Skeleton,
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
  Visibility as VisibilityIcon,
  Search,
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
  const profitable = (trip.profit || 0) >= 0;
  const Icon = profitable ? TrendingUp : TrendingDown;
  return (
    <Stack direction="row" spacing={0.75}  sx={{ alignItems: 'center' }}>
      <Icon sx={{ fontSize: 16, color: profitable ? 'success.main' : 'error.main' }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: profitable ? 'success.main' : 'error.main' }}>
          {rupees(trip.profit)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {trip.profitPercent}%
        </Typography>
      </Box>
    </Stack>
  );
}

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

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

  const updateTrip = async (id, patch) => {
    setUpdating(true);
    try {
      const { data } = await api.put(`/trips/${id}`, patch);
      setTrips((list) => list.map((t) => (t._id === id ? { ...t, ...data } : t)));
      setSelected((cur) => (cur && cur._id === id ? { ...cur, ...data } : cur));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update trip');
    } finally {
      setUpdating(false);
    }
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
  const totalProfit = trips.reduce((sum, t) => sum + (t.profit || 0), 0);
  const totalRevenue = trips.reduce((sum, t) => sum + (t.revenue || 0), 0);
  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

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
        <StatCard icon={RouteIcon} label="Total trips" value={trips.length} tone="#4f46e5" hint="All time" delay={0} />
        <StatCard icon={DirectionsCar} label="Active" value={activeCount} tone="#2563eb" hint="Started or in transit" delay={0.04} />
        <StatCard
          icon={CurrencyRupee}
          label="Net profit"
          value={rupees(totalProfit)}
          tone={totalProfit >= 0 ? '#059669' : '#dc2626'}
          hint={`${avgMargin}% average margin`}
          delay={0.08}
        />
        <StatCard
          icon={CheckCircleOutlined}
          label="Completed"
          value={trips.filter((t) => t.status === 'Completed').length}
          tone="#059669"
          hint="Delivered & closed"
          delay={0.12}
        />
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
        {['All', 'Started', 'In Transit', 'Completed', 'Cancelled'].map((s) => (
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
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Stack direction="row" spacing={1}  sx={{ alignItems: 'center' }}>
                            <RouteIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" noWrap>
                                {shortRoute(trip)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {(trip.from || '').split(',').slice(1).join(',').trim() || '\u00a0'}
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
                          <Typography variant="body2">{rupees(trip.revenue)}</Typography>
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
      />
    </Box>
  );
}
