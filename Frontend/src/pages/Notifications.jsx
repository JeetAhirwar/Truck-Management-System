import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
} from '@mui/material';
import { DoneAll, NotificationsNone } from '@mui/icons-material';
import { PageHeader } from '../components/ui';
import { useNotifications, typeMeta, timeAgo } from '../contexts/NotificationsContext';

const TONE = {
  red: '#dc2626',
  amber: '#d97706',
  orange: '#ea580c',
  blue: '#2563eb',
  green: '#059669',
  sky: '#0284c7',
};

const severityTone = (severity) =>
  severity === 'critical' ? TONE.red : severity === 'warning' ? TONE.amber : TONE.blue;

export default function Notifications() {
  const { items, unread, connected, refresh, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    const list = filter === 'unread' ? items.filter((n) => !n.read) : items;
    return list;
  }, [items, filter]);

  const handleOpen = (n) => {
    if (!n.read) markRead(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <Box sx={{ display: 'grid', gap: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread · latest ${items.length} shown`}
        caption={connected ? 'Live updates appear here instantly.' : 'Updates refresh every minute.'}
        actions={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<NotificationsNone fontSize="small" />}
              onClick={refresh}
            >
              Refresh
            </Button>
            {unread > 0 && (
              <Button variant="contained" size="small" startIcon={<DoneAll fontSize="small" />} onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </Stack>
        }
      />

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}
          >
            <Tabs
              value={filter}
              onChange={(e, v) => setFilter(v)}
              aria-label="Notification filter"
              sx={{ minHeight: 36 }}
            >
              <Tab value="all" label="All" sx={{ minHeight: 36, minWidth: 64 }} />
              <Tab value="unread" label={`Unread${unread > 0 ? ` (${unread})` : ''}`} sx={{ minHeight: 36, minWidth: 64 }} />
            </Tabs>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: connected ? 'success.main' : 'text.disabled',
                  boxShadow: connected ? (t) => `0 0 0 4px ${alpha(t.palette.success.main, 0.18)}` : 'none',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {connected ? 'Realtime connected' : 'Refreshing periodically'}
              </Typography>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 1 }} />

          {visible.length === 0 ? (
            <Stack sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
              <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="subtitle1">You're all caught up</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet — alerts will appear here as they happen.'}
              </Typography>
            </Stack>
          ) : (
            <Box sx={{ display: 'grid' }}>
              {visible.map((n, i) => {
                const meta = typeMeta(n.type);
                const Icon = meta.icon;
                const tone = severityTone(n.severity);
                return (
                  <Box key={n._id}>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpen(n)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleOpen(n);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: { xs: 1.25, sm: 2 },
                        px: { xs: 0.5, sm: 1 },
                        py: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        bgcolor: !n.read ? (t) => alpha(t.palette.primary.main, 0.05) : 'transparent',
                        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.12 : 0.2) },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '10px',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          bgcolor: (t) => alpha(meta.tone, t.palette.mode === 'light' ? 0.14 : 0.22),
                          color: meta.tone,
                        }}
                      >
                        <Icon sx={{ fontSize: 20 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                          <Typography variant="body1" fontWeight={n.read ? 600 : 800} noWrap>
                            {n.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {timeAgo(n.createdAt)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {n.message}
                        </Typography>
                        {n.link && (
                          <Typography
                            variant="caption"
                            sx={{ mt: 0.5, display: 'inline-block', color: 'primary.main', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            Open {meta.label.toLowerCase()} →
                          </Typography>
                        )}
                      </Box>
                      {!n.read && (
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: tone, mt: 1.5, flexShrink: 0 }} />
                      )}
                    </Box>
                    {i < visible.length - 1 && <Divider sx={{ mx: { xs: 0.5, sm: 1 } }} />}
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}