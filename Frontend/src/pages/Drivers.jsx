import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  DeleteOutlined,
  EditOutlined,
  LocalShipping,
  People,
  Person,
  Refresh,
  VisibilityOutlined,
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
import ViewToggle, { VIEW_LIST } from '../components/ViewToggle';
import DriverDetailsModal from '../components/DriverDetailsModal';

const empty = {
  name: '',
  mobile: '',
  address: '',
  licenseNumber: '',
  licenseType: 'HMV',
  experience: '',
  emergencyContact: '',
  status: 'Available',
};

function Spec({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.35 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} noWrap title={value} sx={{ textAlign: 'right' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState(VIEW_LIST);
  const [sortBy, setSortBy] = useState('default');
  // Driver whose read-only details dialog is open.
  const [viewing, setViewing] = useState(null);

  const fetch = async () => {
    try {
      const [d, t] = await Promise.all([api.get('/drivers'), api.get('/trucks')]);
      setDrivers(d.data);
      setTrucks(t.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
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
  const openEdit = (d) => {
    setForm({
      name: d.name,
      mobile: d.mobile,
      address: d.address || '',
      licenseNumber: d.licenseNumber,
      licenseType: d.licenseType || 'HMV',
      experience: d.experience || '',
      emergencyContact: d.emergencyContact || '',
      status: d.status || 'Available',
    });
    setEditId(d._id);
    setError('');
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editId) await api.put(`/drivers/${editId}`, form);
      else await api.post('/drivers', form);
      setModal(false);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete driver?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      fetch();
    } catch (e) {}
  };

  const assign = async (driverId, truckId) => {
    try {
      await api.post(`/drivers/${driverId}/assign`, { truckId: truckId || null });
      fetch();
    } catch (e) {
      console.error(e);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? drivers
      : drivers.filter(
          (d) => d.name?.toLowerCase().includes(q) || d.mobile?.includes(q) || d.licenseNumber?.toLowerCase().includes(q)
        );
    if (sortBy === 'default') return list;
    const arr = [...list];
    const str = (v) => String(v || '');
    switch (sortBy) {
      case 'nameAsc':
        arr.sort((a, b) => str(a.name).localeCompare(str(b.name)));
        break;
      case 'nameDesc':
        arr.sort((a, b) => str(b.name).localeCompare(str(a.name)));
        break;
      case 'exp':
        arr.sort((a, b) => (Number(b.experience) || 0) - (Number(a.experience) || 0));
        break;
      case 'status': {
        const order = ['Available', 'On Trip', 'Inactive'];
        arr.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
        break;
      }
      default:
        break;
    }
    return arr;
  }, [drivers, search, sortBy]);

  const assigned = drivers.filter((d) => d.assignedTruck).length;

  return (
    <Stack spacing={3} sx={{ pb: 12 }}>
      <PageHeader
        title="Drivers"
        caption="Roster & truck assignments"
        subtitle={`${drivers.length} driver${drivers.length === 1 ? '' : 's'} on the roster`}
        actions={
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={fetch} aria-label="Refresh drivers" sx={{ border: 1, borderColor: 'divider' }}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Add Driver
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon={People} label="Total drivers" value={drivers.length} tone="#7c3aed" hint="On the roster" delay={0} />
        <StatCard
          icon={Person}
          label="Available"
          value={drivers.filter((d) => d.status === 'Available').length}
          tone="#059669"
          hint="Ready for assignment"
          delay={0.04}
        />
        <StatCard
          icon={LocalShipping}
          label="Assigned"
          value={assigned}
          tone="#2563eb"
          hint="Linked to a truck"
          delay={0.08}
        />
        <StatCard
          icon={Person}
          label="Unassigned"
          value={drivers.length - assigned}
          tone="#d97706"
          hint="Need a truck"
          delay={0.12}
          badge={drivers.length - assigned > 0 ? <SoftChip tone="#d97706" label="Action" /> : null}
        />
      </StatGrid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, mobile, license…"
          sx={{ flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          sx={{ minWidth: 195 }}
        >
          <MenuItem value="default">Default (newest)</MenuItem>
          <MenuItem value="nameAsc">Name (A→Z)</MenuItem>
          <MenuItem value="nameDesc">Name (Z→A)</MenuItem>
          <MenuItem value="exp">Experience (high first)</MenuItem>
          <MenuItem value="status">Status</MenuItem>
        </TextField>
        <ViewToggle value={view} onChange={setView} />
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          icon={People}
          title={drivers.length === 0 ? 'No drivers on the roster yet' : 'No drivers match your search'}
          hint={drivers.length === 0 ? 'Add your first driver, then assign them a truck.' : 'Try a different search term.'}
          action={
            drivers.length === 0 ? (
              <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
                Add Driver
              </Button>
            ) : null
          }
        />
      ) : view === VIEW_LIST ? (
        <Stack spacing={1}>
          {filtered.map((d) => (
            <Card key={d._id} variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent sx={{ p: '12px 16px !important', '&:last-child': { pb: '12px !important' } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: '12px',
                        bgcolor: (th) => (th.palette.mode === 'light' ? '#ede9fe' : 'rgba(124,58,237,0.2)'),
                        color: '#7c3aed',
                      }}
                    >
                      <Person fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2">{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.mobile}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {[d.licenseNumber, d.licenseType].filter(Boolean).join(' · ')}
                        {d.experience ? ` · ${d.experience} yrs` : ''}
                        {` · ${d.assignedTruck?.truckNumber || 'Unassigned'}`}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <SoftChip status={d.status} />
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                      <InputLabel id={`assign-list-${d._id}`}>Assign truck</InputLabel>
                      <Select
                        labelId={`assign-list-${d._id}`}
                        label="Assign truck"
                        value={d.assignedTruck?._id || ''}
                        onChange={(e) => assign(d._id, e.target.value)}
                      >
                        <MenuItem value="">
                          <em>Unassign</em>
                        </MenuItem>
                        {trucks.map((t) => (
                          <MenuItem key={t._id} value={t._id}>
                            {t.truckNumber}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => setViewing(d)} aria-label={`View ${d.name}`} sx={{ border: 1, borderColor: 'divider' }}>
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(d)} aria-label={`Edit ${d.name}`} sx={{ border: 1, borderColor: 'divider' }}>
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete driver">
                      <IconButton size="small" color="error" onClick={() => del(d._id)} aria-label={`Delete ${d.name}`} sx={{ border: 1, borderColor: 'divider' }}>
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((d, i) => (
            <Grid item xs={12} sm={6} lg={4} key={d._id}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}
                style={{ height: '100%' }}
              >
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ p: '20px !important', '&:last-child': { pb: '20px !important' }, flex: 1 }}>
                    <Stack direction="row"   spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1.5}  sx={{alignItems: 'center',  minWidth: 0 }}>
                        <Avatar variant="rounded" sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: (th) => th.palette.mode === 'light' ? '#ede9fe' : 'rgba(124,58,237,0.2)', color: '#7c3aed', '& svg': { fontSize: 22 } }}>
                          <Person />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" noWrap>
                            {d.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {d.mobile}
                          </Typography>
                        </Box>
                      </Stack>
                      <SoftChip status={d.status} />
                    </Stack>

                    <Box sx={{ mt: 2 }}>
                      <Spec label="License" value={d.licenseNumber} />
                      <Spec label="Experience" value={d.experience ? `${d.experience} yrs` : ''} />
                      <Spec
                        label="Truck"
                        value={d.assignedTruck?.truckNumber || 'Unassigned'}
                      />
                    </Box>

                    <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                      <InputLabel id={`assign-${d._id}`}>Assign truck</InputLabel>
                      <Select
                        labelId={`assign-${d._id}`}
                        label="Assign truck"
                        value={d.assignedTruck?._id || ''}
                        onChange={(e) => assign(d._id, e.target.value)}
                      >
                        <MenuItem value="">
                          <em>Unassign</em>
                        </MenuItem>
                        {trucks.map((t) => (
                          <MenuItem key={t._id} value={t._id}>
                            {t.truckNumber}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" startIcon={<VisibilityOutlined fontSize="small" />} onClick={() => setViewing(d)} sx={{ flex: 1 }}>
                        View
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<EditOutlined fontSize="small" />} onClick={() => openEdit(d)} sx={{ flex: 1 }}>
                        Edit
                      </Button>
                      <Tooltip title="Delete driver">
                        <IconButton size="small" color="error" onClick={() => del(d._id)} aria-label={`Delete ${d.name}`} sx={{ border: 1, borderColor: 'divider' }}>
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
        title={editId ? 'Edit Driver' : 'Add Driver'}
        error={error}
        onSubmit={save}
        submitLabel={editId ? 'Update' : 'Add Driver'}
        saving={saving}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Name *" value={form.name} onChange={set('name')} required />
          <TextField label="Mobile *" value={form.mobile} onChange={set('mobile')} required />
        </Box>
        <TextField label="License Number *" value={form.licenseNumber} onChange={set('licenseNumber')} required />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="License Type" value={form.licenseType} onChange={set('licenseType')} />
          <TextField label="Experience (yrs)" type="number" value={form.experience} onChange={set('experience')} />
        </Box>
        <TextField label="Emergency Contact" value={form.emergencyContact} onChange={set('emergencyContact')} />
      </FormDialog>

      <DriverDetailsModal
        open={Boolean(viewing)}
        driver={viewing ? drivers.find((x) => x._id === viewing._id) || viewing : null}
        onClose={() => setViewing(null)}
        onEdit={(d) => {
          setViewing(null);
          openEdit(d);
        }}
      />
    </Stack>
  );
}
