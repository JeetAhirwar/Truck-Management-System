/**
 * RcReviewPanel — shows the result of an RC verification inside the Add/Edit
 * Truck dialog.
 *
 *  - Provenance is always visible (Mock / Live / Cache) so mock data is never
 *    mistaken for real VAHAN data.
 *  - Sensitive RTO fields (owner, chassis, engine) are masked until revealed.
 *  - Validity dates from the RC record are offered as *document suggestions*
 *    only; nothing is created until the user confirms.
 */
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutlined,
  CloseRounded,
  GppGoodOutlined,
  ReplayRounded,
  ScienceOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import { SoftChip } from './ui';

const SOURCE_META = {
  mock: { label: 'Mock data', tone: '#b45309', Icon: ScienceOutlined },
  live: { label: 'Live RC data', tone: '#059669', Icon: GppGoodOutlined },
  cache: { label: 'Cached RC data', tone: '#2563eb', Icon: CheckCircleOutlined },
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAgo = (value) => {
  if (!value) return 'Just now';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDate(value);
};

/** MP09AB1234 -> MP09••1234 ; chassis/engine keep only the last 4 visible. */
const maskValue = (value) => {
  const v = String(value ?? '');
  if (v.length <= 4) return '••••';
  return `••••${v.slice(-4)}`;
};

function Row({ label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ textAlign: 'right', minWidth: 0, wordBreak: 'break-word', fontFamily: mono ? 'monospace' : undefined }}
      >
        {value || '—'}
      </Typography>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function RcReviewPanel({
  loading,
  error,
  result,
  suggestions = [],
  selectedSuggestions,
  onToggleSuggestion,
  onAddSelected,
  addingDocuments,
  onClear,
  onReverify,
  canAddDocuments,
  onEditDocument,
}) {
  const [revealSensitive, setRevealSensitive] = useState(false);

  const meta = SOURCE_META[result?.source] || SOURCE_META.mock;
  const SourceIcon = meta.Icon;
  const rc = result?.rc || {};
  const s = result?.suggestions || {};

  /* ---------------------------------------------------------------- loading */
  if (loading) {
    return (
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          p: 2,
          bgcolor: 'background.nested',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" fontWeight={600}>
            Verifying vehicle with RC service…
          </Typography>
        </Stack>
        <Skeleton variant="rounded" height={12} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={12} width="85%" sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={12} width="70%" />
      </Box>
    );
  }

  /* ------------------------------------------------------------------ error */
  if (error && !result) {
    return (
      <Alert
        severity="error"
        sx={{ alignItems: 'flex-start' }}
        action={
          <Button type="button" color="inherit" size="small" startIcon={<ReplayRounded />} onClick={onReverify}>
            Retry
          </Button>
        }
      >
        <Typography variant="body2" fontWeight={600}>
          Verification failed
        </Typography>
        <Typography variant="caption">{error}</Typography>
      </Alert>
    );
  }

  if (!result) return null;

  /* ---------------------------------------------------------------- success */
  const duplicate = result.duplicate;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.nested' }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">RC Verification</Typography>
            <SoftChip tone={meta.tone} label={meta.label} icon={<SourceIcon sx={{ fontSize: 14 }} />} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Verified {formatAgo(result.fetchedAt)}
            {result.source === 'mock' ? ' · sample data, not live VAHAN records' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip title="Verify again">
            <IconButton size="small" onClick={onReverify} aria-label="Re-verify vehicle">
              <ReplayRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear verification">
            <IconButton size="small" onClick={onClear} aria-label="Clear verification">
              <CloseRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}

        {duplicate?.exists && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            <Typography variant="body2">
              This registration number is already used by vehicle{' '}
              <strong>{duplicate.truckNumber}</strong>. Saving may be rejected as a duplicate.
            </Typography>
          </Alert>
        )}

        <Row label="Registration Number" value={result.vehicleNumber} mono />
        <Row label="Vehicle Class" value={rc.vehicleClassDescription || rc.vehicleClass} />
        <Row label="Manufacturer" value={s.brand} />
        <Row label="Model" value={s.model} />
        <Row label="Fuel Type" value={s.fuelType} />
        <Row label="Registration Date" value={formatDate(rc.registrationDate)} />
        <Row label="Manufacturing Year" value={s.manufacturingYear ? String(s.manufacturingYear) : ''} />
        <Row label="RTO Office" value={rc.rtoOffice} />
        <Row label="RC Status" value={rc.status} />
        <Row label="Body Type" value={rc.bodyType} />
        <Row label="Emission Norm" value={rc.emissionNorm} />
        <Row label="Colour" value={rc.color} />

        <Section title="Registered owner">
          <Row label="Owner" value={revealSensitive ? rc.ownerName : rc.ownerName ? maskValue(rc.ownerName) : ''} />
          <Row
            label="Address"
            value={revealSensitive ? rc.ownerAddress : rc.ownerAddress ? maskValue(rc.ownerAddress) : ''}
          />
          <Button
            type="button"
            size="small"
            color="inherit"
            startIcon={revealSensitive ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
            onClick={() => setRevealSensitive((v) => !v)}
            sx={{ mt: 0.5 }}
          >
            {revealSensitive ? 'Hide' : 'Show'} owner details
          </Button>
        </Section>

        <Section title="Vehicle identification">
          <Row
            label="Chassis Number"
            mono
            value={revealSensitive ? rc.chassisNumber : rc.chassisNumber ? maskValue(rc.chassisNumber) : ''}
          />
          <Row
            label="Engine Number"
            mono
            value={revealSensitive ? rc.engineNumber : rc.engineNumber ? maskValue(rc.engineNumber) : ''}
          />
        </Section>

        <Section title="Validity as per RC record">
          <Row label="Insurance" value={formatDate(rc.insurance?.validTill)} />
          <Row label="Policy No" value={rc.insurance?.policyNumber} />
          <Row label="Insurer" value={rc.insurance?.company} />
          <Row label="Fitness" value={formatDate(rc.fitness?.validTill)} />
          <Row label="PUC" value={formatDate(rc.pucc?.validTill)} />
          <Row label="PUC No" value={rc.pucc?.number} />
          <Row label="Road Tax" value={formatDate(rc.tax?.validTill)} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            These dates come from the RC record only — they are not a substitute for the document files.
          </Typography>
        </Section>

        {s.mileage ? (
          <Section title="Suggested">
            <Row label="Mileage" value={`${s.mileage} km/L`} />
            <Typography variant="caption" color="text.secondary">
              Mileage is managed by VTMS and was not changed automatically.
            </Typography>
          </Section>
        ) : null}

        {suggestions.length > 0 && (
          <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2">Documents detected from RC information</Typography>
            <Typography variant="caption" color="text.secondary">
              Tick the documents you want to add. No file is created — upload the scan when you have it.
            </Typography>
            <Stack sx={{ mt: 0.5 }}>
              {suggestions.map((item) => (
                <FormControlLabel
                  key={item.docType}
                  sx={{ ml: 0, alignItems: 'center' }}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(selectedSuggestions?.[item.docType])}
                      disabled={item.alreadyAdded}
                      onChange={() => onToggleSuggestion(item.docType)}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <span>{item.docType}</span>
                      {item.docNumber && (
                        <Typography variant="caption" color="text.secondary">
                          No: {item.docNumber}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        valid until {formatDate(item.expiryDate)}
                      </Typography>
                      {item.alreadyAdded && <SoftChip tone="#64748b" label="Already added" />}
                    </Typography>
                  }
                />
              ))}
            </Stack>
            {canAddDocuments ? (
              <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  disabled={addingDocuments || !Object.values(selectedSuggestions || {}).some(Boolean)}
                  onClick={onAddSelected}
                >
                  {addingDocuments ? 'Adding…' : 'Add Selected Documents'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Permit data is not provided by the RC service.
                </Typography>
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Save this vehicle first, then reopen it to add the detected documents.
              </Typography>
            )}
          </Box>
        )}

        {onEditDocument && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            RC information is reference data. Review the values above, edit the form if needed, then save the vehicle.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
