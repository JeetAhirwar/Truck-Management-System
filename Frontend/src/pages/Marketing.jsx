import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Tooltip as MuiTooltip,
  Typography,
  Dialog,
  IconButton,
} from '@mui/material';
import {
  RocketLaunch,
  Bolt,
  NotificationsActive,
  Route as RouteIcon,
  Description,
  BuildCircle,
  Group,
  Sell,
  BarChart as BarIcon,
  Security,
  WifiTethering,
  CheckCircle,
  ArrowForward,
  ArrowDownward,
  Dashboard as DashboardIcon,
  LocationOn,
  QrCode,
  AltRoute,
  ReceiptLong,
  Payments,
  Sms,
  ManageAccounts,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Refresh,
  Close,
} from '@mui/icons-material';
import {
  Truck,
  Car,
  Fuel,
  ShieldCheck,
  TrendingUp,
  GitBranch,
} from 'lucide-react';
import logo from '../assets/dark mode logo.png';
import aiKnotsLogo from '../assets/Ai-knots-logo.png';

/* ------------------------------------------------------------------ */
/* Sample marketing data (illustrative, not live app data)             */
/* ------------------------------------------------------------------ */
const REVENUE_TREND = [
  { m: 'Jan', revenue: 420, cost: 280 },
  { m: 'Feb', revenue: 510, cost: 330 },
  { m: 'Mar', revenue: 580, cost: 360 },
  { m: 'Apr', revenue: 690, cost: 410 },
  { m: 'May', revenue: 740, cost: 430 },
  { m: 'Jun', revenue: 860, cost: 470 },
  { m: 'Jul', revenue: 980, cost: 520 },
  { m: 'Aug', revenue: 1040, cost: 540 },
];

const EXPENSE_SPLIT = [
  { name: 'Profit', value: 41, color: '#22c55e' },
  { name: 'Fuel', value: 26, color: '#2563eb' },
  { name: 'Toll', value: 18, color: '#7c3aed' },
  { name: 'Driver', value: 10, color: '#f59e0b' },
  { name: 'Other', value: 5, color: '#64748b' },
];

const TRIPS_PER_MONTH = [
  { m: 'Jan', trips: 42 },
  { m: 'Feb', trips: 55 },
  { m: 'Mar', trips: 48 },
  { m: 'Apr', trips: 72 },
  { m: 'May', trips: 66 },
  { m: 'Jun', trips: 84 },
  { m: 'Jul', trips: 91 },
  { m: 'Aug', trips: 108 },
];

const UTILIZATION = [
  { name: 'Trucks', value: 86, fill: '#2563eb' },
  { name: 'Drivers', value: 74, fill: '#7c3aed' },
  { name: 'Docs', value: 92, fill: '#22c55e' },
  { name: 'FASTag', value: 68, fill: '#f59e0b' },
];

const STATS = [
  { icon: TrendingUp, value: '640+', label: 'Trips tracked' },
  { icon: Car, value: '85+', label: 'Vehicles managed' },
  { icon: ShieldCheck, value: '99.9%', label: 'Uptime' },
  { icon: Fuel, value: '₹38L', label: 'Cost analysed' },
];

const FEATURES = [
  { icon: DashboardIcon, title: 'Command center dashboard', text: 'Revenue, profit, distance, fleet health and alerts — one glance, no spreadsheets.' },
  { icon: NotificationsActive, title: 'Live alerts', text: 'Document expiry, FASTag low balance and maintenance reminders pushed in real-time to your inbox-like feed.' },
  { icon: RouteIcon, title: 'Route & toll engine', text: 'Real OSRM distances with TollGuru toll estimates — profit calculated before you start moving.' },
  { icon: Description, title: 'Document compliance', text: 'RC, insurance, PUC, fitness & permit tracking with expiry warnings so checks never fail.' },
  { icon: BuildCircle, title: 'Maintenance tracker', text: 'Overdue and due-next service watches keep every truck road-ready.' },
  { icon: Group, title: 'Driver management', text: 'Roster, licenses and truck assignments — driver follows the truck automatically.' },
  { icon: Sell, title: 'FASTag monitoring', text: 'Balance low? Escalated alerts before a toll gate ever blocks your truck.' },
  { icon: Bolt, title: 'One-tap trip start', text: 'Price a route, hit start — the truck leaves the pool and status flows live.' },
];

