import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Functions,
  LocalGasStation,
  Save,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import api from '../utils/api';
import { PageHeader } from '../components/ui';

const FORMULAS = [
  'Fuel Required = Distance ÷ Mileage',
  'Fuel Cost = Fuel Required × Fuel Price',
  'Travel Time = Distance ÷ Avg Speed',
  'Total Expense = Fuel + Toll + Driver + Other',
  'Profit % = (Revenue − Total Expense) ÷ Revenue × 100',
];

export default function Settings() {
  const [form, setForm] = useState({
    dieselPrice: 92,
    cngPrice: 75,
    petrolPrice: 105,
    defaultDriverExpense: 2500,
    defaultOtherExpense: 500,
    defaultAvgSpeed: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings')
      .then((r) => setForm(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const r = await api.put('/settings', form);
      setForm(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <PageHeader title="Settings" subtitle="Fuel prices & default costs for calculations" />
        <Card>
          <CardContent sx={{ p: '24px !important' }}>
            <Typography variant="body2" color="text.secondary">
              Loading settings…
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <PageHeader title="Settings" subtitle="Fuel prices & default costs for calculations" />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent sx={{ p: '24px !important', '&:last-child': { pb: '24px !important' } }}>
            <Stack direction="row" spacing={1.25}  sx={{alignItems: 'center',  mb: 2.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (t) => (t.palette.mode === 'light' ? '#ede9fe' : 'rgba(124,58,237,0.2)'),
                  color: '#7c3aed',
                }}
              >
                <SettingsIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6">Calculation defaults</Typography>
                <Typography variant="caption" color="text.secondary">
                  Used by the Trip Calculator for every estimate
                </Typography>
              </Box>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {saved && (
              <Alert severity="success" icon={<CheckCircle fontSize="small" />} sx={{ mb: 2 }}>
                Settings saved.
              </Alert>
            )}

            <Box component="form" onSubmit={save} sx={{ display: 'grid', gap: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                <TextField label="Diesel ₹/L" type="number" slotProps={{ htmlInput: { step: '0.01' } }} value={form.dieselPrice} onChange={set('dieselPrice')} />
                <TextField label="CNG ₹/kg" type="number" slotProps={{ htmlInput: { step: '0.01' } }} value={form.cngPrice} onChange={set('cngPrice')} />
                <TextField label="Petrol ₹/L" type="number" slotProps={{ htmlInput: { step: '0.01' } }} value={form.petrolPrice} onChange={set('petrolPrice')} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField label="Default Driver Expense ₹" type="number" value={form.defaultDriverExpense} onChange={set('defaultDriverExpense')} />
                <TextField label="Default Other Expense ₹" type="number" value={form.defaultOtherExpense} onChange={set('defaultOtherExpense')} />
              </Box>
              <TextField label="Default Avg Speed (km/h)" type="number" value={form.defaultAvgSpeed} onChange={set('defaultAvgSpeed')} sx={{ maxWidth: 280 }} />

              <Box>
                <Button type="submit" variant="contained" startIcon={<Save fontSize="small" />} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card sx={{ borderStyle: 'dashed', bgcolor: 'background.nested' }}>
          <CardContent sx={{ p: '20px 24px !important', '&:last-child': { pb: '20px !important' } }}>
            <Stack direction="row" spacing={1}  sx={{alignItems: 'center',  mb: 1.5 }}>
              <Functions sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary">
                Calculation Formulas (Backend Engine)
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            <Box
              component="ul"
              sx={{
                m: 0,
                pl: 0,
                listStyle: 'none',
                display: 'grid',
                gap: 0.75,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '0.75rem',
                color: 'text.secondary',
              }}
            >
              {FORMULAS.map((f) => (
                <li key={f}>
                  <Stack direction="row" spacing={1}  sx={{ alignItems: 'center' }}>
                    <LocalGasStation sx={{ fontSize: 13, color: 'text.disabled' }} />
                    <span>{f}</span>
                  </Stack>
                </li>
              ))}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Stack>
  );
}
