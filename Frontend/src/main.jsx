import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import AppThemeProvider from './components/AppThemeProvider';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppThemeProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
