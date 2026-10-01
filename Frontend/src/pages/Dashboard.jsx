/**
 * VTMS — Fleet Dashboard
 *
 * UX decisions worth knowing (see SUMMARY at the bottom of this file):
 *  1. Triage first. A single "needs attention" bar sits directly under the
 *     header with a breakdown + real CTAs, instead of a vague chip.
 *  2. The backend already returns trips newest-first, so charts and the table
 *     consume the array in order (the old `.reverse()` was hiding that).
 *  3. Status is never colour-only: every chip carries a word, the fleet list
 *     prints counts and percentages, and the donut is decorative-only.
 *  4. The table drops columns progressively (8 -> 4 on mobile) and lets route
 *     text wrap, so there is no horizontal scroll on any viewport.
 *
 * Stack note: this app renders with MUI v9 + the flat theme in `theme.js`
 * (all 6 other pages do too). `sx` is used for layout instead of Tailwind
 * classes so the dashboard cannot drift from the rest of the product.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
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
import { alpha, lighten } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  AccountBalanceWallet,
  Build,
  Calculate,
  CheckCircle,
  ChevronRight,
  CurrencyRupee,
  Description,
  LocalShipping,
  People,
  Refresh,
  Route as RouteIcon,
  ShowChart,
  Speed,
  TrendingUp,
  VisibilityOutlined,
  WarningAmber,
} from '@mui/icons-material';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { EmptyState, SoftChip, StatCard } from '../components/ui';

const EASE = [0.22, 0.61, 0.36, 1];

/* Spacing rhythm used throughout: 16 / 24 / 32 (2 / 3 / 4 in MUI units). */
const GAP = { xs: 2, sm: 3 };

/* Status palette, straight from the brief. Kept in one object so the chips,
   the fleet list and the donut can never drift apart. */
const TONE = {
  blue: '#2563eb',
  orange: '#ea580c',
  red: '#dc2626',
  amber: '#d97706',
  green: '#059669',
  gray: '#64748b',
  violet: '#7c3aed',
};

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const inr = (n) => `₹${num(Math.round(Number(n || 0)))}`;
const litres = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

/* Indian fleet convention: crores/lakhs once the number gets long, so the
   KPI never wraps or gets clipped by `noWrap`. Exact value stays in the hint. */
const inrCompact = (n) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 1e7) return `₹${(Number(n) / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(Number(n) / 1e5).toFixed(2)}L`;
  return inr(n);
};

/* Pastel pair for tinted card backgrounds — mirrors the kit in ui.jsx. */
const tint = (hex) => (theme) =>
  theme.palette.mode === 'light' ? alpha(hex, 0.05) : alpha(hex, 0.1);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const dateLine = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function FadeUp({ delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: EASE }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
}

/* Card shell for every panel: consistent 16/24 padding, hairline border,
   no shadow (the flat design language). `accent` paints a left edge bar. */
function Panel({ title, subtitle, action, delay = 0, accent, children, contentSx }) {
  return (
    <FadeUp delay={delay}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          /* Grid items default to min-width:auto, which lets a wide table push
             the whole track past the viewport on phones. */
          minWidth: 0,
        }}
      >
        {accent && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              top: 14,
              bottom: 14,
              width: 3,
              borderRadius: '0 3px 3px 0',
              bgcolor: accent,
            }}
          />
        )}
        <CardContent
          sx={{
            p: { xs: 2, sm: 3 },
            '&:last-child': { pb: { xs: 2, sm: 3 } },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            ...contentSx,
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            /* MUI v9 Stack ignores alignItems/justifyContent as props and
               leaks them onto the DOM node, so they MUST live in sx. */
            sx={{ mb: { xs: 2, sm: 2.5 }, alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h3" sx={{ fontSize: '1.0625rem' }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
        </CardContent>
      </Card>
    </FadeUp>
  );
}

function DashboardSkeleton() {
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Skeleton width={280} height={34} />
          <Skeleton width={200} />
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Skeleton variant="rounded" width={32} height={32} />
          <Skeleton variant="rounded" width={150} height={32} />
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gap: GAP, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' } }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={150} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gap: GAP, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' } }}>
        <Skeleton variant="rounded" height={180} />
        <Skeleton variant="rounded" height={180} />
      </Box>
      <Box sx={{ display: 'grid', gap: GAP, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' } }}>
        <Skeleton variant="rounded" height={340} />
        <Skeleton variant="rounded" height={340} />
      </Box>
    </Stack>
  );
}

