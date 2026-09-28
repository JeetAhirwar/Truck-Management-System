import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Calculate as CalcIcon,
  Clear as ClearIcon,
  CurrencyRupee,
  Directions,
  LocalGasStation,
  Place as PlaceIcon,
  PlayArrow,
  Schedule,
  Toll,
  TrendingUp,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import api from '../utils/api';
import RouteMap from '../components/RouteMap';
import { SoftChip } from '../components/ui';

/* ------------------------------------------------------------------ */
/* Nominatim (OpenStreetMap) — free geocoding, no API key              */
/* ------------------------------------------------------------------ */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/* OpenStreetMap usage policy: max 1 request/second, serialised. */
let nextNominatimAt = 0;

async function searchPlaces(query) {
  const wait = Math.max(0, nextNominatimAt - Date.now());
  nextNominatimAt = Math.max(Date.now(), nextNominatimAt) + 1000;
  if (wait) await new Promise((r) => setTimeout(r, wait));

  const { data } = await axios.get(NOMINATIM_URL, {
    params: { format: 'json', q: query, limit: 6, addressdetails: 0 },
    timeout: 10000,
  });
  const seen = new Set();
  return (Array.isArray(data) ? data : [])
    .map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((p) => {
      // Nominatim can return several nodes with the same display_name
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* ------------------------------------------------------------------ */
/* City autocomplete (Nominatim)                                       */
/* ------------------------------------------------------------------ */
function PlaceAutocomplete({ label, placeholder, value, onChange, disabled }) {
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const load = (q) => {
    clearTimeout(timer.current);
    const term = q.trim();
    const id = ++seq.current;
    if (term.length < 3) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const results = await searchPlaces(term);
        if (id !== seq.current) return; // stale response — ignore
        setOptions(results);
        setFailed(false);
      } catch {
        if (id !== seq.current) return;
        setOptions([]);
        setFailed(true);
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 500);
  };

  return (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      loading={busy}
      fullWidth
      filterOptions={(x) => x}
      isOptionEqualToValue={(o, v) => o.label === v.label}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.label || '')}
      onChange={(_, v) => onChange(v)}
      onInputChange={(_, v, reason) => {
        if (reason === 'input') load(v);
        if (reason === 'clear') {
          seq.current += 1;
          setOptions([]);
        }
      }}
      noOptionsText={failed ? 'Search failed — try again' : 'Type at least 3 characters'}
      renderOption={(props, option) => (
        <li {...props} key={`${option.label}|${option.lat},${option.lng}`}>
          <PlaceIcon fontSize="small" sx={{ mr: 1.25, color: 'text.secondary' }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.lat.toFixed(4)}, {option.lng.toFixed(4)}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label}
          placeholder={placeholder}
          helperText={value ? `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}` : ' '}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {busy ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */
function Metric({ icon: Icon, label, value, tone }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.nested',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Icon sx={{ fontSize: 16, color: tone }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" sx={{ color: tone || 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}

function FormulaRow({ label, children }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.4 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </Typography>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Calculator                                                          */
/* ------------------------------------------------------------------ */
const rupees = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * Thins the OSRM polyline before it is POSTed. ~1500 points is visually
 * identical on screen but keeps the request (and the stored trip) small.
 */
function thinGeometry(geometry, maxPoints = 1500) {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const pts = geometry.coordinates;
  if (pts.length <= maxPoints) return geometry;
  const step = Math.ceil(pts.length / maxPoints);
  const kept = pts.filter((_, i) => i % step === 0);
  const last = pts[pts.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return { type: 'LineString', coordinates: kept };
}

export default function Calculator() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState({
    truckId: '',
    distance: '',
    revenue: '',
    tollCost: '',
    driverExpense: '',
    otherExpenses: '',
  });

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]); // [[lat, lng], ...]

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [showEstimated, setShowEstimated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: 'error', message: '' });

  const notify = (severity, message) => setSnack({ open: true, severity, message });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api
      .get('/trucks')
      .then((r) => setTrucks(r.data))
      .catch(() => notify('error', 'Could not load trucks'));
    api
      .get('/settings')
      .then((r) =>
        setForm((f) => ({
          ...f,
          driverExpense: r.data.defaultDriverExpense ?? 2500,
          otherExpenses: r.data.defaultOtherExpense ?? 500,
        }))
      )
      .catch(() => {});
  }, []);

  const hasRoute = Boolean(origin && destination);

  /* ---------------- payload ---------------- */
  const buildPayload = (skipTolls) => {
    const body = { truckId: form.truckId, skipTolls, includeGeometry: hasRoute };
    if (hasRoute) {
      body.from = { lat: origin.lat, lng: origin.lng, label: origin.label };
      body.to = { lat: destination.lat, lng: destination.lng, label: destination.label };
    } else {
      body.distance = Number(form.distance);
    }
    // Only send expense keys the user filled in, so the server falls back to
    // the configured settings instead of a silent 0.
    if (form.revenue !== '') body.revenue = Number(form.revenue);
    if (form.tollCost !== '') body.tollCost = Number(form.tollCost);
    if (form.driverExpense !== '') body.driverExpense = Number(form.driverExpense);
    if (form.otherExpenses !== '') body.otherExpenses = Number(form.otherExpenses);
    return body;
  };

  const clearRoute = () => {
    setRouteCoords([]);
    setResult(null);
    setAutoRan(false);
    setError('');
    setWarning('');
    setForm((f) => ({ ...f, distance: '' }));
  };

  /* ---------------- calculate ---------------- */
  const calculate = async ({ auto = false } = {}) => {
    setError('');
    setWarning('');

    if (!form.truckId) {
      const msg = 'Select a truck first.';
      if (auto) return false;
      setError(msg);
      return false;
    }
    if (!hasRoute) {
      const d = Number(form.distance);
      if (!Number.isFinite(d) || d <= 0) {
        const msg = 'Distance must be a number greater than 0.';
        if (auto) {
          notify('error', msg);
          setRouteCoords([]);
        } else setError(msg);
        return false;
      }
    }

    setLoading(true);
    try {
      const { data } = await api.post('/trips/calculate', buildPayload(false));
      setResult(data);
      setShowEstimated(data.isEstimatedToll === true);
      setAutoRan(auto);
      setForm((f) => ({ ...f, distance: String(data.distance ?? '') }));
      const coords = data.route?.geometry?.coordinates;
      setRouteCoords(
        Array.isArray(coords) ? coords.map(([lng, lat]) => [lat, lng]) : []
      );
      return true;
    } catch (err) {
      const body = err.response?.data || {};
      const code = body.code;
      const msg = body.error || err.message || 'Calculation failed';

      setRouteCoords([]); // clear the polyline on failure

      const canDegrade =
        hasRoute &&
        (code === 'TOLLGURU_QUOTA_EXCEEDED' ||
          code === 'TOLLGURU_UNAVAILABLE' ||
          body.canSkipTolls);

      if (canDegrade) {
        try {
          const { data } = await api.post('/trips/calculate', buildPayload(true));
          setResult(data);
          setShowEstimated(data.isEstimatedToll === true);
          setAutoRan(auto);
          setForm((f) => ({ ...f, distance: String(data.distance ?? '') }));
          const coords = data.route?.geometry?.coordinates;
          setRouteCoords(
            Array.isArray(coords) ? coords.map(([lng, lat]) => [lat, lng]) : []
          );
          setWarning(
            `${msg} — showing results with the manual toll (₹${Number(form.tollCost) || 0}).`
          );
          return true;
        } catch (err2) {
          const m = err2.response?.data?.error || 'Calculation failed';
          notify('error', m);
          if (!auto) setError(m);
          return false;
        }
      }

      if (code === 'OSRM_NO_ROUTE' || code === 'OSRM_UNAVAILABLE' || code === 'VALIDATION') {
        notify('error', msg);
      } else if (!auto) {
        setError(msg);
      } else {
        notify('error', msg);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* -------------- auto-calc when both endpoints are chosen -------------- */
  const calcRef = useRef(calculate);
  calcRef.current = calculate;

  useEffect(() => {
    if (!origin || !destination) return;
    if (!form.truckId) return;
    calcRef.current({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, form.truckId]);

  const onSubmit = (e) => {
    e.preventDefault();
    calcRef.current({ auto: false });
  };

  /* --------------------- Start Trip: persist the quote --------------------- */
  const startTrip = async () => {
    if (!canStartTrip) return;
    setSaving(true);
    try {
      const payload = {
        truck: form.truckId,
        from: origin?.label || 'Origin',
        to: destination?.label || 'Destination',
        origin: origin ? { label: origin.label, lat: origin.lat, lng: origin.lng } : undefined,
        destination: destination
          ? { label: destination.label, lat: destination.lat, lng: destination.lng }
          : undefined,
        distance: Number(result.distance),
        revenue: form.revenue === '' ? 0 : Number(form.revenue),
        tollCost: Number(toll?.cost ?? form.tollCost ?? 0),
        driverExpense: form.driverExpense === '' ? undefined : Number(form.driverExpense),
        otherExpenses: form.otherExpenses === '' ? undefined : Number(form.otherExpenses),
        isEstimatedToll: result.isEstimatedToll === true,
        tollSource: toll?.source || '',
        route: s
          ? {
              geometry: thinGeometry(s.geometry),
              distanceKm: s.distanceKm,
              duration: s.duration,
              durationSeconds: s.durationSeconds,
              coordinateCount: s.coordinateCount
            }
          : undefined
      };

      const { data } = await api.post('/trips', payload);
      setSnack({
        open: true,
        severity: 'success',
        message: `${data.tripId} started — ${data.truckNumber} is now On Trip.`
      });
      // Let the success toast breathe before moving the user.
      window.setTimeout(() => navigate('/trips'), 1200);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Could not start trip');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {    setOrigin(null);
    setDestination(null);
    clearRoute();
  };

  const s = result?.route;
  const toll = result?.toll;
  const waitingForTruck = hasRoute && !form.truckId;
  const canStartTrip = Boolean(result && form.truckId && result.distance > 0 && !loading);

  /* ------------------------------------------------------------------ */
  return (
    <Box sx={{ maxWidth: 1500 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h2">Trip Calculator</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Search a city → auto OSRM route → TollGuru tolls → live profit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <SoftChip
            color={hasRoute ? 'primary' : 'default'}
            icon={<Directions sx={{ fontSize: '14px !important' }} />}
            label={hasRoute ? 'OSRM route mode' : 'Manual distance mode'}
          />
          {hasRoute && (
            <Tooltip title="Clear route and start over">
              <IconButton size="small" onClick={resetAll} aria-label="Clear route">
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, lg: 3 },
          gridTemplateColumns: { xs: '1fr', lg: '420px minmax(0,1fr)' },
          alignItems: 'start',
        }}
      >
        {/* ============================ FORM ============================ */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent sx={{ p: '24px !important', '&:last-child': { pb: '24px !important' } }}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha('#2563eb', 0.12),
                    color: 'primary.main',
                  }}
                >
                  <CalcIcon fontSize="small" />
                </Box>
                <Typography variant="h6">Input</Typography>
              </Stack>

              <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2 }}>
                {error && (
                  <Alert severity="error" variant="outlined" sx={{ borderRadius: 2.5 }}>
                    {error}
                  </Alert>
                )}
                {warning && (
                  <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2.5 }}>
                    {warning}
                  </Alert>
                )}

                <FormControl fullWidth size="small">
                  <InputLabel id="truck-label">Select truck *</InputLabel>
                  <Select
                    labelId="truck-label"
                    value={form.truckId}
                    label="Select truck *"
                    onChange={set('truckId')}
                    required
                  >
                    <MenuItem value="">
                      <em>Choose a truck…</em>
                    </MenuItem>
                    {trucks.map((t) => (
                      <MenuItem key={t._id} value={t._id}>
                        {t.truckNumber} — {t.model} ({t.currentMileage} km/L · {t.fuelType})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider>
                  <SoftChip
                    color={hasRoute ? 'success' : 'default'}
                    label={hasRoute ? 'Auto-calculating route' : 'Choose origin & destination'}
                  />
                </Divider>

                <PlaceAutocomplete
                  label="Origin"
                  placeholder="Search city, e.g. Delhi"
                  value={origin}
                  onChange={setOrigin}
                />
                <PlaceAutocomplete
                  label="Destination"
                  placeholder="Search city, e.g. Agra"
                  value={destination}
                  onChange={setDestination}
                />

                {waitingForTruck && (
                  <Alert severity="info" variant="outlined" sx={{ borderRadius: 2.5 }}>
                    Both places selected — pick a truck to auto-calculate the route.
                  </Alert>
                )}

                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Distance (km) *"
                  placeholder="e.g. 585"
                  value={form.distance}
                  onChange={set('distance')}
                  disabled={hasRoute}
                  required={!hasRoute}
                  helperText={
                    hasRoute
                      ? 'Filled automatically from the OSRM route'
                      : 'Leave both places empty to type it manually'
                  }
                  slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                />

                <Stack direction="row" spacing={2}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Expected revenue (₹)"
                    placeholder="35000"
                    value={form.revenue}
                    onChange={set('revenue')}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Manual toll (₹)"
                    placeholder="3200"
                    value={form.tollCost}
                    onChange={set('tollCost')}
                    helperText={hasRoute ? 'Fallback if TollGuru is down' : ' '}
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                  />
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Driver expense (₹)"
                    placeholder="2500"
                    value={form.driverExpense}
                    onChange={set('driverExpense')}
                    helperText="Blank = settings default"
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Other expenses (₹)"
                    placeholder="500"
                    value={form.otherExpenses}
                    onChange={set('otherExpenses')}
                    helperText="Blank = settings default"
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                  />
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={
                    loading ? <CircularProgress size={18} color="inherit" /> : <CalcIcon />
                  }
                  sx={{ py: 1.25, mt: 0.5 }}
                >
                  {loading ? 'Routing & pricing…' : hasRoute ? 'Recalculate' : 'Calculate'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>

        {/* ==================== MAP + RESULTS ==================== */}
        <Box sx={{ display: 'grid', gap: { xs: 2, lg: 3 } }}>
          {/* -------- Map -------- */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <Card>
              <CardContent sx={{ p: '16px !important', '&:last-child': { pb: '16px !important' } }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1.5, px: 0.5 }}
                >
                  <Box>
                    <Typography variant="h6">Route map</Typography>
                    <Typography variant="caption" color="text.secondary">
                      OpenStreetMap · OSRM polyline
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75}>
                    {origin && <SoftChip color="primary" label="Origin" />}
                    {destination && <SoftChip color="error" label="Destination" />}
                  </Stack>
                </Stack>

                <RouteMap
                  origin={origin}
                  destination={destination}
                  routeCoords={routeCoords}
                  loading={loading}
                  height={{ xs: 300, sm: 380 }}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* -------- Result -------- */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card>
              <CardContent sx={{ p: '24px !important', '&:last-child': { pb: '24px !important' } }}>
                <Typography variant="h6" sx={{ mb: 2.5 }}>
                  Result & formula breakdown
                </Typography>

                {loading && !result ? (
                  <Stack spacing={1.5}>
                    <Skeleton variant="rounded" height={38} />
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2,1fr)' }}>
                      <Skeleton variant="rounded" height={86} />
                      <Skeleton variant="rounded" height={86} />
                      <Skeleton variant="rounded" height={86} />
                      <Skeleton variant="rounded" height={86} />
                    </Box>
                    <Skeleton variant="rounded" height={140} />
                  </Stack>
                ) : !result ? (
                  <Box
                    sx={{
                      height: 300,
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 3,
                      bgcolor: 'background.nested',
                      px: 3,
                    }}
                  >
                    <Box>
                      <Directions sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" fontWeight={700}>
                        Pick a truck and two places
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Results appear here as soon as the route is priced.
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Stack spacing={2.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                      <SoftChip color="primary" label={result.truck.truckNumber} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${result.truck.fuelType} · ${result.truck.mileage} km/L`}
                      />
                      <SoftChip
                        color={result.source === 'osrm' ? 'success' : 'default'}
                        label={result.source === 'osrm' ? 'OSRM route' : 'Manual distance'}
                      />
                      {toll && (
                        <SoftChip
                          color={
                            toll.source === 'tollguru'
                              ? 'info'
                              : toll.source === 'cache'
                                ? 'success'
                                : toll.source === 'estimated'
                                  ? 'warning'
                                  : 'default'
                          }
                          icon={<Toll sx={{ fontSize: '14px !important' }} />}
                          label={
                            toll.source === 'tollguru'
                              ? `TollGuru · ${toll.currency} ${toll.cost}${toll.hasTolls ? ` (${toll.tollCount} plaza)` : ' (no tolls)'}`
                              : toll.source === 'cache'
                                ? `Cached toll ₹${toll.cost}${toll.cacheAgeDays != null ? ` · ${toll.cacheAgeDays}d old` : ''}`
                                : toll.source === 'estimated'
                                  ? `Estimated toll ₹${toll.cost} (₹3/km)`
                                  : `Manual toll ₹${toll.cost}`
                          }
                        />
                      )}
                      {autoRan && <SoftChip tone="#64748b" label="auto" />}
                    </Stack>

                    {s && (
                      <Alert severity="info" variant="outlined" sx={{ borderRadius: 2.5 }}>
                        <Typography variant="subtitle2">
                          {s.distanceKm} km · {s.duration} ({s.durationHours} h) · {s.coordinateCount} route points
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {origin?.label?.slice(0, 60)} → {destination?.label?.slice(0, 60)}
                        </Typography>
                      </Alert>
                    )}

                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' },
                      }}
                    >
                      <Metric
                        icon={LocalGasStation}
                        label="Fuel required"
                        value={`${result.fuelRequired} L`}
                        tone="warning.main"
                      />
                      <Metric
                        icon={Schedule}
                        label={s ? 'OSRM ETA' : 'Travel time'}
                        value={s ? s.duration : result.travelTime}
                        tone="primary.main"
                      />
                      <Metric
                        icon={CurrencyRupee}
                        label="Fuel cost"
                        value={`₹${(result.fuelCost || 0).toLocaleString('en-IN')}`}
                        tone="secondary.main"
                      />
                      <Metric
                        icon={TrendingUp}
                        label="Profit"
                        value={`${result.profitPercent}%`}
                        tone={
                          result.profitPercent >= 20
                            ? 'success.main'
                            : result.profitPercent >= 10
                              ? 'warning.main'
                              : 'error.main'
                        }
                      />
                    </Box>

                    {result.isEstimatedToll && showEstimated && (
                      <Alert
                        severity="warning"
                        variant="outlined"
                        onClose={() => setShowEstimated(false)}
                        sx={{ borderRadius: 2.5 }}
                      >
                        Live API quota exhausted. Showing an estimated toll based on distance (₹3/km).
                        {toll?.reason && toll.reason !== 'SKIPPED' && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }} color="text.secondary">
                            Reason: {toll.reason} · estimate = {result.distance} km × ₹3
                          </Typography>
                        )}
                      </Alert>
                    )}

                    <Box
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2.5,
                        p: 2,
                        bgcolor: 'background.nested',
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        Formula breakdown
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <FormulaRow label="Fuel">{result.fuelFormula}</FormulaRow>
                        <FormulaRow label="Fuel cost">{result.fuelCostFormula}</FormulaRow>
                        <FormulaRow label="Est. time">{result.travelTimeFormula}</FormulaRow>
                        <FormulaRow label="Fuel price">₹{result.fuelPrice}/L</FormulaRow>
                      </Box>
                    </Box>

                    {result.breakdown && (
                      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5, p: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Profit breakdown
                        </Typography>
                        <FormulaRow label="Revenue">
                          ₹{(result.breakdown.revenue || 0).toLocaleString('en-IN')}
                        </FormulaRow>
                        <FormulaRow label="− Fuel">₹{(result.breakdown.fuel || 0).toLocaleString('en-IN')}</FormulaRow>
                        <FormulaRow label="− Toll">₹{(result.breakdown.toll || 0).toLocaleString('en-IN')}</FormulaRow>
                        <FormulaRow label="− Driver">
                          ₹{(result.breakdown.driver || 0).toLocaleString('en-IN')}
                        </FormulaRow>
                        <FormulaRow label="− Other">
                          ₹{(result.breakdown.other || 0).toLocaleString('en-IN')}
                        </FormulaRow>
                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="subtitle2">Profit</Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{ color: result.profit >= 0 ? 'success.main' : 'error.main' }}
                          >
                            ₹{(result.profit || 0).toLocaleString('en-IN')} ({result.profitPercent}%)
                          </Typography>
                        </Stack>
                      </Box>
                    )}

                    <Divider />

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Typography variant="caption" color="text.secondary">
                        {hasRoute
                          ? 'Saving stores this quote with its exact OSRM route.'
                          : 'Manual distance — no route geometry will be stored.'}
                      </Typography>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={
                          saving ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />
                        }
                        disabled={!canStartTrip || saving}
                        onClick={startTrip}
                        sx={{ py: 1.25, whiteSpace: 'nowrap' }}
                      >
                        {saving ? 'Starting…' : 'Start Trip'}
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </Box>
      </Box>

      {/* ---------------- Snackbars ---------------- */}
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
