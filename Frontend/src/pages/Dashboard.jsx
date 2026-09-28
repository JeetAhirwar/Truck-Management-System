import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { alpha } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  Calculate,
  CurrencyRupee,
  Description,
  Engineering,
  LocalGasStation,
  LocalShipping,
  People,
  Refresh,
  Route as RouteIcon,
  ShowChart,
  VisibilityOutlined,
  WarningAmber,
} from '@mui/icons-material';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { EmptyState, SoftChip, StatCard } from '../components/ui';

const EASE = [0.22, 0.61, 0.36, 1];

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const inr = (n) => `₹${num(Math.round(Number(n || 0)))}`;
const litres = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

function FadeUp({ delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
}

function Panel({ title, subtitle, action, delay = 0, children, sx }) {
  return (
    <FadeUp delay={delay}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
        <CardContent sx={{ p: '20px !important', '&:last-child': { pb: '20px !important' }, flex: 1 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2.5 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">{title}</Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Stack>
          {children}
        </CardContent>
      </Card>
    </FadeUp>
  );
}

function DashboardSkeleton() {
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Skeleton width={260} height={34} />
          <Skeleton width={190} />
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Skeleton variant="rounded" width={110} height={40} />
          <Skeleton variant="rounded" width={170} height={40} />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={150} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Skeleton variant="rounded" height={340} />
        <Skeleton variant="rounded" height={340} />
      </Box>
    </Stack>
  );
}

function AlertRow({ tone, title, meta, metaColor }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: alpha(tone, 0.09),
        border: `1px solid ${alpha(tone, 0.22)}`,
        '& + &': { mt: 1 },
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {meta}
        </Typography>
      </Box>
      <Chip size="small" label={metaColor} sx={{ bgcolor: 'transparent', color: tone, border: `1px solid ${alpha(tone, 0.4)}` }} />
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
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h2">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Fleet overview & alerts
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

  const inactive = Math.max(
    0,
    Number(s.totalTrucks || 0) - Number(s.available || 0) - Number(s.inTransit || 0) - Number(s.maintenance || 0)
  );

  const trips = [...recentTrips].reverse();
  const labels = trips.map((t) => t.tripId || String(t._id).slice(-4));
  const hasTrips = trips.length > 0;

  const expiredDocs = alerts.expiredDocs || [];
  const expiringDocs = alerts.expiringSoon || [];
  const lowFastag = alerts.lowFastag || [];

  const alertTint = (hex) => ({
    bgcolor: (t) => (t.palette.mode === 'light' ? hex : alpha(hex, 0.08)),
  });

  return (
    <Stack spacing={3}>
      {/* ------------------------- Header ------------------------- */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2">Welcome back, {user?.name || 'Admin'}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <SoftChip status="Valid" label={`Fleet size: ${num(s.totalTrucks)}`} />
            <SoftChip tone="#d97706" label={`Trips in progress: ${num(pendingTrips)}`} />
            {(docsExpired + docsExpiring > 0 || maintenanceDue > 0) && (
              <SoftChip tone="#dc2626" label={`${docsExpired + docsExpiring + maintenanceDue} need attention`} />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="Refresh data">
            <IconButton onClick={load} disabled={state.loading} sx={{ border: 1, borderColor: 'divider' }}>
              <Refresh sx={{ animation: state.loading ? 'spin 0.9s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
          <Button
            component={RouterLink}
            to="/calculator"
            variant="contained"
            color="primary"
            startIcon={<Calculate />}
          >
            Quick Trip Calculator
          </Button>
        </Stack>
      </Stack>

      {/* ------------------------- KPI cards ------------------------- */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
        }}
      >
        <StatCard
          layout="stacked"
          icon={CurrencyRupee}
          label="Revenue (all time)"
          value={inr(revenue)}
          tone="#059669"
          hint={`Est. profit ${inr(profit)}${revenue > 0 ? ` · ${margin}% margin` : ''}`}
          delay={0}
        />
        <StatCard
          layout="stacked"
          icon={RouteIcon}
          label="Distance (this month)"
          value={`${num(s.totalDistanceThisMonth)} km`}
          tone="#2563eb"
          hint={`${litres(s.totalFuelConsumed)} L fuel burnt`}
          delay={0.04}
        />
        <StatCard
          layout="stacked"
          icon={LocalShipping}
          label="Fleet Size"
          value={num(s.totalTrucks)}
          tone="#4f46e5"
          hint={`${num(s.available)} available · ${num(s.inTransit)} on trip`}
          delay={0.08}
        />
        <StatCard
          layout="stacked"
          icon={People}
          label="Drivers"
          value={num(s.totalDrivers)}
          tone="#7c3aed"
          hint="On the roster"
          delay={0.12}
        />
      </Box>

      {/* ------------------------- Alert cards ------------------------- */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <StatCard
          layout="stacked"
          icon={Engineering}
          label="Maintenance due"
          value={num(maintenanceDue)}
          tone="#dc2626"
          hint={
            maintenanceDue > 0
              ? `${maintenanceDue} service${maintenanceDue > 1 ? 's' : ''} overdue`
              : 'No service overdue — fleet is on schedule'
          }
          hintColor={maintenanceDue > 0 ? 'error.main' : 'success.main'}
          badge={
            maintenanceDue > 0 ? (
              <SoftChip tone="#dc2626" label="Action needed" />
            ) : (
              <SoftChip status="Valid" label="All clear" />
            )
          }
          cardSx={maintenanceDue > 0 ? alertTint('#FEF2F2') : undefined}
          delay={0.14}
        />
        <StatCard
          layout="stacked"
          icon={Description}
          label="Documents expiring"
          value={num(docsExpiring + docsExpired)}
          tone={docsExpired > 0 ? '#dc2626' : '#d97706'}
          hint={docsExpired > 0 ? `${docsExpired} already expired` : 'Expiring within 30 days'}
          hintColor={docsExpired > 0 ? 'error.main' : 'warning.main'}
          badge={docsExpired > 0 ? <SoftChip tone="#dc2626" label={`${docsExpired} expired`} /> : null}
          cardSx={docsExpired + docsExpiring > 0 ? alertTint(docsExpired > 0 ? '#FEF2F2' : '#FFFBEB') : undefined}
          delay={0.18}
        />
      </Box>

      {/* ------------------------- Charts ------------------------- */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Panel
          title="Revenue vs expenses"
          subtitle={hasTrips ? `Last ${trips.length} recorded trips` : 'No trips recorded yet'}
          delay={0.2}
          action={<SoftChip tone="#64748b" label={`${recentTrips.length} trips`} />}
        >
          {hasTrips ? (
            <BarChart
              height={300}
              series={[
                {
                  data: trips.map((t) => Number(t.revenue || 0)),
                  label: 'Revenue',
                  color: '#2563eb',
                  valueFormatter: (v) => inr(v),
                },
                {
                  data: trips.map((t) => Number(t.totalExpense || 0)),
                  label: 'Expenses',
                  color: '#f59e0b',
                  valueFormatter: (v) => inr(v),
                },
                {
                  data: trips.map((t) => Number(t.profit || 0)),
                  label: 'Profit',
                  color: '#10b981',
                  valueFormatter: (v) => inr(v),
                },
              ]}
              xAxis={[{ data: labels, scaleType: 'band', tickLabelStyle: { fontSize: 10 } }]}
              yAxis={[{ valueFormatter: (v) => `₹${num(v)}` }]}
              grid={{ horizontal: true, vertical: false }}
              margin={{ top: 8, right: 12, bottom: 28, left: 58 }}
            />
          ) : (
            <EmptyState
              icon={ShowChart}
              title="No trip revenue yet"
              hint="Run the Trip Calculator and save a trip to see this chart."
            />
          )}
        </Panel>

        <Panel
          title="Trip trend"
          subtitle="Distance covered & fuel used per trip"
          delay={0.24}
          action={
            <SoftChip
              color="primary"
              icon={<LocalGasStation sx={{ fontSize: '14px !important' }} />}
              label={`${litres(s.totalFuelConsumed)} L this month`}
            />
          }
        >
          {hasTrips ? (
            <LineChart
              height={300}
              series={[
                {
                  data: trips.map((t) => Number(t.distance || 0)),
                  label: 'Distance (km)',
                  color: '#7c3aed',
                  yAxisKey: 'km',
                  area: true,
                  valueFormatter: (v) => `${num(v)} km`,
                },
                {
                  data: trips.map((t) => Number(t.fuelRequired || 0)),
                  label: 'Fuel (L)',
                  color: '#f59e0b',
                  yAxisKey: 'litres',
                  valueFormatter: (v) => `${litres(v)} L`,
                },
              ]}
              xAxis={[{ data: labels, scaleType: 'point', tickLabelStyle: { fontSize: 10 } }]}
              yAxis={[
                { id: 'km', label: 'km', width: 52 },
                { id: 'litres', label: 'L', position: 'right', width: 46 },
              ]}
              grid={{ horizontal: true, vertical: false }}
              margin={{ top: 8, right: 12, bottom: 28, left: 56 }}
            />
          ) : (
            <EmptyState
              icon={LocalGasStation}
              title="No distance data yet"
              hint="Saved trips will plot their distance and fuel usage here."
            />
          )}
        </Panel>
      </Box>

      {/* ------------------------- Recent trips + fleet mix ------------------------- */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0,1fr))' },
        }}
      >
        <Box sx={{ gridColumn: { lg: 'span 8' } }}>
          <Panel
            title="Recent trips"
            subtitle="Latest activity across the fleet"
            delay={0.28}
            action={
              <Button component={RouterLink} to="/trips" size="small" color="inherit" endIcon={<RouteIcon sx={{ fontSize: '16px !important' }} />}>
                View all
              </Button>
            }
          >
            {hasTrips ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Truck</TableCell>
                      <TableCell>Route</TableCell>
                      <TableCell align="right">Distance</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Profit %</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...recentTrips].map((t) => {
                      const tripProfit = Number(t.profit || 0);
                      const tripRevenue = Number(t.revenue || 0);
                      const tripMargin =
                        tripRevenue > 0 ? Math.round((tripProfit / tripRevenue) * 100) : 0;
                      return (
                        <TableRow key={t._id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {t.tripId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t.truckNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {t.truckNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                              {t.from} → {t.to}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{num(t.distance)} km</TableCell>
                          <TableCell align="right">{inr(t.revenue)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ color: tripProfit >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}
                            >
                              {tripMargin}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {inr(tripProfit)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <SoftChip status={t.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View in Trips">
                              <IconButton
                                size="small"
                                component={RouterLink}
                                to="/trips"
                                aria-label={`View ${t.tripId}`}
                                sx={{ color: 'text.secondary' }}
                              >
                                <VisibilityOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState
                height={190}
                icon={RouteIcon}
                title="No trips yet"
                hint="Use the Trip Calculator to plan and price your first trip."
              />
            )}
          </Panel>
        </Box>

        <Box sx={{ gridColumn: { lg: 'span 4' } }}>
          <Panel title="Fleet status" subtitle="Live vehicle distribution" delay={0.32}>
            {Number(s.totalTrucks || 0) > 0 ? (
              <PieChart
                height={300}
                series={[
                  {
                    data: [
                      { id: 0, value: Number(s.available || 0), label: 'Available', color: '#2563eb' },
                      { id: 1, value: Number(s.inTransit || 0), label: 'On trip', color: '#f59e0b' },
                      { id: 2, value: Number(s.maintenance || 0), label: 'Maintenance', color: '#f43f5e' },
                      { id: 3, value: inactive, label: 'Inactive', color: '#94a3b8' },
                    ],
                    innerRadius: 58,
                    paddingAngle: 2,
                    cornerRadius: 5,
                    highlightScope: { fade: 'global', highlight: 'item' },
                  },
                ]}
                slotProps={{
                  legend: { position: { vertical: 'bottom', horizontal: 'right' } },
                }}
              />
            ) : (
              <EmptyState
                icon={LocalShipping}
                title="No trucks in the fleet"
                hint="Add your first truck to see fleet status here."
              />
            )}
          </Panel>
        </Box>
      </Box>

      {/* ------------------------- Alerts ------------------------- */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0,1fr))' },
        }}
      >
        <Panel
          title="Document alerts"
          subtitle="Compliance items that need attention"
          delay={0.34}
          action={
            <Button component={RouterLink} to="/documents" size="small" color="inherit">
              Manage
            </Button>
          }
        >
          {expiredDocs.length + expiringDocs.length === 0 ? (
            <Alert severity="success" variant="outlined" sx={{ borderRadius: 2 }}>
              All documents are valid — nothing expires in the next 30 days.
            </Alert>
          ) : (
            <Box sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
              {expiredDocs.map((d) => (
                <AlertRow
                  key={`expired-${d._id}`}
                  tone="#dc2626"
                  title={`${d.truckNumber} · ${d.docType}`}
                  meta={d.expiryDate ? `Expired ${Math.abs(d.daysLeft || 0)} days ago` : 'Expired'}
                  metaColor="Expired"
                />
              ))}
              {expiringDocs.map((d) => (
                <AlertRow
                  key={`expiring-${d._id}`}
                  tone="#d97706"
                  title={`${d.truckNumber} · ${d.docType}`}
                  meta={`Expires ${new Date(d.expiryDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`}
                  metaColor={`${d.daysLeft}d left`}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel
          title="FASTag low balance"
          subtitle="Trucks below the ₹1,000 threshold"
          delay={0.38}
        >
          {lowFastag.length === 0 ? (
            <Alert severity="success" variant="outlined" sx={{ borderRadius: 2 }}>
              All FASTag balances are healthy.
            </Alert>
          ) : (
            <Box sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
              {lowFastag.map((t) => (
                <AlertRow
                  key={t.truckNumber}
                  tone="#dc2626"
                  title={t.truckNumber}
                  meta="Recharge before the next trip"
                  metaColor={inr(t.balance)}
                />
              ))}
            </Box>
          )}
        </Panel>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ pb: 1 }}>
        <WarningAmber sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.secondary">
          Monthly distance & fuel cover the current calendar month; revenue, profit and toll figures are
          all-time.
        </Typography>
      </Stack>
    </Stack>
  );
}
