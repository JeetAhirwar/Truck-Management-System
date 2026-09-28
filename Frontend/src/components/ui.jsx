/**
 * Global design-language kit — the single source of truth for the SaaS look.
 *
 *   <StatCard icon label value hint tone badge />   KPI / stat cards
 *   <SoftChip status="On Trip" />                   pastel status chips
 *   <PageHeader title subtitle actions />           page top row
 *   <EmptyState icon title hint action />           intentional empty states
 *   <SearchField />                                 consistent search input
 *   <FormDialog />                                  add/edit modal shell
 *   <StatGrid>                                      responsive stat-card grid
 */
import { motion } from 'framer-motion';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, lighten } from '@mui/material/styles';
import { Close, Search } from '@mui/icons-material';

/* ------------------------------------------------------------------ */
/* Status -> tone map. Every status string used across the app lives   */
/* here so chips stay consistent no matter which page renders them.    */
/* ------------------------------------------------------------------ */
export const STATUS_TONES = {
  // trucks / drivers
  Available: '#059669',
  'On Trip': '#2563eb',
  'On-Trip': '#2563eb',
  Maintenance: '#d97706',
  Inactive: '#64748b',
  Unassigned: '#64748b',
  Assigned: '#0284c7',
  // trips
  Planned: '#64748b',
  Started: '#2563eb',
  'In Transit': '#2563eb',
  'In Progress': '#2563eb',
  Reached: '#d97706',
  Completed: '#059669',
  Cancelled: '#dc2626',
  // documents
  Valid: '#059669',
  'Expiring Soon': '#d97706',
  Expired: '#dc2626',
  // finance
  Profit: '#059669',
  Loss: '#dc2626',
  // generic
  Active: '#059669',
  Success: '#059669',
  Warning: '#d97706',
  Error: '#dc2626',
  Info: '#0284c7',
  Default: '#64748b',
};

export const toneFor = (status) => STATUS_TONES[status] || STATUS_TONES.Default;

/* Flat-design pastel pairs: solid light background + matching dark text.
   Used in light mode so chips look Stripe-clean instead of translucent. */
const PASTEL = {
  '#dc2626': { bg: '#FEE2E2', fg: '#991B1B' },
  '#2563eb': { bg: '#DBEAFE', fg: '#1E40AF' },
  '#059669': { bg: '#D1FAE5', fg: '#065F46' },
  '#d97706': { bg: '#FEF3C7', fg: '#92400E' },
  '#ea580c': { bg: '#FFEDD5', fg: '#9A3412' },
  '#0284c7': { bg: '#E0F2FE', fg: '#0C4A6E' },
  '#4f46e5': { bg: '#E0E7FF', fg: '#3730A3' },
  '#7c3aed': { bg: '#EDE9FE', fg: '#5B21B6' },
  '#64748b': { bg: '#F1F5F9', fg: '#475569' },
};

const pastelFor = (hex) => PASTEL[hex] || { bg: '#F1F5F9', fg: '#475569' };

