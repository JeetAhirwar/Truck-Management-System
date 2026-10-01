import {
  Avatar,
  Box,
  Button,
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
import { Close, LocalShipping, VerifiedUserRounded } from '@mui/icons-material';
import { SoftChip } from './ui';
import DocumentList from './DocumentList';

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.35 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} noWrap title={value || ''} sx={{ textAlign: 'right' }}>
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

/** Read-only truck details dialog — opened from the View button on Trucks. */
export default function TruckDetailsModal({ open, truck, onClose, onEdit }) {
  const t = truck;
  const rc = t?.rc?.fetchedAt ? t.rc : null;

  return (
    <Dialog open={Boolean(open && t)} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ borderRadius: 4, maxHeight: '90vh' }}>
      {t ? (
        <>
          <DialogTitle sx={{ p: '16px 20px !important' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '13px',
                  bgcolor: (th) => (th.palette.mode === 'light' ? '#dbeafe' : 'rgba(59,130,246,0.18)'),
                  color: 'primary.main',
                  '& svg': { fontSize: 21 },
                }}
              >
                <LocalShipping />
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" noWrap>
                    {t.truckNumber}
                  </Typography>
                  {rc && (
                    <Tooltip title={`RC verified (${rc.source || 'live'})`}>
                      <VerifiedUserRounded sx={{ fontSize: 16, color: 'success.main' }} />
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  {t.registrationNumber && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {t.registrationNumber}
                    </Typography>
                  )}
                  <SoftChip status={t.status} />
                </Stack>
              </Box>
              <Tooltip title="Close">
                <IconButton onClick={onClose} aria-label="Close truck details" size="small">
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ p: '16px 20px !important' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <Section title="Vehicle">
                <Row label="Brand & model" value={[t.brand, t.model].filter(Boolean).join(' ')} />
                <Row label="Type" value={t.truckType} />
                <Row label="Manufactured" value={t.manufacturingYear ? String(t.manufacturingYear) : ''} />
                <Row label="Fuel" value={t.fuelType} />
                <Row label="Mileage" value={t.currentMileage ? `${t.currentMileage} km/L` : ''} />
                <Row label="Tank capacity" value={t.tankCapacity ? `${t.tankCapacity} L` : ''} />
                <Row label="Load capacity" value={t.loadCapacity ? `${t.loadCapacity} T` : ''} />
                <Row label="Avg speed" value={t.avgSpeed ? `${t.avgSpeed} km/h` : ''} />
                <Row label="Odometer" value={t.currentOdometer ? `${Number(t.currentOdometer).toLocaleString('en-IN')} km` : ''} />
              </Section>

              <Section title="Driver & operations">
                <Row
                  label="Driver"
                  value={t.currentDriver ? [t.currentDriver.name, t.currentDriver.mobile].filter(Boolean).join(' · ') : ''}
                />
                <Row
                  label="FASTag"
                  value={t.fastag?.balance !== undefined ? `₹${Number(t.fastag.balance).toLocaleString('en-IN')}` : ''}
                />
                <Row label="FASTag bank" value={t.fastag?.bank} />
                <Row label="Status" value={t.status} />
                <Row label="Notes" value={t.notes} />
              </Section>
            </Box>

            <Divider sx={{ my: 2.5 }} />

            <DocumentList
              truckId={t._id}
              heading="Documents"
              emptyHint={`No documents for ${t.truckNumber} yet. Use Edit -> Vehicle Documents to add the RC, insurance, fitness, permit, tax, PUC or any custom document.`}
            />

            {rc && (
              <>
                <Divider sx={{ my: 2.5 }} />
                <Section title="RC details">
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0 20px' }}>
                    <Row label="Vehicle class" value={rc.vehicleClassDescription || rc.vehicleClass} />
                    <Row label="Registration date" value={fmtDate(rc.registrationDate)} />
                    <Row label="Colour" value={rc.color} />
                    <Row label="Body type" value={rc.bodyType} />
                    <Row label="RTO office" value={rc.rtoOffice} />
                    <Row label="Insurance" value={rc.insurance?.company} />
                    <Row label="Policy number" value={rc.insurance?.policyNumber} />
                    <Row label="Insurance valid till" value={fmtDate(rc.insurance?.validTill)} />
                    <Row label="Fitness valid till" value={fmtDate(rc.fitness?.validTill)} />
                    <Row label="PUC number" value={rc.pucc?.number} />
                    <Row label="PUC valid till" value={fmtDate(rc.pucc?.validTill)} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {`RC ${rc.source || 'live'} data · verified ${fmtDate(rc.fetchedAt) || '—'}`}
                  </Typography>
                </Section>
              </>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ p: '12px 20px !important' }}>
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
            {onEdit && (
              <Button
                variant="contained"
                onClick={() => onEdit(t)}
              >
                Edit
              </Button>
            )}
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}
