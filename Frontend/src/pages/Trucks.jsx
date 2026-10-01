import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Snackbar,
  Alert,
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
  VerifiedUserRounded,
  DescriptionOutlined,
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
import RcReviewPanel from '../components/RcReviewPanel';
import TruckDetailsModal from '../components/TruckDetailsModal';
import VehicleDocuments from '../components/VehicleDocuments';
import {
  isValidVehicleNumber,
  lookupVehicleNumber,
  normalizeVehicleNumber,
  rcErrorMessage,
} from '../utils/rcLookup';
import { createDocumentsFromRc } from '../utils/vehicleDocuments';

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

/** VTMS-managed fields the RC lookup must never overwrite. */
const MANAGED_FIELDS = ['truckNumber', 'currentMileage', 'status', 'tankCapacity', 'loadCapacity', 'avgSpeed'];

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
  const [view, setView] = useState(VIEW_LIST);
  const [sortBy, setSortBy] = useState('default');
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState(null);

  // RC verification state
  const [verifying, setVerifying] = useState(false);
  const [rcError, setRcError] = useState('');
  const [rcResult, setRcResult] = useState(null);
  // Form values before auto-fill, so "Clear verification" can restore them.
  const [preVerifyForm, setPreVerifyForm] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState({});
  const [addingDocuments, setAddingDocuments] = useState(false);
  const [existingDocs, setExistingDocs] = useState([]);

  const fetch = useCallback(
    () =>
      api
        .get('/trucks')
        .then((r) => setTrucks(r.data))
        .catch(console.error)
        .finally(() => setLoading(false)),
    []
  );
  useEffect(() => {
    fetch();
  }, [fetch]);

  const resetRcState = () => {
    setRcResult(null);
    setRcError('');
    setPreVerifyForm(null);
    setSelectedSuggestions({});
  };

  const openAdd = () => {
    setForm(empty);
    setEditId(null);
    setError('');
    resetRcState();
    setExistingDocs([]);
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
    resetRcState();
    setExistingDocs([]);
    setModal(true);
  };

  /* ---------------------------------------------------------- RC verify */
  const verifyVehicle = async ({ refresh = false } = {}) => {
    const normalized = normalizeVehicleNumber(form.registrationNumber);
    if (!normalized) {
      setRcError('Enter a vehicle registration number first, for example MP09AB1234.');
      setRcResult(null);
      return;
    }
    if (!isValidVehicleNumber(normalized)) {
      setRcError('That does not look like a valid registration number. Example: MP09AB1234');
      setRcResult(null);
      return;
    }

    setVerifying(true);
    setRcError('');
    if (!refresh) setPreVerifyForm((prev) => prev || { ...form });

    try {
      const data = await lookupVehicleNumber(normalized, { refresh });
      setRcResult(data);
      setForm((f) => {
        const s = data.suggestions || {};
        // Auto-fill only the RC-derived fields. Everything in MANAGED_FIELDS is
        // deliberately left untouched.
        const next = { ...f, registrationNumber: data.vehicleNumber || normalized };
        if (s.brand) next.brand = s.brand;
        if (s.model) next.model = s.model;
        if (s.fuelType) next.fuelType = s.fuelType;
        if (s.manufacturingYear) next.manufacturingYear = s.manufacturingYear;
        return next;
      });
      setToast({
        severity: data.source === 'mock' ? 'warning' : 'success',
        title: data.source === 'mock' ? 'Mock RC data loaded' : 'Vehicle verified',
        message:
          data.source === 'mock'
            ? 'Sample data — not live VAHAN records. Review before saving.'
            : `${data.vehicleNumber} · ${data.source}`,
      });
    } catch (err) {
      setRcError(rcErrorMessage(err));
      setRcResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const clearVerification = () => {
    if (preVerifyForm) setForm(preVerifyForm);
    setPreVerifyForm(null);
    resetRcState();
  };

  /* --------------------------------- RC-detected document suggestions */
  const rcSuggestions = useMemo(() => {
    const rc = rcResult?.rc;
    if (!rc) return [];
    const sameDay = (a, b) =>
      Boolean(a) && Boolean(b) && String(a).slice(0, 10) === String(b).slice(0, 10);
    const alreadyAdded = (docType, docNumber, expiryDate) =>
      existingDocs.some(
        (d) =>
          d.docType === docType &&
          ((docNumber && d.docNumber === docNumber) || (expiryDate && sameDay(d.expiryDate, expiryDate)))
      );

    const items = [
      { docType: 'Insurance', docNumber: rc.insurance?.policyNumber || '', expiryDate: rc.insurance?.validTill, issuingAuthority: rc.insurance?.company || '' },
      { docType: 'Fitness Certificate', docNumber: '', expiryDate: rc.fitness?.validTill, issuingAuthority: rc.rtoOffice || '' },
      { docType: 'PUC', docNumber: rc.pucc?.number || '', expiryDate: rc.pucc?.validTill, issuingAuthority: '' },
      { docType: 'Tax', docNumber: '', expiryDate: rc.tax?.validTill, issuingAuthority: rc.rtoOffice || '' },
    ];
    return items
      .filter((item) => item.expiryDate)
      .map((item) => ({ ...item, alreadyAdded: alreadyAdded(item.docType, item.docNumber, item.expiryDate) }));
  }, [rcResult, existingDocs]);

  const addSelectedDocuments = async () => {
    const items = rcSuggestions
      .filter((s) => selectedSuggestions[s.docType] && !s.alreadyAdded)
      .map(({ docType, docNumber, expiryDate, issuingAuthority }) => ({
        docType,
        docNumber: docNumber || undefined,
        expiryDate: expiryDate || undefined,
        issuingAuthority: issuingAuthority || undefined,
      }));
    if (!items.length) return;
    setAddingDocuments(true);
    try {
      const res = await createDocumentsFromRc(editId, items);
      const created = res?.created?.length || 0;
      const skipped = res?.skipped?.length || 0;
      setToast({
        severity: 'success',
        title: `${created} document${created === 1 ? '' : 's'} added`,
        message: skipped ? `${skipped} skipped (already present).` : 'Upload the files when available.',
      });
      setSelectedSuggestions({});
    } catch (err) {
      setToast({ severity: 'error', title: 'Could not add documents', message: err.message });
    } finally {
      setAddingDocuments(false);
    }
  };

  /* ----------------------------------------------------------------- save */
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    // Persist the RC reference data alongside the vehicle, when verified.
    const payload = {
      ...form,
      registrationNumber: normalizeVehicleNumber(form.registrationNumber),
      ...(rcResult?.rc ? { rc: { ...rcResult.rc, source: rcResult.source, fetchedAt: rcResult.fetchedAt } } : {}),
    };
    try {
      let saved;
      if (editId) saved = await api.put(`/trucks/${editId}`, payload);
      else saved = await api.post('/trucks', payload);
      setModal(false);
      setToast({ severity: 'success', title: editId ? 'Vehicle updated' : 'Vehicle added', message: saved?.truckNumber });
      fetch();
    } catch (err) {
      if (err.response?.status === 409 || err.response?.data?.code === 'DUPLICATE_REGISTRATION') {
        setError(err.response?.data?.error || 'This registration number is already used by another vehicle.');
      } else {
        setError(err.response?.data?.error || 'Failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete truck? Its documents will be removed too.')) return;
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
    const list = !q
      ? trucks
      : trucks.filter(
          (t) =>
            t.truckNumber?.toLowerCase().includes(q) ||
            t.registrationNumber?.toLowerCase().includes(q) ||
            t.model?.toLowerCase().includes(q) ||
            t.brand?.toLowerCase().includes(q)
        );
    if (sortBy === 'default') return list;
    const arr = [...list];
    const str = (v) => String(v || '');
    switch (sortBy) {
      case 'numAsc':
        arr.sort((a, b) => str(a.truckNumber).localeCompare(str(b.truckNumber)));
        break;
      case 'numDesc':
        arr.sort((a, b) => str(b.truckNumber).localeCompare(str(a.truckNumber)));
        break;
      case 'brand':
        arr.sort((a, b) => str(`${a.brand} ${a.model}`).localeCompare(str(`${b.brand} ${b.model}`)));
        break;
      case 'status': {
        const order = ['Available', 'On Trip', 'Maintenance', 'Inactive'];
        arr.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
        break;
      }
      case 'mileage':
        arr.sort((a, b) => (Number(b.currentMileage) || 0) - (Number(a.currentMileage) || 0));
        break;
      default:
        break;
    }
    return arr;
  }, [trucks, search, sortBy]);

  const count = (s) => trucks.filter((t) => t.status === s).length;

  const toastProps = (msg) => ({ open: Boolean(msg), autoHideDuration: 5000, onClose: () => setToast(null) });

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Trucks"
        caption="Vehicles, drivers & FASTag"
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, registration, brand, model…"
          sx={{ flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          sx={{ minWidth: 205 }}
        >
          <MenuItem value="default">Default (newest)</MenuItem>
          <MenuItem value="numAsc">Truck number (A→Z)</MenuItem>
          <MenuItem value="numDesc">Truck number (Z→A)</MenuItem>
          <MenuItem value="brand">Brand &amp; model</MenuItem>
          <MenuItem value="status">Status</MenuItem>
          <MenuItem value="mileage">Mileage (high first)</MenuItem>
        </TextField>
        <ViewToggle value={view} onChange={setView} />
      </Stack>

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
      ) : view === VIEW_LIST ? (
        <Stack spacing={1}>
          {filtered.map((t) => (
            <Card key={t._id} variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent sx={{ p: '12px 16px !important', '&:last-child': { pb: '12px !important' } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Avatar variant="rounded" sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: (th) => (th.palette.mode === 'light' ? '#dbeafe' : 'rgba(59,130,246,0.18)'), color: 'primary.main' }}>
                      <LocalShipping fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2">{t.truckNumber}</Typography>
                        {t.registrationNumber && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {t.registrationNumber}
                          </Typography>
                        )}
                        {t.rc?.fetchedAt && (
                          <Tooltip title={`RC verified (${t.rc.source || 'live'})`}>
                            <VerifiedUserRounded sx={{ fontSize: 15, color: 'success.main' }} />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {[t.brand, t.model].filter(Boolean).join(' ') || '—'}
                        {t.fuelType ? ` · ${t.fuelType}` : ''}
                        {t.currentDriver?.name ? ` · ${t.currentDriver.name}` : ''}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      icon={<DescriptionOutlined sx={{ fontSize: 15 }} />}
                      label={`Documents${t.documentCount ? ` (${t.documentCount})` : ''}`}
                      variant="outlined"
                    />
                    <SoftChip status={t.status} />
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => setViewing(t)} aria-label={`View ${t.truckNumber}`} sx={{ border: 1, borderColor: 'divider' }}>
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(t)} aria-label={`Edit ${t.truckNumber}`} sx={{ border: 1, borderColor: 'divider' }}>
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete truck">
                      <IconButton size="small" color="error" onClick={() => del(t._id)} aria-label={`Delete ${t.truckNumber}`} sx={{ border: 1, borderColor: 'divider' }}>
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
                    <Stack direction="row"   spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1.5}  sx={{alignItems: 'center',  minWidth: 0 }}>
                        <Avatar variant="rounded" sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: (th) => th.palette.mode === 'light' ? '#dbeafe' : 'rgba(59,130,246,0.18)', color: 'primary.main', '& svg': { fontSize: 22 } }}>
                          <LocalShipping />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <Typography variant="subtitle1" noWrap>
                              {t.truckNumber}
                            </Typography>
                            {t.rc?.fetchedAt && (
                              <Tooltip title={`RC verified (${t.rc.source || 'live'})`}>
                                <VerifiedUserRounded sx={{ fontSize: 15, color: 'success.main' }} />
                              </Tooltip>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {[t.brand, t.model].filter(Boolean).join(' ') || '—'}
                          </Typography>
                          {t.registrationNumber && (
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontFamily: 'monospace' }}>
                              {t.registrationNumber}
                            </Typography>
                          )}
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
                      <Stack direction="row" spacing={1}  sx={{alignItems: 'center',  mt: 1.75 }}>
                        <LocalGasStation sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">
                          FASTag ₹{Number(t.fastag.balance).toLocaleString('en-IN')}
                        </Typography>
                        {t.fastag.balance < 1000 && <SoftChip tone="#dc2626" label="Low balance" />}
                      </Stack>
                    )}

                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
                      <Chip
                        size="small"
                        icon={<DescriptionOutlined sx={{ fontSize: 15 }} />}
                        label={`Documents${t.documentCount ? ` (${t.documentCount})` : ''}`}
                        variant="outlined"
                      />
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" size="small" startIcon={<VisibilityOutlined fontSize="small" />} onClick={() => setViewing(t)} sx={{ flex: 1 }}>
                        View
                      </Button>
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
        maxWidth="md"
      >
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Vehicle Registration Number
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextField
              fullWidth
              label="Registration Number"
              placeholder="MP09AB1234"
              value={form.registrationNumber}
              onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
              slotProps={{
                htmlInput: {
                  style: { textTransform: 'uppercase', letterSpacing: '.5px' },
                },
              }}
            />
            <Button
              variant="outlined"
              startIcon={verifying ? <Refresh className="spin" /> : <VerifiedUserRounded />}
              onClick={() => verifyVehicle()}
              disabled={verifying}
              sx={{ height: 56, whiteSpace: 'nowrap' }}
            >
              {verifying ? 'Verifying…' : 'Verify Vehicle'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            Enter the RC number, then verify to auto-fill brand, model, fuel type and manufacturing year.
          </Typography>
        </Box>

        {rcResult || verifying || rcError ? (
          <RcReviewPanel
            loading={verifying}
            error={rcError}
            result={rcResult}
            suggestions={rcSuggestions}
            selectedSuggestions={selectedSuggestions}
            onToggleSuggestion={(docType) =>
              setSelectedSuggestions((prev) => ({ ...prev, [docType]: !prev[docType] }))
            }
            onAddSelected={addSelectedDocuments}
            addingDocuments={addingDocuments}
            onClear={clearVerification}
            onReverify={() => verifyVehicle({ refresh: true })}
            canAddDocuments={Boolean(editId)}
          />
        ) : null}

        <Divider />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Truck Number *" value={form.truckNumber} onChange={set('truckNumber')} required />
          <TextField label="Vehicle Type" value={form.truckType} onChange={set('truckType')} />
          <TextField label="Brand" value={form.brand} onChange={set('brand')} />
          <TextField label="Model" value={form.model} onChange={set('model')} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField label="Manufacturing Year" type="number" value={form.manufacturingYear} onChange={set('manufacturingYear')} />
          <TextField label="Mileage (km/L) *" type="number" slotProps={{ htmlInput: { step: '0.1' } }} value={form.currentMileage} onChange={set('currentMileage')} required />
          <TextField label="Fuel Type" select value={form.fuelType} onChange={set('fuelType')}>
            {['Diesel', 'CNG', 'Petrol', 'Electric'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField label="Tank Cap (L)" type="number" value={form.tankCapacity} onChange={set('tankCapacity')} />
          <TextField label="Load Cap (T)" type="number" value={form.loadCapacity} onChange={set('loadCapacity')} />
          <TextField label="Status" select value={form.status} onChange={set('status')}>
            {['Available', 'On Trip', 'Maintenance', 'Inactive'].map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </TextField>
        </Box>

        <Divider />

        <VehicleDocuments
          truckId={editId}
          truckNumber={form.truckNumber}
          onDocumentsChange={setExistingDocs}
          toast={setToast}
        />
      </FormDialog>

      <TruckDetailsModal
        open={Boolean(viewing)}
        truck={viewing ? trucks.find((t) => t._id === viewing._id) || viewing : null}
        onClose={() => setViewing(null)}
        onEdit={(t) => {
          setViewing(null);
          openEdit(t);
        }}
      />

      <Snackbar {...toastProps(toast)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast?.severity || 'info'} variant="filled" onClose={() => setToast(null)}>
          <strong>{toast?.title}</strong>
          {toast?.message ? ` · ${toast.message}` : ''}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