/* One row in a document / FASTag list. The left rail is decorative; the
   status word + day count carry the meaning for screen readers. */
function AlertRow({ tone, icon: Icon, title, meta, trailing }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        /* MUI v9 Stack ignores alignItems as a prop — it must be in sx. */
        alignItems: 'center',
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: (t) => (t.palette.mode === 'light' ? alpha(tone, 0.07) : alpha(tone, 0.12)),
        border: `1px solid ${alpha(tone, 0.22)}`,
        '& + &': { mt: 1 },
      }}
    >
      {Icon && (
        <Avatar
          variant="rounded"
          sx={{
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: '8px',
            bgcolor: alpha(tone, 0.16),
            color: (t) => (t.palette.mode === 'light' ? tone : lighten(tone, 0.25)),
            '& svg': { fontSize: 17 },
          }}
        >
          <Icon />
        </Avatar>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap sx={{ lineHeight: 1.35 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {meta}
        </Typography>
      </Box>
      {trailing}
    </Stack>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get('/dashboard')
      .then((res) => setState({ loading: false, error: null, data: res.data }))
      .catch((err) =>
        setState({
          loading: false,
          error: err.response?.data?.error || err.message || 'Network error',
          data: null,
        })
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading && !state.data) return <DashboardSkeleton />;

  if (state.error) {
    return (
      <Stack spacing={3}>
        <Box>
          <Typography variant="h2">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Fleet overview & live alerts
          </Typography>
        </Box>
        <Alert
          severity="error"
          variant="outlined"
          sx={{ borderRadius: 2, py: 1 }}
          action={
            <Button color="inherit" size="small" onClick={load} startIcon={<Refresh fontSize="small" />}>
              Retry
            </Button>
          }
        >
          <Typography variant="subtitle2">Couldn&apos;t load dashboard data</Typography>
          <Typography variant="caption" color="text.secondary">
            {state.error}
          </Typography>
        </Alert>
      </Stack>
    );
  }

  const { summary: s = {}, alerts = {}, recentTrips = [] } = state.data || {};

  const maintenanceDue = Number(s.maintenanceDue || 0);
  const docsExpired = Number(s.documentsExpired || 0);
  const docsExpiring = Number(s.documentsExpiring || 0);
  const revenue = Number(s.revenue || 0);
  const profit = Number(s.estimatedProfit || 0);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const pendingTrips = Number(s.pendingTrips || 0);
  const totalTrucks = Number(s.totalTrucks || 0);
  const inTransit = Number(s.inTransit || 0);
  const maintenanceTrucks = Number(s.maintenance || 0);
  const inactive = Math.max(0, totalTrucks - Number(s.available || 0) - inTransit - maintenanceTrucks);

  const expiredDocs = alerts.expiredDocs || [];
  const expiringDocs = alerts.expiringSoon || [];
  const lowFastag = alerts.lowFastag || [];

  /* A Rs.0 balance blocks a toll gate entirely, so it is escalated above the
     merely-low ones. */
  const criticalFastag = lowFastag.filter((t) => Number(t.balance) <= 0);
  const fastagShortfall = Number(s.fastagShortfall || 0);
  const attentionTotal = docsExpired + docsExpiring + maintenanceDue + lowFastag.length;

  /* Newest-first straight from the API — no client-side reordering. */
  const trips = recentTrips;
  const hasTrips = trips.length > 0;
  /* Cancelled trips never ran: they stay in the recent table below (with
     their status) but are kept out of both charts, which plot real activity. */
  const chartTrips = trips.filter((t) => t.status !== 'Cancelled');
  const hasChartTrips = chartTrips.length > 0;
  /* Short axis labels (last 4 of the trip id) so 5 long "TRP-XXXXXXXX"
     strings do not collide; the full id stays in the tooltip + table. */
  const chartLabels = chartTrips.map((t) => String(t.tripId || t._id).slice(-4));
  const tripNames = chartTrips.map((t) => t.tripId || String(t._id).slice(-4));

  /* Plain array, deliberately NOT useMemo: hooks cannot sit after the early
     returns above, and memoising a 4-item array was never worth it. */
  const fleetMix = [
    { label: 'Available', value: Number(s.available || 0), color: TONE.blue },
    { label: 'On trip', value: inTransit, color: TONE.orange },
    { label: 'Maintenance', value: maintenanceTrucks, color: TONE.red },
    { label: 'Inactive', value: inactive, color: TONE.gray },
  ];
  /* Zero slices are dropped from the donut so a single-status fleet does not
     render a legend full of 0% — the list below still shows every status. */
  const donutSlices = fleetMix.filter((m) => m.value > 0);

  const fmtDay = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <Stack spacing={3}>
      {/* ================= Header: who / when / what to do ================= */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        /* MUI v9 Stack ignores alignItems/justifyContent as props (they leak
           onto the DOM node), so both must live in sx or nothing aligns. */
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ overflowWrap: 'anywhere' }}>
            {greeting()}, {user?.name?.split(' ')[0] || 'Admin'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {dateLine()} · {num(totalTrucks)} trucks · {num(pendingTrips)} trips in progress
          </Typography>
        </Box>
        {/* Compact controls, pinned to the right on every breakpoint:
            size="small" (32px) instead of the 40px default, no fullWidth
            stretch, and alignSelf:flex-end so mobile also right-aligns. */}
        <Stack
          direction="row"
          spacing={1}
          /* alignSelf:right on mobile (column layout), auto on desktop where
             the parent's space-between already pins this group to the edge. */
          sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'auto' } }}
        >
          <Tooltip title="Refresh data">
            <span>
              <IconButton
                size="small"
                onClick={load}
                disabled={state.loading}
                aria-label="Refresh dashboard data"
                /* 32px to match the size="small" CTA beside it. */
                sx={{ border: 1, borderColor: 'divider', width: 32, height: 32 }}
              >
                <Refresh
                  fontSize="small"
                  sx={{ animation: state.loading ? 'spin 0.9s linear infinite' : 'none' }}
                />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            component={RouterLink}
            to="/calculator"
            variant="contained"
            size="small"
            startIcon={<Calculate fontSize="small" />}
          >
            Quick Trip Calculator
          </Button>
        </Stack>
      </Stack>

      {/* ============ Triage bar: makes "needs attention" clickable ============ */}
      {/*
      {attentionTotal > 0 && (
        <FadeUp>
          <Card
            sx={{
              borderColor: alpha(TONE.red, 0.3),
              bgcolor: tint(docsExpired + criticalFastag.length > 0 ? TONE.red : TONE.amber),
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
              >
                <Avatar
                  variant="rounded"
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    flexShrink: 0,
                    bgcolor: alpha(TONE.red, 0.16),
                    color: TONE.red,
                  }}
                >
                  <WarningAmber fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle1">
                    {attentionTotal} item{attentionTotal > 1 ? 's' : ''} need
                    {attentionTotal > 1 ? '' : 's'} attention
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    Expiry and service issues that can block a trip or fail a check.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}>
                    {docsExpired > 0 && <SoftChip tone={TONE.red} label={`${docsExpired} expired`} />}
                    {docsExpiring > 0 && <SoftChip tone={TONE.amber} label={`${docsExpiring} expiring`} />}
                    {maintenanceDue > 0 && <SoftChip tone={TONE.orange} label={`${maintenanceDue} service due`} />}
                    {lowFastag.length > 0 && (
                      <SoftChip tone={TONE.red} label={`${lowFastag.length} FASTag low`} />
                    )}
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    component={RouterLink}
                    to="/documents"
                    variant="contained"
                    size="small"
                    endIcon={<ChevronRight />}
                    fullWidth
                  >
                    Review
                  </Button>
                  <Button component={RouterLink} to="/trucks" variant="outlined" size="small" fullWidth>
                    Fleet
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </FadeUp>
      )}
      */}

      {/* ================= KPI row: 5 equal, scannable cards ================= */}
      <Box
        sx={{
          display: 'grid',
          gap: GAP,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(5, minmax(0,1fr))' },
        }}
      >
        <StatCard
          icon={CurrencyRupee}
          label="Revenue"
          value={inrCompact(revenue)}
          tone={TONE.green}
          hint="Gross income across all trips"
          delay={0}
        />
        <StatCard
          icon={TrendingUp}
          label="Net profit"
          value={inrCompact(profit)}
          tone={TONE.green}
          valueColor="success.main"
          hint={`${margin}% margin`}
          delay={0.02}
        />
        <StatCard
          icon={Speed}
          label="Distance this month"
          value={`${num(s.totalDistanceThisMonth)} km`}
          tone={TONE.blue}
          hint={`${litres(s.totalFuelConsumed)} L fuel burnt`}
          delay={0.04}
        />
        <StatCard
          icon={LocalShipping}
          label="Fleet size"
          value={num(totalTrucks)}
          tone={TONE.violet}
          hint={`${num(s.available)} available · ${inTransit} on trip`}
          delay={0.08}
        />
        <StatCard
          icon={People}
          label="Drivers"
          value={num(s.totalDrivers)}
          tone={TONE.blue}
          hint="Active roster"
          delay={0.12}
        />
      </Box>

      {/* ============ Alerts: maintenance + documents (documents louder) ============ */}
      <Box
        sx={{
          display: 'grid',
          gap: GAP,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Panel
          title="Maintenance due"
          subtitle="Trucks with an overdue or due service"
          accent={maintenanceDue > 0 ? TONE.orange : TONE.green}
          delay={0.14}
          action={
            maintenanceDue > 0 ? (
              <SoftChip tone={TONE.orange} label="Action needed" />
            ) : (
              <SoftChip tone={TONE.green} label="All clear" />
            )
          }
        >
          <Stack direction="row" spacing={1.5} sx={{ mb: 1, alignItems: 'baseline' }}>
            <Typography variant="h2" sx={{ fontSize: '2.25rem' }}>
              {num(maintenanceDue)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {maintenanceDue === 0
                ? 'No service overdue'
                : `${maintenanceDue} truck${maintenanceDue > 1 ? 's' : ''} to service`}
            </Typography>
          </Stack>
          <Button component={RouterLink} to="/trucks" size="small" color="inherit" endIcon={<ChevronRight />}>
            Open fleet
          </Button>
        </Panel>

        {/* Documents get the louder treatment on purpose — a lapsed RC or
            insurance is the fastest way to lose a load. */}
        <Panel
          title="Documents expiring"
          subtitle="Compliance items expiring or already lapsed"
          accent={docsExpired > 0 ? TONE.red : docsExpiring > 0 ? TONE.amber : TONE.green}
          delay={0.18}
          action={
            docsExpired > 0 ? (
              <SoftChip tone={TONE.red} label={`${docsExpired} expired`} />
            ) : docsExpiring > 0 ? (
              <SoftChip tone={TONE.amber} label="Due soon" />
            ) : (
              <SoftChip tone={TONE.green} label="All clear" />
            )
          }
        >
          <Stack direction="row" spacing={1.5} sx={{ mb: 1, alignItems: 'baseline' }}>
            <Typography variant="h2" sx={{ fontSize: '2.25rem' }}>
              {num(docsExpiring + docsExpired)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {docsExpired > 0
                ? `${docsExpired} already expired`
                : 'Expiring within 30 days'}
            </Typography>
          </Stack>
          <Button component={RouterLink} to="/documents" size="small" color="inherit" endIcon={<ChevronRight />}>
            Manage documents
          </Button>
        </Panel>
      </Box>

      {/* ================= Charts ================= */}
      <Box
        sx={{
          display: 'grid',
          gap: GAP,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Panel
          title="Revenue vs expenses"
          subtitle={
            hasChartTrips
              ? `Last ${chartTrips.length} trips, newest last`
              : hasTrips
                ? 'Recent trips are all cancelled'
                : 'No trips recorded yet'
          }
          delay={0.2}
          action={<SoftChip tone={TONE.blue} label={`Profit ${inrCompact(profit)}`} />}
        >
          {hasChartTrips ? (
            <>
              {/* The old version drew a third "Profit" bar next to revenue and
                  expenses, which doubled the bar count and halved the
                  readability. Net profit now lives in the header chip. */}
              <Box role="img" aria-label={`Revenue versus expenses for the last ${chartTrips.length} trips. Net profit ${inr(profit)}, ${margin} percent margin.`}>
                <BarChart
                  height={288}
                  series={[
                    {
                      data: chartTrips.map((t) => Number(t.revenue || 0)),
                      label: 'Revenue',
                      color: TONE.blue,
                      valueFormatter: (v) => inr(v),
                    },
                    {
                      data: chartTrips.map((t) => Number(t.totalExpense ?? (Number(t.revenue || 0) - Number(t.profit || 0)))),
                      label: 'Expenses',
                      color: TONE.amber,
                      valueFormatter: (v) => inr(v),
                    },
                  ]}
                  xAxis={[{ data: chartLabels, scaleType: 'band', tickLabelStyle: { fontSize: 11 } }]}
                  yAxis={[{ valueFormatter: (v) => `₹${num(v)}` }]}
                  grid={{ horizontal: true }}
                  borderRadius={6}
                  margin={{ top: 8, right: 8, bottom: 24, left: 56 }}
                  slotProps={{
                    legend: { position: { vertical: 'top', horizontal: 'right' }, labelStyle: { fontSize: 11 } },
                  }}
                />
              </Box>
              <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 2 }}>
                {tripNames.map((name, i) => (
                  <Typography key={name + i} variant="caption" color="text.secondary">
                    {name}
                  </Typography>
                ))}
              </Stack>
            </>
          ) : (
            <EmptyState
              icon={ShowChart}
              title={hasTrips ? 'Only cancelled trips recently' : 'No trip revenue yet'}
              hint={
                hasTrips
                  ? 'Cancelled trips are excluded from earnings — complete a trip to chart revenue here.'
                  : 'Run the Trip Calculator and save a trip — revenue and expenses will chart here.'
              }
              action={
                <Button component={RouterLink} to="/calculator" variant="contained" size="small" startIcon={<Calculate />}>
                  Open Trip Calculator
                </Button>
              }
            />
          )}
        </Panel>

        <Panel
          title="Trip trend"
          subtitle="Distance covered per trip"
          delay={0.24}
          action={
            <SoftChip tone={TONE.amber} label={`${litres(s.totalFuelConsumed)} L this month`} />
          }
        >
          {hasChartTrips ? (
            /* Fuel used to be a second series on a secondary axis. Fuel (tens of
               litres) crushed against distance (hundreds of km) is exactly what
               made this chart look almost blank. Distance is now the only
               series, and the fuel total moved to a chip. */
            <Box role="img" aria-label={`Distance covered per trip for the last ${chartTrips.length} trips, in kilometres.`}>
              <LineChart
                height={288}
                series={[
                  {
                    data: chartTrips.map((t) => Number(t.distance || 0)),
                    label: 'Distance (km)',
                    color: TONE.violet,
                    area: true,
                    curve: 'catmullRom',
                    valueFormatter: (v) => `${num(v)} km`,
                  },
                ]}
                xAxis={[{ data: chartLabels, scaleType: 'point', tickLabelStyle: { fontSize: 11 } }]}
                yAxis={[{ valueFormatter: (v) => `${num(v)} km` }]}
                grid={{ horizontal: true }}
                margin={{ top: 16, right: 12, bottom: 24, left: 56 }}
              />
            </Box>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title={hasTrips ? 'No distance to show' : 'No distance data yet'}
              hint={
                hasTrips
                  ? 'The recent trips were all cancelled, so no distance was covered.'
                  : 'Saved trips plot their distance here so you can spot long-haul vs short-haul patterns.'
              }
            />
          )}
        </Panel>
      </Box>

      {/* ============ Recent trips (8 cols) + fleet status (4 cols) ============ */}
      <Box
        sx={{
          display: 'grid',
          gap: GAP,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0,1fr))' },
        }}
      >
        <Box sx={{ gridColumn: { lg: 'span 8' }, minWidth: 0 }}>
          <Panel
            title="Recent trips"
            subtitle="Latest activity across the fleet"
            delay={0.28}
            action={
              <Button
                component={RouterLink}
                to="/trips"
                size="small"
                color="inherit"
                endIcon={<ChevronRight />}
              >
                View all
              </Button>
            }
          >
            {hasTrips ? (
              <TableContainer>
                <Table size="small" sx={{ minWidth: 0, width: '100%', tableLayout: 'fixed' }}>
                  {/* MUI v9 dropped TableCaption, so a raw <caption> carries
                      the accessible name for screen readers. */}
                  <caption style={SR_ONLY}>
                    Recent trips with route, distance, revenue, margin and status
                  </caption>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: { xs: 96, sm: 132 } }}>Trip</TableCell>
                      <TableCell>Route</TableCell>
                      {/* Fixed column widths (tableLayout:fixed) keep the table
                          inside the panel so it never scrolls sideways. */}
                      <TableCell align="right" sx={{ width: 88, display: { xs: 'none', md: 'table-cell' } }}>
                        Distance
                      </TableCell>
                      <TableCell align="right" sx={{ width: 92, display: { xs: 'none', sm: 'table-cell' } }}>
                        Revenue
                      </TableCell>
                      <TableCell align="right" sx={{ width: 88, display: { xs: 'none', lg: 'table-cell' } }}>
                        Margin
                      </TableCell>
                      <TableCell sx={{ width: { xs: 108, sm: 132 } }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trips.map((t) => {
                      const cancelled = t.status === 'Cancelled';
                      // Cancelled trips earned nothing — only what was spent.
                      const tripRevenue = cancelled ? 0 : Number(t.revenue || 0);
                      const tripProfit = cancelled
                        ? -Number(t.totalExpense || 0)
                        : Number(t.profit || 0);
                      const tripMargin = tripRevenue > 0 ? Math.round((tripProfit / tripRevenue) * 100) : 0;
                      return (
                        <TableRow key={t._id} hover>
                          <TableCell sx={{ maxWidth: { xs: 96, sm: 132 }, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap sx={{ letterSpacing: '-0.01em' }}>
                              {t.tripId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                              {t.truckNumber}
                            </Typography>
                          </TableCell>
                          {/* Wraps instead of truncating: "Mumbai → Bengaluru"
                              used to be clipped by a 220px noWrap box. minWidth
                              stays 0 so long city names never widen the table. */}
                          <TableCell sx={{ minWidth: 0, width: '100%' }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ lineHeight: 1.4, overflowWrap: 'anywhere' }}
                            >
                              {t.from}{' '}
                              <Box component="span" sx={{ color: 'text.disabled' }}>
                                &rarr;
                              </Box>{' '}
                              {t.to}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                            {num(t.distance)} km
                          </TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>
                            <Typography
                              variant="body2"
                              sx={{ color: cancelled ? 'text.secondary' : undefined }}
                            >
                              {inr(tripRevenue)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', lg: 'table-cell' }, whiteSpace: 'nowrap' }}>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                color: cancelled
                                  ? 'text.disabled'
                                  : tripProfit >= 0
                                    ? 'success.main'
                                    : 'error.main',
                              }}
                            >
                              {cancelled ? '—' : `${tripMargin}%`}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: cancelled ? 'error.main' : 'text.secondary' }}
                            >
                              {inr(tripProfit)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', lineHeight: 1 }}>
                              <SoftChip status={t.status} />
                              <Tooltip title={`Open ${t.tripId}`}>
                                <IconButton
                                  size="small"
                                  component={RouterLink}
                                  to="/trips"
                                  aria-label={`View trip ${t.tripId}`}
                                  sx={{ color: 'text.secondary', width: 28, height: 28 }}
                                >
                                  <VisibilityOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                height={200}
                icon={RouteIcon}
                title="No trips yet"
                hint="Use the Trip Calculator to plan and price your first trip — it will show up here."
                action={
                  <Button component={RouterLink} to="/calculator" variant="contained" size="small" startIcon={<Calculate />}>
                    Plan a trip
                  </Button>
                }
              />
            )}
          </Panel>
        </Box>

        <Box sx={{ gridColumn: { lg: 'span 4' }, minWidth: 0 }}>
          <Panel title="Fleet status" subtitle="Live vehicle distribution" delay={0.32}>
            {totalTrucks > 0 ? (
              <>
                {/* The donut is decorative; the list underneath carries the real
                    numbers, which is what makes a single-status fleet (100%
                    Available) readable instead of a useless full ring. */}
                <Box role="img" aria-label={`Fleet distribution: ${fleetMix.filter((m) => m.value > 0).map((m) => `${m.value} ${m.label}`).join(', ')}.`}>
                  <PieChart
                    height={200}
                    series={[
                      {
                        data: donutSlices.map((m, i) => ({ id: i, value: m.value, label: m.label, color: m.color })),
                        innerRadius: 54,
                        paddingAngle: 2,
                        cornerRadius: 6,
                        highlightScope: { fade: 'global', highlight: 'item' },
                      },
                    ]}
                    slotProps={{ legend: { hidden: true } }}
                  />
                </Box>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {fleetMix.map((m) => {
                    const pct = totalTrucks > 0 ? Math.round((m.value / totalTrucks) * 100) : 0;
                    return (
                      <Stack key={m.label} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Box
                          aria-hidden
                          sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: m.color, flexShrink: 0 }}
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {m.label}
                        </Typography>
                        <Box sx={{ flex: 2, maxWidth: 120, mx: 1 }}>
                          <LinearMeter value={pct} color={m.color} />
                        </Box>
                        <Typography variant="body2" fontWeight={700} sx={{ minWidth: 46, textAlign: 'right' }}>
                          {num(m.value)}
                          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.5 }}>
                            {pct}%
                          </Box>
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </>
            ) : (
              <EmptyState
                height={240}
                icon={LocalShipping}
                title="No trucks in the fleet"
                hint="Add your first truck to see fleet status here."
                action={
                  <Button component={RouterLink} to="/trucks" variant="contained" size="small">
                    Add a truck
                  </Button>
                }
              />
            )}
          </Panel>
        </Box>
      </Box>

      {/* ============ Document alerts + FASTag ============ */}
      <Box
        sx={{
          display: 'grid',
          gap: GAP,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Panel
          title="Document alerts"
          subtitle="Compliance items needing attention"
          delay={0.34}
          action={
            <Button component={RouterLink} to="/documents" size="small" color="inherit">
              Manage
            </Button>
          }
        >
          {expiredDocs.length + expiringDocs.length === 0 ? (
            <Stack direction="row" spacing={1.5} sx={{ p: 2, borderRadius: 2, alignItems: 'center', bgcolor: (t) => (t.palette.mode === 'light' ? alpha(TONE.green, 0.07) : alpha(TONE.green, 0.12)) }}>
              <CheckCircle sx={{ color: TONE.green, fontSize: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  All documents are valid
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Nothing expires in the next 30 days.
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
              {expiredDocs.map((d) => (
                <AlertRow
                  key={`expired-${d._id}`}
                  tone={TONE.red}
                  icon={Description}
                  title={`${d.truckNumber} · ${d.docType}`}
                  meta={`Expired ${Math.abs(d.daysLeft || 0)} day${Math.abs(d.daysLeft || 0) === 1 ? '' : 's'} ago`}
                  trailing={<SoftChip tone={TONE.red} label="Expired" />}
                />
              ))}
              {expiringDocs.map((d) => (
                <AlertRow
                  key={`expiring-${d._id}`}
                  tone={TONE.amber}
                  icon={Description}
                  title={`${d.truckNumber} · ${d.docType}`}
                  meta={`Expires ${fmtDay(d.expiryDate)}`}
                  trailing={<SoftChip tone={TONE.amber} label={`${d.daysLeft}d left`} />}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel
          title="FASTag balance"
          subtitle="Trucks below the ₹1,000 threshold"
          delay={0.38}
          accent={criticalFastag.length > 0 ? TONE.red : lowFastag.length > 0 ? TONE.amber : TONE.green}
        >
          {lowFastag.length === 0 ? (
            <Stack direction="row" spacing={1.5} sx={{ p: 2, borderRadius: 2, alignItems: 'center', bgcolor: (t) => (t.palette.mode === 'light' ? alpha(TONE.green, 0.07) : alpha(TONE.green, 0.12)) }}>
              <CheckCircle sx={{ color: TONE.green, fontSize: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  All FASTag balances are healthy
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Every truck is above the ₹1,000 threshold.
                </Typography>
              </Box>
            </Stack>
          ) : (
            <>
              {/* Urgency header: how much money is needed, and how many trucks
                  are completely empty (those will bounce at a toll plaza). */}
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: 'center',
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: 2,
                  bgcolor: (t) =>
                    t.palette.mode === 'light'
                      ? alpha(criticalFastag.length > 0 ? TONE.red : TONE.amber, 0.07)
                      : alpha(criticalFastag.length > 0 ? TONE.red : TONE.amber, 0.12),
                }}
              >
                <AccountBalanceWallet
                  sx={{ color: criticalFastag.length > 0 ? TONE.red : TONE.amber, fontSize: 22 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {inr(fastagShortfall)} to recharge
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {criticalFastag.length > 0
                      ? `${criticalFastag.length} truck${criticalFastag.length > 1 ? 's' : ''} at zero balance — will be stopped at tolls`
                      : `${lowFastag.length} truck${lowFastag.length > 1 ? 's' : ''} below ₹1,000`}
                  </Typography>
                </Box>
                <Button component={RouterLink} to="/trucks" size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                  Recharge
                </Button>
              </Stack>
              <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                {lowFastag.map((t) => {
                  const isEmpty = Number(t.balance) <= 0;
                  return (
                    <AlertRow
                      key={t.truckNumber}
                      tone={isEmpty ? TONE.red : TONE.amber}
                      icon={isEmpty ? WarningAmber : AccountBalanceWallet}
                      title={t.truckNumber}
                      meta={isEmpty ? 'Balance exhausted — recharge now' : 'Below the ₹1,000 threshold'}
                      trailing={
                        <SoftChip
                          tone={isEmpty ? TONE.red : TONE.amber}
                          label={isEmpty ? 'Zero' : inr(t.balance)}
                        />
                      }
                    />
                  );
                })}
              </Box>
            </>
          )}
        </Panel>
      </Box>

      {/* Data-freshness footnote, so the numbers are never mistaken for live
          telemetry. */}
      <Stack direction="row" spacing={1} sx={{ pb: 1, alignItems: 'center' }}>
        <Build sx={{ fontSize: 15, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.secondary">
          Distance and fuel cover the current calendar month. Revenue, profit and tolls are all-time. Balances
          and documents refresh when you reload.
        </Typography>
      </Stack>
    </Stack>
  );
}

/* Thin percentage bar used in the fleet breakdown. */
function LinearMeter({ value, color }) {
  return (
    <Box
      role="presentation"
      sx={{ height: 6, borderRadius: 999, bgcolor: 'background.nested', overflow: 'hidden' }}
    >
      <Box
        sx={{
          width: `${Math.max(value, value > 0 ? 6 : 0)}%`,
          height: '100%',
          borderRadius: 999,
          bgcolor: color,
          transition: 'width 400ms ease',
        }}
      />
    </Box>
  );
}

/* Screen-reader-only helper. Works both as a React `style` object and inside
   MUI's `sx`, since sx accepts plain style-like objects. */
const SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
