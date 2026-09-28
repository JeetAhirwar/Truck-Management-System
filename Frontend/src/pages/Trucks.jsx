import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  DeleteOutlined,
  EditOutlined,
  Engineering,
  LocalGasStation,
  LocalShipping,
  Refresh,
  Speed,
} from '@mui/icons-material';
import api from '../utils/api';
import {
  EmptyState,
  FormDialog,
  PageHeader,
  SearchField,
  SoftChip,
  StatCard,
  StatGrid,
} from '../components/ui';

const empty = {
  truckNumber: '',
  registrationNumber: '',
  truckType: 'Truck',
  brand: '',
  model: '',
  manufacturingYear: '',
  fuelType: 'Diesel',
  tankCapacity: '',
  currentOdometer: '',
  currentMileage: '',
  avgSpeed: 50,
  loadCapacity: '',
  status: 'Available',
};

function Spec({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} noWrap title={value}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

export default function Trucks() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetch = () =>
    api
      .get('/trucks')
      .then((r) => setTrucks(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm(empty);
    setEditId(null);
    setError('');
    setModal(true);
  };
  const openEdit = (t) => {
    setForm({
      truckNumber: t.truckNumber,
      registrationNumber: t.registrationNumber || '',
      truckType: t.truckType || 'Truck',
      brand: t.brand || '',
      model: t.model || '',
      manufacturingYear: t.manufacturingYear || '',
      fuelType: t.fuelType || 'Diesel',
      tankCapacity: t.tankCapacity || '',
      currentOdometer: t.currentOdometer || '',
      currentMileage: t.currentMileage,
      avgSpeed: t.avgSpeed || 50,
      loadCapacity: t.loadCapacity || '',
      status: t.status || 'Available',
    });
    setEditId(t._id);
    setError('');
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editId) await api.put(`/trucks/${editId}`, form);
      else await api.post('/trucks', form);
      setModal(false);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete truck?')) return;
    try {
      await api.delete(`/trucks/${id}`);
      fetch();
    } catch (e) {
      console.error(e);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter(
      (t) =>
        t.truckNumber?.toLowerCase().includes(q) ||
        t.model?.toLowerCase().includes(q) ||
        t.brand?.toLowerCase().includes(q)
    );
  }, [trucks, search]);

  const count = (s) => trucks.filter((t) => t.status === s).length;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Trucks"
        subtitle={`${trucks.length} vehicle${trucks.length === 1 ? '' : 's'} in the fleet`}
        actions={
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={fetch} aria-label="Refresh trucks" sx={{ border: 1, borderColor: 'divider' }}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Add Truck
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon={LocalShipping} label="Fleet size" value={trucks.length} tone="#4f46e5" hint="Total vehicles" delay={0} />
        <StatCard icon={LocalShipping} label="Available" value={count('Available')} tone="#059669" hint="Ready to roll" delay={0.04} />
        <StatCard icon={Speed} label="On trip" value={count('On Trip')} tone="#2563eb" hint="Currently hauling" delay={0.08} />
        <StatCard
          icon={Engineering}
          label="Maintenance"
          value={count('Maintenance')}
          tone="#d97706"
          hint="In the workshop"
          delay={0.12}
          badge={count('Maintenance') > 0 ? <SoftChip tone="#d97706" label="Attention" /> : null}
        />
      </StatGrid>

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search number, brand, model…"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={LocalShipping}
          title={trucks.length === 0 ? 'No trucks in the fleet yet' : 'No trucks match your search'}
          hint={trucks.length === 0 ? 'Add your first vehicle to start tracking trips, fuel and documents.' : 'Try a different search term.'}
          action={
            trucks.length === 0 ? (
              <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
                Add Truck
              </Button>
            ) : null
          }
        />
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((t, i) => (
            <Grid item xs={12} sm={6} lg={4} key={t._id}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}
                style={{ height: '100%' }}
              >
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ p: '20px !important', '&:last-child': { pb: '20px !important' }, flex: 1 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Avatar variant="rounded" sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: (th) => th.palette.mode === 'light' ? '#dbeafe' : 'rgba(59,130,246,0.18)', color: 'primary.main', '& svg': { fontSize: 22 } }}>
                          <LocalShipping />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" noWrap>
                            {t.truckNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {[t.brand, t.model].filter(Boolean).join(' ') || '—'}
                          </Typography>
                        </Box>
                      </Stack>
                      <SoftChip status={t.status} />
                    </Stack>

                    <Box
                      sx={{
                        mt: 2,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
                        gap: 1.5,
                      }}
                    >
                      <Spec label="Mileage" value={t.currentMileage ? `${t.currentMileage} km/L` : ''} />
                      <Spec label="Fuel" value={t.fuelType} />
                      <Spec label="Capacity" value={t.loadCapacity ? `${t.loadCapacity} T` : ''} />
                      <Spec label="Driver" value={t.currentDriver?.name} />
                    </Box>

                    {t.fastag?.balance !== undefined && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.75 }}>
                        <LocalGasStation sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">
                          FASTag ₹{Number(t.fastag.balance).toLocaleString('en-IN')}
                        </Typography>
                        {t.fastag.balance < 1000 && <SoftChip tone="#dc2626" label="Low balance" />}
                      </Stack>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" startIcon={<EditOutlined fontSize="small" />} onClick={() => openEdit(t)} sx={{ flex: 1 }}>
                        Edit
                      </Button>
                      <Tooltip title="Delete truck">
                        <IconButton size="small" color="error" onClick={() => del(t._id)} aria-label={`Delete ${t.truckNumber}`} sx={{ border: 1, borderColor: 'divider' }}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      <FormDialog
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Truck' : 'Add Truck'}
        error={error}
        onSubmit={save}
        submitLabel={editId ? 'Update' : 'Add Truck'}
        saving={saving}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Truck Number *" value={form.truckNumber} onChange={set('truckNumber')} required />
          <TextField label="Registration" value={form.registrationNumber} onChange={set('registrationNumber')} />
          <TextField label="Brand" value={form.brand} onChange={set('brand')} />
          <TextField label="Model" value={form.model} onChange={set('model')} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField label="Mileage (km/L) *" type="number" inputProps={{ step: '0.1' }} value={form.currentMileage} onChange={set('currentMileage')} required />
          <TextField label="Fuel Type" select value={form.fuelType} onChange={set('fuelType')}>
            {['Diesel', 'CNG', 'Petrol'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>
          <TextField label="Status" select value={form.status} onChange={set('status')}>
            {['Available', 'On Trip', 'Maintenance', 'Inactive'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField label="Tank Cap (L)" type="number" value={form.tankCapacity} onChange={set('tankCapacity')} />
          <TextField label="Load Cap (T)" type="number" value={form.loadCapacity} onChange={set('loadCapacity')} />
          <TextField label="Avg Speed (km/h)" type="number" value={form.avgSpeed} onChange={set('avgSpeed')} />
        </Box>
      </FormDialog>
    </Stack>
  );
}
