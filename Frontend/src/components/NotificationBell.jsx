import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  Typography,
  Tooltip,
  alpha,
} from '@mui/material';
import { NotificationsNone, DoneAll } from '@mui/icons-material';
import { useNotifications, typeMeta, timeAgo } from '../contexts/NotificationsContext';

export default function NotificationBell() {
  const { items, unread, connected, markRead, markAllRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);

  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const handleItem = (n) => {
    if (!n.read) markRead(n._id);
    closeMenu();
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <Tooltip title={connected ? 'Notifications · live' : 'Notifications'}>
        <IconButton
          onClick={openMenu}
          aria-label="Notifications"
          aria-haspopup="true"
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNone fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: '92vw' } } }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Notifications
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {connected ? '● realtime' : 'refreshing'} · {unread} unread
            </Typography>
          </Box>
          {unread > 0 && (
            <Button size="small" startIcon={<DoneAll fontSize="small" />} onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications yet.
              </Typography>
            </Box>
          ) : (
            items.slice(0, 20).map((n) => {
              const meta = typeMeta(n.type);
              const Icon = meta.icon;
              return (
                <ListItemButton
                  key={n._id}
                  onClick={() => handleItem(n)}
                  sx={{ alignItems: 'flex-start', gap: 1.5, py: 1.25 }}
                >
                  <ListItemAvatar sx={{ minWidth: 0, mt: 0.25 }}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '9px',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        bgcolor: (t) => alpha(meta.tone, t.palette.mode === 'light' ? 0.14 : 0.22),
                        color: meta.tone,
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={n.read ? 600 : 800}
                          sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {n.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: '0.65rem' }}>
                          {timeAgo(n.createdAt)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ display: 'block', mt: 0.25, opacity: n.read ? 0.8 : 1, fontSize: '0.8rem' }}
                      >
                        {n.message}
                      </Typography>
                    }
                  />
                  {!n.read && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', mt: 1, flexShrink: 0 }} />
                  )}
                </ListItemButton>
              );
            })
          )}
        </Box>
        <Divider />
        <Box sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {items.length > 0 ? 'Tap to open & mark read' : ' '}
          </Typography>
          <Button
            size="small"
            onClick={() => {
              closeMenu();
              navigate('/notifications');
            }}
          >
            View all
          </Button>
        </Box>
      </Menu>
    </>
  );
}