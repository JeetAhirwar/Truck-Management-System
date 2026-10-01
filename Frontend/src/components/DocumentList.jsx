/**
 * Read-only list of one vehicle's documents, with a View button per document
 * (the viewer is the same DocumentPreview used on the Documents page).
 *
 * Used by TruckDetailsModal and DriverDetailsModal. It fetches its own data
 * when given a truckId, so the two dialogs stay in sync with the API instead
 * of trusting a count carried in from another endpoint.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DescriptionOutlined, VisibilityOutlined } from '@mui/icons-material';
import { SoftChip, toneFor } from './ui';
import DocumentPreview from './DocumentPreview';
import { listDocuments } from '../utils/vehicleDocuments';

const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];

const STATUS_TONE = {
  Valid: '#059669',
  'Expiring Soon': '#d97706',
  Expired: '#dc2626',
  'No Expiry': '#64748b',
};

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Mirrors the backend `status` virtual wording (never recalculated here). */
const daysLeftLabel = (doc) => {
  if (!doc.expiryDate) return 'No expiry';
  const days = Number(doc.daysLeft);
  if (!Number.isFinite(days)) return '';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Expires today';
  return `${days} days left`;
};

export default function DocumentList({ truckId, heading = 'Documents', emptyHint }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    if (!truckId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listDocuments(truckId);
      setDocs(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setDocs([]);
      setError(err.message || 'Could not load documents');
    } finally {
      setLoading(false);
    }
  }, [truckId]);

  useEffect(() => {
    setPreview(null);
    load();
  }, [load]);

  if (!truckId) return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading documents…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ py: 0.5 }}
        action={
          <Button color="inherit" size="small" onClick={load}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (docs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyHint || 'No documents for this vehicle yet.'}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {heading} ({docs.length})
      </Typography>
      <Stack spacing={1}>
        {docs.map((doc) => {
          const status = doc.status || 'Unknown';
          const ext = (doc.fileExt || '').toLowerCase();
          const canView = doc.hasFile && EXTS.includes(ext);
          const label = doc.displayType || doc.docType;
          return (
            <Box
              key={doc._id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: '10px 12px',
              }}
            >
              <DescriptionOutlined sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" fontWeight={600} noWrap title={label}>
                    {label}
                  </Typography>
                  <SoftChip tone={STATUS_TONE[status] || toneFor(status)} label={status} />
                  {doc.source === 'rc-suggested' && <SoftChip tone="#4f46e5" label="From RC" />}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {doc.docNumber ? `No: ${doc.docNumber}` : 'No document number'}
                  {doc.issuingAuthority ? ` · ${doc.issuingAuthority}` : ''}
                  {' · '}
                  {doc.expiryDate ? `Expires ${fmtDate(doc.expiryDate)}` : 'No expiry date'}
                  {doc.expiryDate ? ` (${daysLeftLabel(doc)})` : ''}
                </Typography>
                {!doc.hasFile && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                    Validity known from RC data — no file uploaded yet
                  </Typography>
                )}
              </Box>
              <Tooltip title={canView ? 'View file' : 'No file uploaded'}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityOutlined sx={{ fontSize: '16px !important' }} />}
                    disabled={!canView}
                    onClick={() => setPreview(doc)}
                    sx={{ flexShrink: 0 }}
                  >
                    View
                  </Button>
                </span>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>

      <DocumentPreview doc={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />
    </Box>
  );
}