const VISUAL_FLOW = [
  {
    n: '01', icon: Truck,
    title: 'Add your trucks',
    text: 'Register your fleet and pair the right driver to each truck.',
    grad: ['#2563eb', '#7c3aed'],
  },
  {
    n: '02', icon: RouteIcon,
    title: 'Price the trip',
    text: 'Pick from → to. Distance, tolls and profit show up before you move.',
    grad: ['#0ea5e9', '#6366f1'],
  },
  {
    n: '03', icon: RocketLaunch,
    title: 'Hit start',
    text: 'The trip goes live and your dashboard updates all by itself.',
    grad: ['#2563eb', '#7c3aed'],
  },
  {
    n: '04', icon: TrendingUp,
    title: 'Track and earn',
    text: 'Follow the trip live, close it and log exactly what you earned.',
    grad: ['#0ea5e9', '#6366f1'],
  },
  {
    n: '05', icon: NotificationsActive,
    title: 'Alerts on autopilot',
    text: 'Expired documents and low FASTag remind you — before they bite.',
    grad: ['#2563eb', '#7c3aed'],
  },
];

const UPCOMING = [
  {
    icon: LocationOn,
    title: 'Live GPS tracking',
    text: 'See every vehicle moving on a live map — no phone calls, no guessing.',
    tag: 'Soon',
  },
  {
    icon: QrCode,
    title: 'Driver app',
    text: 'QR check-in on the phone — drivers get their assigned trips instantly.',
    tag: 'Soon',
  },
  {
    icon: AltRoute,
    title: 'Multi-stop planning',
    text: 'Plan A → B → C → D in a single trip and price the whole run.',
    tag: 'Soon',
  },
  {
    icon: ReceiptLong,
    title: 'Invoices & GST reports',
    text: 'Auto-generated trip invoices, ready to print or share with clients.',
    tag: 'Soon',
  },
  {
    icon: Payments,
    title: 'Payments & collections',
    text: 'Mark trip money as received or pending — books stay clean at all times.',
    tag: 'Soon',
  },
  {
    icon: Sms,
    title: 'WhatsApp & SMS alerts',
    text: 'Critical warnings reach your phone even when you are away from the app.',
    tag: 'Soon',
  },
  {
    icon: ManageAccounts,
    title: 'Team roles',
    text: 'Give your accountant or manager their own secure, limited login.',
    tag: 'Soon',
  },
  {
    icon: Smartphone,
    title: 'Mobile app',
    text: 'The entire dashboard in your pocket — Android and iOS, offline-friendly.',
    tag: 'Planned',
  },
];

const CONCEPT = [
  {
    icon: BuildCircle,
    title: 'The old way',
    items: [
      'Trip costs guessed after the trip finished',
      'Expired documents found out during a check',
      'FASTag runs out mid-route, truck stands at a gate',
      'Driver & truck data scattered across files',
    ],
  },
  {
    icon: RocketLaunch,
    title: 'With VTMS',
    items: [
      'Profit calculated before the wheels turn',
      'Expiry alerts days in advance, live to your feed',
      'Low balance flagged before it blocks a toll',
      'Everything in one dashboard, real-time',
    ],
  },
];

const SCREENSHOTS = [
  { file: 'dashboard.png', label: 'Dashboard', hint: 'Live KPIs, charts & alerts' },
  { file: 'calculator.png', label: 'Trip Calculator', hint: 'Route, tolls & profit preview' },
  { file: 'trips.png', label: 'Trips', hint: 'History & earnings' },
  { file: 'trip-details.png', label: 'Trip detail', hint: 'Map + financial breakdown' },
  { file: 'trucks.png', label: 'Fleet', hint: 'Vehicles & FASTag' },
  { file: 'drivers.png', label: 'Drivers', hint: 'Roster & assignments' },
  { file: 'documents.png', label: 'Documents', hint: 'Compliance & expiry' },
  { file: 'notifications.png', label: 'Notifications', hint: 'Live alert feed' },
  { file: 'dashboard-dark.png', label: 'Dark mode', hint: 'Eye-friendly theme' },
  { file: 'settings.png', label: 'Settings', hint: 'Fuel prices & defaults' },
];

