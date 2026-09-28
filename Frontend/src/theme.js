import { createTheme, alpha } from '@mui/material/styles';

export const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/* Flat SaaS aesthetic (Stripe / Vercel): crisp 1px borders, zero shadows,
   neutral gray canvas. Dark mode keeps the same flat language. */
const FLAT_BORDER = '1px solid #E5E7EB';

const typography = {
  fontFamily: FONT_FAMILY,
  h1: { fontWeight: 800, fontSize: '2rem', lineHeight: 1.15, letterSpacing: '-0.03em' },
  h2: { fontWeight: 800, fontSize: '1.625rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
  h3: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.3, letterSpacing: '-0.01em' },
  /* h4 is the metric/number slot: large, bold, tight. Consumed by StatCard. */
  h4: { fontWeight: 800, fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.025em' },
  h5: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
  h6: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.4 },
  subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
  subtitle2: { fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '0.01em' },
  body1: { fontSize: '0.875rem', lineHeight: 1.65 },
  body2: { fontSize: '0.8125rem', lineHeight: 1.6 },
  button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.01em' },
  /* 12px (not 11px): 11px muted gray failed WCAG AA on white. Every
     secondary label in the app renders at >= 12px now. */
  caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.45, letterSpacing: '0.01em' },
  overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em' },
};

function buildPalette(mode) {
  const light = mode === 'light';
  return {
    mode,
    primary: {
      main: light ? '#2563eb' : '#3b82f6',
      dark: light ? '#1d4ed8' : '#2563eb',
      light: light ? '#60a5fa' : '#93c5fd',
      contrastText: '#ffffff',
    },
    secondary: {
      main: light ? '#7c3aed' : '#a78bfa',
      dark: light ? '#6d28d9' : '#7c3aed',
      light: light ? '#a78bfa' : '#c4b5fd',
      contrastText: '#ffffff',
    },
    success: { main: light ? '#059669' : '#34d399', contrastText: '#ffffff' },
    warning: { main: light ? '#d97706' : '#fbbf24', contrastText: '#ffffff' },
    error: { main: light ? '#dc2626' : '#f87171', contrastText: '#ffffff' },
    info: { main: light ? '#0284c7' : '#38bdf8', contrastText: '#ffffff' },
    background: {
      default: light ? '#F8F9FA' : '#0B0D10',
      paper: light ? '#ffffff' : '#12151A',
      nested: light ? '#F3F4F6' : '#181C22',
    },
    divider: light ? '#E5E7EB' : 'rgba(148,163,184,0.16)',
    text: {
      primary: light ? '#0f172a' : '#e2e8f0',
      secondary: light ? '#64748b' : '#94a3b8',
      disabled: light ? '#94a3b8' : '#64748b',
    },
  };
}

function buildComponents(mode) {
  const light = mode === 'light';

  return {
    MuiCssBaseline: {
      styleOverrides: {
        html: { colorScheme: mode },
        body: {
          scrollbarColor: light ? '#cbd5e1 transparent' : '#334155 transparent',
        },
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': {
          background: light ? '#cbd5e1' : '#334155',
          borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: light ? '#94a3b8' : '#475569',
          backgroundClip: 'content-box',
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          border: theme.palette.mode === 'light' ? FLAT_BORDER : `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          boxShadow: 'none !important',
        }),
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 40,
          paddingInline: 18,
          boxShadow: 'none !important',
          '&:active': { transform: 'translateY(1px)' },
        },
        containedPrimary: ({ theme }) => ({
          backgroundImage: 'none',
          boxShadow: 'none !important',
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
            boxShadow: 'none !important',
          },
        }),
        containedSecondary: ({ theme }) => ({
          backgroundImage: 'none',
          '&:hover': { backgroundColor: theme.palette.secondary.dark },
        }),
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: '0.8125rem', borderRadius: 8 },
        outlined: { borderColor: light ? '#E5E7EB' : 'rgba(148,163,184,0.28)' },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
        sizeSmall: { borderRadius: 8 },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          marginInline: 8,
          paddingBlock: 9,
          color: theme.palette.text.secondary,
          position: 'relative',
          '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.05) },
          /* Keyboard users get an unmistakable ring, not just a tint. */
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
          /* Active item: 3px left accent bar + tinted pill + primary text.
             The bar is what makes the current page readable at a glance while
             scanning a 7-item nav. */
          '&.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.main,
            fontWeight: 700,
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.18) },
            '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 22,
              borderRadius: '0 3px 3px 0',
              backgroundColor: theme.palette.primary.main,
            },
          },
        }),
      },
    },

    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 40, color: 'inherit' } },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: alpha(
            theme.palette.mode === 'light' ? '#ffffff' : theme.palette.background.paper,
            0.82
          ),
          backdropFilter: 'blur(14px) saturate(160%)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }),
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          borderRight: `1px solid ${theme.palette.divider}`,
        }),
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          backgroundColor: theme.palette.mode === 'light' ? '#ffffff' : 'transparent',
          fontSize: '0.875rem',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor:
              theme.palette.mode === 'light' ? 'rgba(15,23,42,0.16)' : 'rgba(148,163,184,0.28)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor:
              theme.palette.mode === 'light'
                ? 'rgba(37,99,235,0.5)'
                : 'rgba(59,130,246,0.6)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: theme.palette.primary.main,
          },
        }),
        input: { paddingBlock: '11px' },
      },
    },

    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '0.8125rem', fontWeight: 600 } },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, height: 26, borderRadius: 8, fontSize: '0.75rem' },
        label: { paddingInline: 10 },
        sizeSmall: { height: 22 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, padding: '6px 10px' },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontSize: '0.8125rem',
          paddingBlock: 11,
          color: theme.palette.text.primary,
        }),
        head: ({ theme }) => ({
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: theme.palette.text.secondary,
          backgroundColor: 'transparent',
          borderBottom: `1px solid ${theme.palette.divider}`,
          paddingBlock: 12,
          whiteSpace: 'nowrap',
        }),
        sizeSmall: { paddingInline: 12 },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 12, border: '1px solid rgba(0,0,0,0)' },
      },
    },

    MuiSkeleton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: '0.8125rem', alignItems: 'flex-start' },
        message: { paddingBlock: 2 },
      },
    },

    MuiMenu: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 12,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none !important',
          marginTop: 6,
          minWidth: 200,
        }),
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 12,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none !important',
        }),
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          fontSize: '1.125rem',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          padding: '20px 24px 0',
          color: theme.palette.text.primary,
        }),
      },
    },

    MuiDialogContent: {
      styleOverrides: { root: { padding: '16px 24px 8px' } },
    },

    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } },
    },

    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'medium' },
    },

    MuiFormControl: {
      defaultProps: { variant: 'outlined' },
    },
  };
}

export function createAppTheme(mode = 'light') {
  return createTheme({
    palette: buildPalette(mode),
    typography,
    shape: { borderRadius: 12 },
    breakpoints: {
      values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
    },
    components: buildComponents(mode),
  });
}
