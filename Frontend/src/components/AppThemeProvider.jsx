import { useMemo } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { createAppTheme } from '../theme';
import { useTheme } from '../hooks/useTheme';

export default function AppThemeProvider({ children }) {
  const { dark } = useTheme();
  const theme = useMemo(() => createAppTheme(dark ? 'dark' : 'light'), [dark]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
