/**
 * Read-only driver details dialog — opened from the View button on Drivers.
 *
 * Shows every field the Driver model holds, the current truck assignment, that
 * truck's documents (DocumentList, same viewer as the Trucks page) and the
 * assignment history recorded by POST /drivers/:id/assign.
 *
 * Fetches the driver fresh on open so history and the populated truck are
 * current rather than whatever was cached in the list.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close,
  LocalShipping,
  Person,
  VerifiedUserRounded,
} from '@mui/icons-material';
import { SoftChip } from './ui';
import { apiFetch } from '../utils/apiFetch';
import DocumentList from './DocumentList';

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DAY = 86400000;

/** "current" / "to date" plus duration in days (min 1) for a history row. */
const durationLabel = (from, to) => {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return '';
  const end = to ? new Date(to) : new Date();
  const days = Math.max(1, Math.ceil((end - start) / DAY));
  return `${days} day${days === 1 ? '' : 's'}`;
};

/** Days until expiry: negative = already expired. */
const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / DAY);
};

function Row({ label, value, color }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.35 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        color={color}
        noWrap
        title={value || ''}
        sx={{ textAlign: 'right', minWidth: 0 }}
      >
        {value || '—'}
      </Typography>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function DriverDetailsModal({ open, driver, onClose, onEdit }) {
  const d = driver;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const driverId = d?._id;

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      setDetail(await apiFetch(`/drivers/${driverId}`));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load driver');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (open) {
      setDetail(null);
      load();
    }
  }, [open, load]);

  // Fresh detail once loaded, otherwise the list row (shows immediately).
  const info = detail || d;
  const truck = info?.assignedTruck;
  const history = [...(info?.assignmentHistory || [])].reverse();
  const licenseLeft = daysUntil(info?.licenseExpiry);

  const truckTitle = truck
    ? [truck.truckNumber, truck.brand, truck.model].filter(Boolean).join(' · ')
    : '';

  return (
    <Dialog open={Boolean(open && info)} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ borderRadius: 4, maxHeight: '90vh' }}>
      {info ? (
        <>
          <DialogTitle sx={{ p: '16px 20px !important' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '13px',
                  bgcolor: (th) => (th.palette.mode === 'light' ? '#ede9fe' : 'rgba(124,58,237,0.2)'),
                  color: '#7c3aed',
                  '& svg': { fontSize: 21 },
                }}
              >
                <Person />
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" noWrap>
                    {info.name}
                  </Typography>
                  {loading && <CircularProgress size={14} />}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    {[info.mobile, info.licenseNumber].filter(Boolean).join(' · ')}
                  </Typography>
                  <SoftChip status={info.status} />
                </Stack>
              </Box>
              <Tooltip title="Close">
                <IconButton onClick={onClose} aria-label="Close driver details" size="small">
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ p: '16px 20px !important' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <Section title="Driver">
                <Row label="Mobile" value={info.mobile} />
                <Row label="Address" value={info.address} />
                <Row label="Date of birth" value={fmtDate(info.dob)} />
                <Row label="Experience" value={info.experience ? `${info.experience} yrs` : ''} />
                <Row label="Emergency contact" value={info.emergencyContact} />
                <Row label="Status" value={info.status} />
                <Row label="Notes" value={info.notes} />
                <Row label="Added on" value={fmtDate(info.createdAt)} />
              </Section>

              <Section title="Licence">
                <Row label="Licence number" value={info.licenseNumber} />
                <Row label="Licence type" value={info.licenseType} />
                <Row
                  label="Licence expiry"
                  value={
                    !info.licenseExpiry
                      ? ''
                      : `${fmtDate(info.licenseExpiry)}${
                          licenseLeft === null
                            ? ''
                            : licenseLeft < 0
                              ? ` · expired ${Math.abs(licenseLeft)} days ago`
                              : licenseLeft === 0
                                ? ' · expires today'
                                : ` · ${licenseLeft} days left`
                        }`
                  }
                  color={
                    licenseLeft === null
                      ? undefined
                      : licenseLeft < 0
                        ? 'error.main'
                        : licenseLeft <= 30
                          ? 'warning.main'
                          : undefined
                  }
                />
              </Section>
            </Box>

            <Divider sx={{ my: 2.5 }} />

            <Section title="Current assignment">
              {truck ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0 20px' }}>
                  <Row label="Truck" value={truck.truckNumber} />
                  <Row label="Brand & model" value={[truck.brand, truck.model].filter(Boolean).join(' ')} />
                  <Row label="Registration" value={truck.registrationNumber} />
                  <Row label="Truck status" value={truck.status} />
                  <Row label="Fuel" value={truck.fuelType} />
                  <Row label="Assigned since" value={fmtDate(history[0] && !history[0].releasedAt ? history[0].assignedAt : null)} />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Not assigned to any truck.
                </Typography>
              )}
            </Section>

            {truck && (
              <>
                <Divider sx={{ my: 2.5 }} />
                <Box sx={{ mb: 1.5 }}>
                  <DocumentList
                    truckId={truck._id}
                    heading="Documents of assigned truck"
                    emptyHint={`No documents for ${truck.truckNumber} yet.`}
                  />
                </Box>
              </>
            )}

            <Divider sx={{ my: 2.5 }} />

            <Section title={`Assignment history (${history.length})`}>
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No assignment history yet. It is recorded from now on every time a driver is
                  assigned to or released from a truck.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {history.map((entry, i) => {
                    const isCurrent = !entry.releasedAt;
                    const label = [entry.truckNumber, entry.truckLabel].filter(Boolean).join(' · ');
                    return (
                      <Box
                        key={i}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: '10px 12px',
                          bgcolor: isCurrent ? 'action.hover' : 'transparent',
                        }}
                      >
                        <LocalShipping sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="body2" fontWeight={600} noWrap title={label || 'Unknown truck'}>
                              {label || 'Deleted truck'}
                            </Typography>
                            <SoftChip
                              tone={isCurrent ? '#059669' : '#64748b'}
                              label={isCurrent ? 'Current' : 'Released'}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {fmtDate(entry.assignedAt)}
                            {entry.releasedAt ? ` → ${fmtDate(entry.releasedAt)}` : ' → now'}
                            {` · ${durationLabel(entry.assignedAt, entry.releasedAt)}`}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Section>
          </DialogContent>

          <Divider />

          <DialogActions sx={{ p: '12px 20px !important' }}>
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
            {onEdit && (
              <Button variant="contained" onClick={() => onEdit(info)}>
                Edit
              </Button>
            )}
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}
