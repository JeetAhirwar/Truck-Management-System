import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { DoneAll, EditNote } from '@mui/icons-material';

/* ------------------------------------------------------------------ */
/* CompleteTripDialog — the "mark as completed" gate.                  */
/*                                                                     */
/* Completing straight from the trip list froze every number at the    */
/* quote, so we always ask first: update the trip on the calculator,   */
/* or close it exactly as it was started.                              */
/* ------------------------------------------------------------------ */
export default function CompleteTripDialog({
  open,
  trip,
  busy = false,
  busyAction = '',
  onClose,
  onUpdate,
  onCompleteNow,
}) {
  if (!trip) return null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6">Complete this trip?</Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          Do you want to update trip{' '}
          <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>
            {trip.tripId}
          </Box>{' '}
          first?
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Yes</strong> — opens the trip calculator pre-filled with this trip so
            you can correct the distance, revenue and expenses, then save it as
            completed.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Complete now</strong> — closes the trip right away with the exact
            data it was started with. Nothing is changed.
          </Typography>
        </Stack>
        <Divider sx={{ mt: 2 }} />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={onUpdate}
          variant="outlined"
          disabled={busy}
          startIcon={
            busy && busyAction === 'update' ? (
              <CircularProgress size={16} />
            ) : (
              <EditNote />
            )
          }
        >
          Yes, update trip
        </Button>
        <Button
          onClick={onCompleteNow}
          variant="contained"
          color="success"
          disabled={busy}
          startIcon={
            busy && busyAction === 'complete' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DoneAll />
            )
          }
        >
          Complete now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