const fade = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] } },
};

function Reveal({ children, delay = 0, ...rest }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={{ ...fade, show: { ...fade.show, transition: { ...fade.show.transition, delay } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function FlowStep({ step }) {
  const { n, icon: Icon, title, text, grad } = step;
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="overline" fontWeight={900} sx={{ color: 'primary.main', letterSpacing: '0.24em' }}>
        STEP {n}
      </Typography>
      <Box sx={{ position: 'relative', width: 104, height: 104, mx: 'auto', mt: 1 }}>
        <Box sx={{ position: 'absolute', inset: 6, borderRadius: 5, bgcolor: 'rgba(37,99,235,.4)', filter: 'blur(22px)' }} />
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '28px',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
            boxShadow: '0 14px 30px -12px rgba(37,99,235,.7)',
          }}
        >
          <Icon size={40} />
        </Box>
      </Box>
      <Typography variant="h6" fontWeight={800} sx={{ mt: 1.75, letterSpacing: '0.01em' }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mx: 'auto', maxWidth: 220, lineHeight: 1.5 }}>
        {text}
      </Typography>
    </Box>
  );
}

function FlowArrow() {
  return (
    <Box
      sx={{
        width: { xs: '100%', md: 52 },
        height: { xs: 52, md: 52 },
        mt: { xs: 0, md: 6.25 },
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        color: 'primary.main',
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'grid' } }}>
        <motion.div animate={{ x: [0, 9, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <ArrowForward />
        </motion.div>
      </Box>
      <Box sx={{ display: { xs: 'grid', md: 'none' } }}>
        <motion.div animate={{ y: [0, 9, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <ArrowDownward />
        </motion.div>
      </Box>
    </Box>
  );
}

function ShotCard({ shot, i }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const openDialog = () => {
    setScale(1);
    setOpen(true);
  };
  const zoom = (d) => setScale((s) => Math.min(3, Math.max(0.5, +(s + d).toFixed(2))));
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
      >
        <Paper
          elevation={0}
          onClick={broken ? undefined : openDialog}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            height: '100%',
            cursor: broken ? 'default' : 'zoom-in',
            transition: 'transform .25s ease, box-shadow .25s ease',
            '&:hover': {
              transform: 'translateY(-5px)',
              boxShadow: '0 24px 48px -20px rgba(0,0,0,.5)',
              ...(broken ? {} : { borderColor: 'primary.main' }),
            },
          }}
        >
          <Box
            sx={{
              aspectRatio: '16 / 10',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              bgcolor: (t) =>
                broken ? 'transparent' : t.palette.mode === 'dark' ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
              overflow: 'hidden',
              ...(broken ? {} : { '& .zoom-badge': { opacity: 0 }, '&:hover .zoom-badge': { opacity: 1 } }),
            }}
          >
            {broken ? (
              <Box sx={{ textAlign: 'center', px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  📸
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                  Screenshot coming soon
                </Typography>
              </Box>
            ) : (
              <Box
                component="img"
                src={`/screenshots/${shot.file}`}
                alt={shot.label}
                onError={() => setBroken(true)}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {!broken && (
              <Box
                className="zoom-badge"
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  bgcolor: 'rgba(2,6,23,.55)',
                  backdropFilter: 'blur(6px)',
                  transition: 'opacity .2s ease',
                }}
              >
                <ZoomIn fontSize="small" />
              </Box>
            )}
          </Box>
          <Box sx={{ p: 1.75 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {shot.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {shot.hint}
            </Typography>
          </Box>
        </Paper>
      </motion.div>

      <Dialog
        open={broken ? false : open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            maxWidth: 1160,
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800}>
              {shot.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {shot.hint}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} sx={{ ml: 'auto', alignItems: 'center' }}>
            <IconButton onClick={() => zoom(-0.25)} size="small" disabled={scale <= 0.5} aria-label="Zoom out" sx={{ color: 'text.secondary' }}>
              <ZoomOut fontSize="small" />
            </IconButton>
            <IconButton onClick={() => setScale(1)} size="small" aria-label="Reset zoom" sx={{ color: 'text.secondary' }}>
              <Refresh fontSize="small" sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton onClick={() => zoom(0.25)} size="small" disabled={scale >= 3} aria-label="Zoom in" sx={{ color: 'text.secondary' }}>
              <ZoomIn fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(scale * 100)}%
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <IconButton onClick={() => setOpen(false)} size="small" aria-label="Close preview" sx={{ color: 'text.secondary' }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(2,6,23,.7)' : 'rgba(248,250,252,.7)'), maxHeight: '76vh', overflow: 'auto', display: 'grid', placeItems: 'center' }}>
          <Box
            component="img"
            src={`/screenshots/${shot.file}`}
            alt={shot.label}
            sx={{
              maxWidth: '100%',
              display: 'block',
              borderRadius: 2.5,
              objectFit: 'contain',
              transform: `scale(${scale})`,
              transition: 'transform .2s ease',
              transformOrigin: 'center center',
            }}
          />
        </Box>
      </Dialog>
    </>
  );
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid rgba(148,163,184,.2)',
  borderRadius: 12,
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: 12,
};

function Marketing() {
  const [faqOpen, setFaqOpen] = useState(null);
  const pieColors = useMemo(() => EXPENSE_SPLIT.map((d) => d.color), []);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* ---------- Navbar ---------- */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(14px)',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(2,6,23,.72)' : 'rgba(255,255,255,.78)'),
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, py: 2 }}>
            <Box component="img" src={logo} alt="VTMS logo" sx={{ width: 56, height: 56, objectFit: 'contain' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.1, letterSpacing: '0.06em' }}>
                VTMS
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontStyle: 'italic', fontSize: 10 }}>
                Vehicle & Transport Management System
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={2}
              sx={{ ml: 'auto', alignItems: 'center', display: { xs: 'none', md: 'flex' } }}
            >
              {[
                ['Features', '#features'],
                ['Analytics', '#analytics'],
                ['How it works', '#how'],
                ['Screens', '#screens'],
              ].map(([label, href]) => (
                <Typography
                  key={href}
                  component="a"
                  href={href}
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                >
                  {label}
                </Typography>
              ))}
              <Button
                component="a"
                href="https://aiknotsit.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                sx={{ borderRadius: 2.5 }}
              >
                Contact us
              </Button>
              <Button component={Link} to="/login" variant="contained" size="small" endIcon={<ArrowForward fontSize="small" />}>
                Try Demo
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ---------- Hero ---------- */}
      <Box sx={{ position: 'relative', py: { xs: 8, md: 12 }, overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            top: -120,
            left: -80,
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37,99,235,.35), transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 120,
            right: -100,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,.3), transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid container spacing={6} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <Stack spacing={2.5}>
                  <Box sx={{ alignSelf: 'flex-start' }}>
                    <MuiTooltip title="Live pipeline">
                      <Paper
                        component={Link}
                        to="/login"
                        sx={{
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 99,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 1,
                          textDecoration: 'none',
                        }}
                      >
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                        <Typography variant="caption" fontWeight={600}>
                          In production · JWT secured
                        </Typography>
                      </Paper>
                    </MuiTooltip>
                  </Box>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: '2.2rem', sm: '3rem', md: '3.6rem' },
                      lineHeight: 1.06,
                      background: 'linear-gradient(120deg, #60a5fa, #a78bfa)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Run your entire vehicle fleet from one dashboard.
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500, maxWidth: 560 }}>
                    Routes, tolls, fuel, drivers, documents and live alerts — profit decided before the wheels turn, and every deadline watched for you.
                  </Typography>
                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <Button
                      component={Link}
                      to="/login"
                      size="large"
                      variant="contained"
                      endIcon={<ArrowForward />}
                      sx={{ px: 3.5, borderRadius: 2.5 }}
                    >
                      Start free demo
                    </Button>
                    <Button
                      href="#how"
                      size="large"
                      variant="outlined"
                      startIcon={<GitBranch />}
                      sx={{ px: 3.5, borderRadius: 2.5 }}
                    >
                      See how it works
                    </Button>
                  </Stack>
                </Stack>
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }}>
                <Box
                  sx={{
                    borderRadius: 4,
                    border: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                    boxShadow: '0 40px 80px -30px rgba(37,99,235,.4)',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 0.75 }}>
                    {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                      <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
                    ))}
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                      {[
                        ['Revenue', '₹8.42L'],
                        ['Profit', '₹3.55L'],
                        ['Margin', '42%'],
                        ['In transit', '12'],
                      ].map(([k, v]) => (
                        <Box
                          key={k}
                          sx={{
                            flex: 1,
                            borderRadius: 2,
                            border: 1,
                            borderColor: 'divider',
                            p: 1,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {k}
                          </Typography>
                          <Typography variant="body1" fontWeight={800}>
                            {v}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Box sx={{ height: 150 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={REVENUE_TREND} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="heroRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="m" hide />
                          <YAxis hide />
                          <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#heroRev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Box sx={{ flex: 1, borderRadius: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(34,197,94,.12)' : 'rgba(34,197,94,.1)'), p: 1.15 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Documents up to date
                        </Typography>
                        <Typography variant="h6" fontWeight={800} sx={{ color: '#16a34a' }}>
                          92%
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, borderRadius: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,.12)' : 'rgba(37,99,235,.08)'), p: 1.15 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Fleet utilization
                        </Typography>
                        <Typography variant="h6" fontWeight={800} sx={{ color: '#2563eb' }}>
                          86%
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, borderRadius: 2, border: 1, borderColor: 'divider', p: 1.15 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Alerts pushed
                        </Typography>
                        <Typography variant="h6" fontWeight={800}>
                          24×7
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ---------- Stats strip ---------- */}
      <Container maxWidth="lg" sx={{ pb: 6 }}>
<Reveal>
          <Paper elevation={0} sx={{ borderRadius: 4, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'grid',
                gap: '1px',
                bgcolor: 'divider',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              }}
            >
              {STATS.map(({ icon: Icon, value, label }) => (
                <Box key={label} sx={{ textAlign: 'center', py: 3, bgcolor: 'background.paper' }}>
                  <Icon size={22} style={{ opacity: 0.7 }} />
                  <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>
                    {value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Reveal>
      </Container>

      {/* ---------- Features ---------- */}
      <Box id="features" component="section" sx={{ py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              Features
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Built for daily operations, not just reporting
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto' }}>
              Every screen solves one real problem a fleet owner faces before, during and after a trip.
            </Typography>
          </Reveal>
          <Grid container spacing={2.5}>
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={title}>
                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: (i % 4) * 0.07 }}
                  style={{ height: '100%' }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: 3,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      transition: 'all .22s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 18px 40px -22px rgba(37,99,235,.45)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        mb: 1.75,
                        color: 'primary.main',
                        bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,.18)' : 'rgba(37,99,235,.1)'),
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {text}
                    </Typography>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---------- Analytics / charts ---------- */}
      <Box id="analytics" component="section" sx={{ py: { xs: 6, md: 9 }, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(148,163,184,.05)' : 'rgba(0,0,0,.02)') }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              Analytics
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Numbers that actually run the business
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620, mx: 'auto' }}>
              Sample visuals of the analytics built into the dashboard — trends, splits and utilization at a glance.
            </Typography>
          </Reveal>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                <Box sx={{ px: 1, pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Revenue vs cost
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ₹ thousands · 12-month trend
                  </Typography>
                </Box>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_TREND} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                      <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#gRev)" />
                      <Area type="monotone" dataKey="cost" name="Cost" stroke="#7c3aed" strokeWidth={2.5} fill="url(#gCost)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                <Box sx={{ px: 1, pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Where every ₹ goes
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Expense split
                  </Typography>
                </Box>
                <Box sx={{ height: 300, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={EXPENSE_SPLIT}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={100}
                        paddingAngle={3}
                        stroke="none"
                        cornerRadius={6}
                      >
                        {EXPENSE_SPLIT.map((d, i) => (
                          <Cell key={d.name} fill={pieColors[i]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={900}>
                        41%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        margin
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Stack direction="row" spacing={1.25} sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                  {EXPENSE_SPLIT.map((d) => (
                    <Stack key={d.name} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: d.color }} />
                      <Typography variant="caption" color="text.secondary">
                        {d.name} {d.value}%
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                <Box sx={{ px: 1, pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Trips per month
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fleet activity
                  </Typography>
                </Box>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={TRIPS_PER_MONTH} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" vertical={false} />
                      <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                      <Bar dataKey="trips" name="Trips" radius={[6, 6, 0, 0]}>
                        {TRIPS_PER_MONTH.map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? '#2563eb' : '#7c3aed'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                <Box sx={{ px: 1, pb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Utilization health
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Trucks · drivers · docs · FASTag
                  </Typography>
                </Box>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="18%" outerRadius="90%" data={UTILIZATION} startAngle={90} endAngle={-270}>
                      <RadialBar dataKey="value" background cornerRadius={8} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconSize={12} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ---------- How it works ---------- */}
      <Box id="how" component="section" sx={{ py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              How it works
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Your fleet's whole day, in five steps
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
              No manuals, no training. If you can follow arrows, you can run VTMS.
            </Typography>
          </Reveal>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: 'stretch', mt: 4 }}>
            {VISUAL_FLOW.map((step, i) => (
              <Fragment key={step.n}>
                <Box sx={{ flex: { md: 1 }, width: { xs: '100%' }, px: { xs: 0, md: 1 } }}>
                  <Reveal delay={(i % 5) * 0.07}>
                    <FlowStep step={step} />
                  </Reveal>
                </Box>
                {i < VISUAL_FLOW.length - 1 && <FlowArrow />}
              </Fragment>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ---------- Product screenshots ---------- */}
      <Box id="screens" component="section" sx={{ py: { xs: 6, md: 9 }, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(148,163,184,.05)' : 'rgba(0,0,0,.02)') }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              Product tour
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Every screen, product-ready
            </Typography>
          </Reveal>
          <Grid container spacing={2.5}>
            {SCREENSHOTS.map((shot, i) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={shot.file}>
                <ShotCard shot={shot} i={i} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---------- Concept / problem vs solution ---------- */}
      <Box id="concept" component="section" sx={{ py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              The concept
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Why operators switch to VTMS
            </Typography>
          </Reveal>
          <Grid container spacing={3}>
            {CONCEPT.map(({ icon: Icon, title, items }, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={title}>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: 1,
                      borderColor: i === 1 ? 'success.main' : 'divider',
                      p: 3,
                      height: '100%',
                      bgcolor: i === 1 ? (t) => (t.palette.mode === 'dark' ? 'rgba(34,197,94,.06)' : 'rgba(34,197,94,.04)') : 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: 2.5,
                          display: 'grid',
                          placeItems: 'center',
                          color: i === 1 ? '#16a34a' : 'text.secondary',
                          bgcolor: i === 1 ? 'rgba(34,197,94,.14)' : 'rgba(148,163,184,.14)',
                        }}
                      >
                        <Icon size={22} />
                      </Box>
                      <Typography variant="h6" fontWeight={800}>
                        {title}
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {items.map((item) => (
                        <Stack key={item} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <CheckCircle
                            fontSize="small"
                            sx={{ mt: 0.25, color: i === 1 ? 'success.main' : 'error.main' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {item}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---------- Upcoming features / roadmap ---------- */}
      <Box component="section" sx={{ py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Reveal sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              Roadmap
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
              Upcoming features
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
              We keep building. Here is what is already on the drawing board.
            </Typography>
          </Reveal>
          <Reveal>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
                border: 1,
                borderColor: 'divider',
                background: (t) =>
                  t.palette.mode === 'dark'
                    ? 'linear-gradient(160deg, rgba(37,99,235,.12), rgba(124,58,237,.12))'
                    : 'linear-gradient(160deg, rgba(37,99,235,.06), rgba(124,58,237,.06))',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: -90,
                  right: -70,
                  width: 260,
                  height: 260,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(37,99,235,.18), transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -90,
                  left: -70,
                  width: 260,
                  height: 260,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(124,58,237,.15), transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <Grid container spacing={2.5} sx={{ position: 'relative', p: { xs: 2.5, md: 4.5 } }}>
                {UPCOMING.map(({ icon: Icon, title, text, tag }, i) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={title}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      style={{ height: '100%' }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          height: '100%',
                          p: 2.5,
                          borderRadius: 3,
                          border: 1,
                          borderStyle: 'dashed',
                          borderColor: (t) => (t.palette.mode === 'dark' ? 'rgba(148,163,184,.35)' : 'rgba(100,116,139,.35)'),
                          bgcolor: (t) =>
                            t.palette.mode === 'dark' ? 'rgba(15,23,42,.55)' : 'rgba(255,255,255,.72)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              color: 'primary.main',
                              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,.2)' : 'rgba(37,99,235,.1)'),
                            }}
                          >
                            <Icon fontSize="small" />
                          </Box>
                          <Box
                            sx={{
                              fontSize: 10,
                              fontWeight: 800,
                              px: 1,
                              py: 0.25,
                              borderRadius: 2,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: (t) => (t.palette.mode === 'dark' ? '#c4b5fd' : '#7c3aed'),
                              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(124,58,237,.18)' : 'rgba(124,58,237,.1)'),
                            }}
                          >
                            {tag}
                          </Box>
                        </Stack>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>
                          {text}
                        </Typography>
                      </Paper>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Reveal>
        </Container>
      </Box>

      {/* ---------- Security / realtime ---------- */}
      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Reveal>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              border: 1,
              borderColor: 'divider',
              p: { xs: 3, md: 4 },
            }}
          >
            <Grid container spacing={3} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    display: 'grid',
                    placeItems: 'center',
                    mb: 1.5,
                    color: 'primary.main',
                    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,.18)' : 'rgba(37,99,235,.1)'),
                  }}
                >
                  <Security fontSize="large" />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
                  Enterprise hygiene
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The demo runs like production — you can sign in today with a real session.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <Grid container spacing={2}>
                  {[
                    { icon: Security, title: 'JWT secured', text: 'Token-based auth on every API call.' },
                    { icon: WifiTethering, title: 'Realtime, zero refresh', text: 'Socket.IO pushes alerts the moment they fire.' },
                    { icon: ShieldCheck, title: 'Gradual degradation', text: 'Offline maps/toll quota falls back to cached & estimates.' },
                    { icon: BarIcon, title: 'Production analytics', text: 'Recharts visualizations built into the dashboard.' },
                  ].map(({ icon: Icon, title, text }) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={title}>
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0, color: 'primary.main', bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(37,99,235,.16)' : 'rgba(37,99,235,.09)') }}>
                          <Icon fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {text}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Paper>
        </Reveal>
      </Container>

      {/* ---------- CTA ---------- */}
      <Box sx={{ py: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Container maxWidth="md">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Typography variant="h3" fontWeight={900} sx={{ mb: 1.5 }}>
              Ready to see your fleet live?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Sign in with the demo credentials and explore every module — no setup, no card.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center', alignItems: 'center' }}>
              <Button component={Link} to="/login" size="large" variant="contained" endIcon={<ArrowForward />} sx={{ px: 4, py: 1.4, borderRadius: 3, fontSize: '1rem' }}>
                Open the demo
              </Button>
              <Button
                component="a"
                href="https://aiknotsit.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                size="large"
                variant="outlined"
                sx={{ px: 4, py: 1.4, borderRadius: 3, fontSize: '1rem' }}
              >
                Contact us
              </Button>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* ---------- Footer ---------- */}
      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: { xs: 4, md: 5 }, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(2,6,23,.6)' : 'rgba(248,250,252,.6)') }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box component="img" src={logo} alt="VTMS" sx={{ width: 68, height: 68, objectFit: 'contain' }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.1, letterSpacing: '0.06em' }}>
                  VTMS
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Vehicle & Transport Management System
                </Typography>
              </Box>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box component="img" src={aiKnotsLogo} alt="AI Knots IT Solutions" sx={{ width: 72, height: 72, objectFit: 'contain' }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Designed, developed &amp; managed by
                </Typography>
                <Typography variant="body1" fontWeight={900} sx={{ fontStyle: 'italic' }}>
                  AI Knots IT Solutions
                </Typography>
              </Box>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
            © {new Date().getFullYear()} VTMS · AI Knots IT Solutions · All rights reserved. ·{' '}
            <Typography
              component="a"
              href="https://aiknotsit.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Contact us
            </Typography>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default Marketing;