/* ------------------------------------------------------------------ */
/* SoftChip — pastel filled chip, bold small text, never harsh.        */
/* Give it a `status` (auto tone), a raw `tone` hex, or an MUI palette */
/* `color` name. Light mode uses solid pastel pairs; dark mode keeps   */
/* the translucent treatment so text stays readable.                   */
/* ------------------------------------------------------------------ */
export function SoftChip({ status, tone, color, label, children, sx, ...props }) {
  return (
    <Chip
      size="small"
      label={label ?? children ?? status}
      {...props}
      sx={(theme) => {
        const base =
          tone ||
          (status ? toneFor(status) : null) ||
          (color ? theme.palette[color]?.main || toneFor('Default') : toneFor('Default'));
        const light = theme.palette.mode === 'light';
        const pair = pastelFor(base);
        return {
          bgcolor: light ? pair.bg : alpha(base, 0.18),
          color: light ? pair.fg : lighten(base, 0.35),
          fontWeight: 700,
          height: 24,
          borderRadius: 2,
          fontSize: '0.75rem',
          ...sx,
        };
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* StatCard — default: muted title left + soft icon right on top;      */
/* large bold metric in the middle; hint / chips at the bottom.        */
/* layout="stacked": icon box top-left, metric, muted subtitle — the   */
/* flat KPI look. `cardSx` tints the card (e.g. soft alert cards).     */
/* ------------------------------------------------------------------ */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  hintColor,
  tone = '#2563eb',
  valueColor,
  badge,
  footer,
  delay = 0,
  layout = 'row',
  cardSx,
}) {
  const iconBox = (
    <Avatar
      variant="rounded"
      sx={{
        width: 40,
        height: 40,
        borderRadius: '10px',
        bgcolor: (t) => (t.palette.mode === 'light' ? pastelFor(tone).bg : alpha(tone, 0.2)),
        color: (t) => (t.palette.mode === 'light' ? pastelFor(tone).fg : lighten(tone, 0.3)),
        '& svg': { fontSize: 20 },
      }}
    >
      <Icon />
    </Avatar>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ height: '100%' }}
    >
      <Card sx={{ height: '100%', ...cardSx }}>
        <CardContent
          sx={{ p: '20px !important', '&:last-child': { pb: '20px !important' }, height: '100%' }}
        >
          {layout === 'stacked' ? (
            <>
              {iconBox}
              <Typography variant="h4" noWrap sx={{ mt: 2, fontWeight: 'bold', ...(valueColor && { color: valueColor }) }}>
                {value}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {label}
              </Typography>
              {(hint || badge || footer) && (
                <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {hint && (
                    <Typography
                      variant="caption"
                      /* text.secondary (#64748b) = 4.6:1 on white. The old
                         text.disabled (#94a3b8) was 2.6:1 and failed AA. */
                      sx={{ color: hintColor || 'text.secondary', fontWeight: 500 }}
                    >
                      {hint}
                    </Typography>
                  )}
                  {badge}
                  {footer}
                </Box>
              )}
            </>
          ) : (
            <>
              <Stack direction="row"   spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 0.5 }}>
                  {label}
                </Typography>
                {iconBox}
              </Stack>

              <Typography variant="h4" noWrap sx={{ mt: 1.5, ...(valueColor && { color: valueColor }) }}>
                {value}
              </Typography>

              <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {hint && (
                  <Typography
                    variant="caption"
                    sx={{ color: hintColor || 'text.secondary', fontWeight: 500 }}
                  >
                    {hint}
                  </Typography>
                )}
                {badge}
                {footer}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* StatGrid — responsive grid for stat cards (2 cols mobile, 4 desktop) */
/* ------------------------------------------------------------------ */
export function StatGrid({ children, sx }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1.5, sm: 2.5 },
        gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader — title + muted subtitle left, actions right.             */
/* ------------------------------------------------------------------ */
export function PageHeader({ title, subtitle, caption, actions }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      
      
      spacing={2}
     sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h2">{title}</Typography>
        {caption && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {caption}
          </Typography>
        )}
        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: caption ? 0.2 : 0.5 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1.5}  sx={{alignItems: 'center',  flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState — dashed, muted, intentional. Never a blank white card.   */
/* ------------------------------------------------------------------ */
export function EmptyState({ icon: Icon, title, hint, action, height = 220 }) {
  return (
    <Box
      sx={{
        minHeight: height,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.nested',
        px: 3,
        py: 4,
      }}
    >
      <Box>
        {Icon && <Icon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.25 }} />}
        <Typography variant="subtitle1">{title}</Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 380, mx: 'auto' }}>
            {hint}
          </Typography>
        )}
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* SearchField — the one search input style used on every list page.    */
/* ------------------------------------------------------------------ */
export function SearchField({ sx, ...props }) {
  return (
    <TextField
      size="small"
      {...props}
      sx={{ minWidth: { xs: '100%', sm: 260 }, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* FormDialog — add/edit modal shell: title + close, error alert,       */
/* scrollable content, Cancel + submit actions.                         */
/* ------------------------------------------------------------------ */
export function FormDialog({
  open,
  onClose,
  title,
  error,
  onSubmit,
  submitLabel = 'Save',
  saving = false,
  children,
  maxWidth = 'sm',
  formId = 'form-dialog-form',
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>
        <Stack direction="row"   sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{title}</span>
          <IconButton onClick={onClose} size="small" aria-label="Close dialog">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" id={formId} onSubmit={onSubmit} sx={{ display: 'grid', gap: 2, pt: 1 }}>
          {children}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button form={formId} type="submit" variant="contained" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
