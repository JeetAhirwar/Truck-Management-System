import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close,
  CurrencyRupee,
  LocalGasStation,
  Person,
  Phone,
  Badge as BadgeIcon,
  Schedule,
  Toll,
  TrendingDown,
  TrendingUp,
  DoneAll,
  PlayArrow,
  LocalShipping,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import RouteMap, { geoJsonToLatLngs } from './RouteMap';
import { SoftChip } from './ui';

const rupees = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const STATUS_META = {
  Planned: { color: 'default', label: 'Planned' },
  Assigned: { color: 'info', label: 'Assigned' },
  Started: { color: 'primary', label: 'In Progress' },
  'In Transit': { color: 'primary', label: 'In Progress' },
  Reached: { color: 'warning', label: 'Reached' },
  Completed: { color: 'success', label: 'Completed' },
  Cancelled: { color: 'error', label: 'Cancelled' },
};

export const statusMeta = (status) =>
  STATUS_META[status] || { color: 'default', label: status || 'Unknown' };

function MoneyRow({ label, value, tone, bold }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.55 }}>
      <Typography variant="body2" color={bold ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: bold ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 800 : 500, color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'text.primary' }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.nested'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Icon sx={{ fontSize: 16, color: tone }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" sx={{ color: tone }}>
        {value}
      </Typography>
    </Box>
  );
}

