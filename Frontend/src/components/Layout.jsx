import { memo, useCallback, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  NotificationsNone,
  LocalShipping,
  People,
  Description,
  Calculate,
  Route as RouteIcon,
  Settings as SettingsIcon,
  Logout,
  DarkMode,
  LightMode,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../hooks/useAuth';
import { useTheme as useColorMode } from '../hooks/useTheme';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/', icon: DashboardIcon, label: 'Dashboard', desc: 'Fleet overview & live alerts' },
  { to: '/notifications', icon: NotificationsNone, label: 'Notifications', desc: 'Alerts & live updates' },
  { to: '/trucks', icon: LocalShipping, label: 'Trucks', desc: 'Vehicles, drivers & FASTag' },
  { to: '/drivers', icon: People, label: 'Drivers', desc: 'Roster & truck assignments' },
  { to: '/documents', icon: Description, label: 'Documents', desc: 'RC, insurance & compliance' },
  { to: '/calculator', icon: Calculate, label: 'Trip Calculator', desc: 'Price a route in seconds' },
  { to: '/trips', icon: RouteIcon, label: 'Trips', desc: 'Trip history & earnings' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', desc: 'Fuel prices & trip defaults' },
];

const isCurrent = (pathname, to) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

/* Hoisted to module scope: it is created once, so opening the mobile drawer
   or toggling the theme never remounts the whole sidebar. */
const NavContent = memo(function NavContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useColorMode();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    onNavigate?.();
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2.25,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            flexShrink: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
            boxShadow: `0 10px 22px -10px ${alpha(theme.palette.primary.main, 0.9)}`,
          }}
        >
          <LocalShipping fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.15 }}>
            TruckPro
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            Fleet Management
          </Typography>
        </Box>
      </Box>

      <List disablePadding sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            end={to === '/'}
            selected={isCurrent(location.pathname, to)}
            onClick={onNavigate}
            sx={{ mb: 0.5 }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          onClick={toggle}
          startIcon={dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          sx={{ justifyContent: 'flex-start', color: 'text.secondary', borderRadius: 2, px: 1.5 }}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </Button>

        <Divider sx={{ my: 1.25 }} />

        <Stack direction="row"  spacing={1.25} sx={{alignItems: 'center',  px: 1, py: 0.25 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          >
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {user?.email}
            </Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton size="small" onClick={handleLogout} aria-label="Log out">
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
});

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useColorMode();
  const theme = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const handleLogout = useCallback(() => {
    setAccountAnchor(null);
    logout();
    navigate('/login');
  }, [logout, navigate]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: 264,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            position: 'sticky',
            top: 0,
            width: 264,
            height: '100vh',
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <NavContent onNavigate={closeMobile} />
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' },
        }}
      >
        <NavContent onNavigate={closeMobile} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" enableColorOnDark>
          <Toolbar
            sx={{
              gap: 1.5,
              px: { xs: 2, sm: 3 },
              minHeight: { xs: 64, lg: 72 },
            }}
          >
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              sx={{ display: { lg: 'none' }, ml: { xs: -1, sm: 0 } }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flexGrow: 1 }} />

            <NotificationBell />

            <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={toggle} aria-label="Toggle color mode" sx={{ border: 1, borderColor: 'divider' }}>
                {dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Account">
              <IconButton
                onClick={(e) => setAccountAnchor(e.currentTarget)}
                aria-label="Account menu"
                sx={{ p: 0.5, border: 1, borderColor: 'divider' }}
              >
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: 'primary.main',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: 1480,
            mx: 'auto',
            p: { xs: 2, sm: 3, lg: 4 },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" fontWeight={700}>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {user?.email}
          </Typography>
          {user?.role && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={user.role}
              sx={{ mt: 1, textTransform: 'capitalize' }}
            />
          )}
        </Box>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </Box>
  );
}
