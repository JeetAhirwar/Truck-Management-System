/**
 * CancelTripDialog — the reason gate for cancelling a trip.
 *
 * A cancellation is a business event, so it always ships with a stored reason
 * (POST/PUT /trips refuses to cancel without one). The reason is shown in the
 * trip details and feeds the loss view on the Trips page.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Block, Close } from '@mui/icons-material';

const QUICK_REASONS = [
  'Customer cancelled',
  'Vehicle breakdown',
  'Driver unavailable',
  'No load available',
  'Weather or route blocked',
  'Other',
];

export default function CancelTripDialog({ open, trip, busy = false, error = '', onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  // Start clean every time the dialog is opened.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!trip) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= 3;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(220,38,38,0.1)',
              color: 'error.main',
            }}
          >
            <Block fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">Cancel this trip?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                {trip.tripId}
              </Box>
              {' — '}
              {trip.from} → {trip.to} · {trip.truckNumber}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            The trip stops being counted as revenue or profit — it moves to the loss view on the
            Trips page. A reason is required and is saved with the trip.
          </Typography>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Common reasons
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
              {QUICK_REASONS.map((r) => (
                <Chip
                  key={r}
                  size="small"
                  label={r}
                  color={trimmed === r ? 'error' : 'default'}
                  variant={trimmed === r ? 'filled' : 'outlined'}
                  onClick={() => setReason(r)}
                  disabled={busy}
                />
              ))}
            </Stack>
          </Box>

          <TextField
            label="Cancellation reason *"
            placeholder="e.g. Customer cancelled the load at the last minute"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={3}
            maxRows={6}
            maxLength={300}
            required
            autoFocus
            disabled={busy}
            error={Boolean(error) || (trimmed.length > 0 && !valid)}
            helperText={
              error ||
              (trimmed.length > 0 && !valid
                ? 'At least 3 characters'
                : `${trimmed.length}/300 characters`)
            }
            sx={{ mt: 0.5 }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Keep trip
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!valid || busy}
          onClick={() => onConfirm(trimmed)}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Close />}
        >
          {busy ? 'Cancelling…' : 'Yes, cancel trip'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