function DriverSection({ trip }) {
  // `driver` is a populated object from GET /trips; plain ObjectId (or
  // missing) after older writes falls back to the driverName snapshot.
  const driver = trip.driver && typeof trip.driver === 'object' ? trip.driver : null;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        p: 2,
        bgcolor: 'background.nested'
      }}
    >
      <Typography variant="overline" color="text.secondary">
        Driver
      </Typography>
      {driver ? (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#EDE9FE', color: '#5B21B6' }}
            >
              <Person />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {driver.name}
              </Typography>
              {driver.mobile && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Phone sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {driver.mobile}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {driver.licenseNumber && (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <BadgeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    License
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    {driver.licenseNumber}
                  </Typography>
                  {driver.licenseType && (
                    <SoftChip tone="#64748b" label={driver.licenseType} />
                  )}
                </Stack>
              </Stack>
            )}
            {driver.experience != null && driver.experience !== '' && (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Experience
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {driver.experience} yrs
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      ) : trip.driverName ? (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
          <Avatar
            variant="rounded"
            sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#EDE9FE', color: '#5B21B6' }}
          >
            <Person />
          </Avatar>
          <Typography variant="body2" fontWeight={700}>
            {trip.driverName}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No driver assigned to this trip.
        </Typography>
      )}
    </Box>
  );
}

export default function TripDetailsModal({ open, trip, loading = false, onClose, onUpdate }) {
  const [updating, setUpdating] = useState('');

  const routeCoords = useMemo(() => geoJsonToLatLngs(trip?.routeGeometry), [trip]);

  if (!trip) return null;

  const status = statusMeta(trip.status);
  const profitable = (trip.profit || 0) >= 0;
  const ProfitIcon = profitable ? TrendingUp : TrendingDown;
  const finished = ['Completed', 'Cancelled'].includes(trip.status);

  const changeStatus = async (next) => {
    setUpdating(next);
    try {
      await onUpdate(trip._id, { status: next });
    } finally {
      setUpdating('');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h5" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                {trip.tripId}
              </Typography>
              <SoftChip color={status.color} label={status.label} />
              {trip.tollIsEstimated && (
                <SoftChip tone="#d97706" label="Estimated toll" />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
              {trip.truckNumber} · {trip.from} → {trip.to}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close trip details">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading trip…
            </Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(0,1.15fr)' }
            }}
          >
            {/* ---------------- LEFT: financials ---------------- */}
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: 'repeat(2, minmax(0,1fr))'
                }}
              >
                <StatCard icon={LocalShipping} label="Distance" value={`${trip.distance} km`} tone="primary.main" />
                <StatCard
                  icon={Schedule}
                  label={trip.routeDuration ? 'OSRM duration' : 'Travel time'}
                  value={trip.routeDuration || `${trip.travelTimeHours || 0} h`}
                  tone="primary.main"
                />
                <StatCard icon={LocalGasStation} label="Fuel required" value={`${trip.fuelRequired || 0} L`} tone="warning.main" />
                <StatCard
                  icon={CurrencyRupee}
                  label="Fuel cost"
                  value={rupees(trip.fuelCost)}
                  tone="secondary.main"
                />
              </Box>

              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  p: 2,
                  bgcolor: 'background.nested'
                }}
              >
                <Typography variant="overline" color="text.secondary">
                  Financial breakdown
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <MoneyRow label="Revenue" value={rupees(trip.revenue)} />
                  <MoneyRow label="− Fuel" value={`− ${rupees(trip.fuelCost)}`} />
                  <MoneyRow label="− Toll" value={`− ${rupees(trip.tollCost)}`} />
                  <MoneyRow label="− Driver" value={`− ${rupees(trip.driverExpense)}`} />
                  <MoneyRow label="− Other" value={`− ${rupees(trip.otherExpenses)}`} />
                  <Divider sx={{ my: 1 }} />
                  <MoneyRow
                    label="Total expense"
                    value={rupees(trip.totalExpense)}
                    bold
                  />
                </Box>
              </Box>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: alpha(profitable ? '#16a34a' : '#dc2626', 0.1),
                  border: 1,
                  borderColor: alpha(profitable ? '#16a34a' : '#dc2626', 0.3)
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ProfitIcon color={profitable ? 'success' : 'error'} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Total profit
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="baseline">
                      <Typography variant="h5" sx={{ color: profitable ? 'success.main' : 'error.main' }}>
                        {rupees(trip.profit)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: profitable ? 'success.main' : 'error.main', fontWeight: 700 }}
                      >
                        {trip.profitPercent}%
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              <DriverSection trip={trip} />

              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocalShipping sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Mileage used {trip.mileageUsed} km/L · Fuel {trip.fuelType} @ {rupees(trip.fuelPrice)}/L
                  </Typography>
                </Stack>
                {trip.cargo && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Toll sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      Cargo {trip.cargo}
                      {trip.cargoWeight ? ` · ${trip.cargoWeight} kg` : ''}
                      {trip.customer ? ` · ${trip.customer}` : ''}
                    </Typography>
                  </Stack>
                )}
              </Stack>

              {trip.notes && (
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 2.5 }}>
                  {trip.notes}
                </Alert>
              )}
            </Stack>

            {/* ---------------- RIGHT: map ---------------- */}
            <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
              {trip.routeGeometry || trip.origin?.lat != null ? (
                <RouteMap
                  origin={trip.origin?.lat != null ? { lat: trip.origin.lat, lng: trip.origin.lng, label: trip.origin.label } : null}
                  destination={
                    trip.destination?.lat != null
                      ? { lat: trip.destination.lat, lng: trip.destination.lng, label: trip.destination.label }
                      : null
                  }
                  routeCoords={routeCoords}
                  height={340}
                />
              ) : (
                <Box
                  sx={{
                    height: 340,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 3,
                    bgcolor: 'background.nested',
                    px: 3
                  }}
                >
                  <Box>
                    <LocalShipping sx={{ fontSize: 34, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" fontWeight={700}>
                      No route geometry
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      This trip was created from a manual distance, so no polyline was stored.
                    </Typography>
                  </Box>
                </Box>
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`${trip.routeCoordinateCount || routeCoords.length} route points`} />
                {trip.routeDistanceKm > 0 && (
                  <Chip size="small" variant="outlined" label={`OSRM ${trip.routeDistanceKm} km`} />
                )}
                {trip.startDate && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Started ${new Date(trip.startDate).toLocaleDateString('en-IN')}`}
                  />
                )}
                {trip.completedDate && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="success"
                    label={`Completed ${new Date(trip.completedDate).toLocaleDateString('en-IN')}`}
                  />
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        {!finished && (
          <>
            {trip.status === 'Started' && (
              <Button
                variant="outlined"
                color="error"
                disabled={Boolean(updating)}
                onClick={() => changeStatus('Cancelled')}
              >
                {updating === 'Cancelled' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Cancel trip
              </Button>
            )}
            {trip.status !== 'In Transit' && (
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                disabled={Boolean(updating)}
                onClick={() => changeStatus('In Transit')}
              >
                {updating === 'In Transit' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Mark in transit
              </Button>
            )}
            <Button
              variant="contained"
              color="success"
              startIcon={<DoneAll />}
              disabled={Boolean(updating)}
              onClick={() => changeStatus('Completed')}
            >
              {updating === 'Completed' ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
              Mark as completed
            </Button>
          </>
        )}
        {finished && (
          <Typography variant="caption" color="text.secondary">
            This trip is {status.label.toLowerCase()} — the truck is back in the pool.
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
}
