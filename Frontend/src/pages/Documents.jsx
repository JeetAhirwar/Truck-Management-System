import { useEffect, useMemo, useState } from 'react';
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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Close,
  DeleteOutlined,
  Description,
  EditOutlined,
  EventBusy,
  PictureAsPdf,
  Refresh,
  VerifiedUser,
  VisibilityOutlined,
  WarningAmber,
} from '@mui/icons-material';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import api from '../utils/api';
import DocumentDropzone from '../components/DocumentDropzone';
import DocumentPreview from '../components/DocumentPreview';
import ViewToggle, { VIEW_LIST } from '../components/ViewToggle';
import { getDocumentTypes } from '../utils/vehicleDocuments';
import {
  EmptyState,
  PageHeader,
  SearchField,
  SoftChip,
  StatCard,
  StatGrid,
} from '../components/ui';

const empty = {
  truck: '',
  truckNumber: '',
  docType: 'Insurance',
  customLabel: '',
  issuingAuthority: '',
  docNumber: '',
  issueDate: '',
  expiryDate: '',
  remarks: '',
};
const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const FILTERS = ['all', 'Valid', 'Expiring Soon', 'Expired', 'No Expiry'];

function Spec({ label, children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.35 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ textAlign: 'right', minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [types, setTypes] = useState([]);
  const [expiryRequired, setExpiryRequired] = useState([]);
  const [view, setView] = useState(VIEW_LIST);
  const [sortBy, setSortBy] = useState('default');

  const fetch = async () => {
    try {
      const [d, t] = await Promise.all([api.get('/documents'), api.get('/trucks')]);
      setDocs(d.data);
      setTrucks(t.data);
    } catch (e) {} finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Document types come from the backend so the enum stays the single source
  // of truth; the helper falls back to a static list if the call fails.
  useEffect(() => {
    getDocumentTypes().then(({ types: t, expiryRequired: x }) => {
      setTypes(t);
      setExpiryRequired(x);
    });
  }, []);

  const needsExpiry = expiryRequired.includes(form.docType);
  const isCustom = form.docType === 'Other';

  const closeForm = () => {
    setModal(false);
    setFile(null);
    setEditing(null);
    setEditId(null);
    setError('');
  };

  const openAdd = () => {
    setForm(empty);
    setEditId(null);
    setEditing(null);
    setFile(null);
    setError('');
    setModal(true);
  };

  const openEdit = (d) => {
    setForm({
      truck: d.truck?._id || d.truck,
      truckNumber: d.truckNumber,
      docType: d.docType,
      customLabel: d.customLabel || '',
      issuingAuthority: d.issuingAuthority || '',
      docNumber: d.docNumber || '',
      issueDate: d.issueDate ? String(d.issueDate).slice(0, 10) : '',
      expiryDate: d.expiryDate ? String(d.expiryDate).slice(0, 10) : '',
      remarks: d.remarks || '',
    });
    setEditId(d._id);
    setEditing(d);
    setFile(null);
    setError('');
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (isCustom && !form.customLabel.trim()) {
      setError('Please enter a document name for the "Other" type');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const truck = trucks.find((t) => t._id === form.truck);
      // FormData is required for the multipart upload. Axios appends the
      // boundary itself, so Content-Type must NOT be set manually.
      const fd = new FormData();
      fd.append('truck', form.truck);
      fd.append('truckNumber', truck?.truckNumber || form.truckNumber || '');
      fd.append('docType', form.docType);
      if (form.customLabel) fd.append('customLabel', form.customLabel);
      if (form.issuingAuthority) fd.append('issuingAuthority', form.issuingAuthority);
      fd.append('docNumber', form.docNumber || '');
      fd.append('issueDate', form.issueDate || '');
      fd.append('expiryDate', form.expiryDate || '');
      fd.append('remarks', form.remarks || '');
      if (file) fd.append('file', file);

      if (editId) await api.put(`/documents/${editId}`, fd);
      else await api.post('/documents', fd);
      closeForm();
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const del = async (d) => {
    if (!window.confirm(`Delete ${d.displayType || d.docType} for ${d.truckNumber}? The stored file will be removed too.`)) return;
    try {
      await api.delete(`/documents/${d._id}`);
      fetch();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = docs.filter((d) => {
      const match =
        (d.truckNumber || '').toLowerCase().includes(q) ||
        (d.docType || '').toLowerCase().includes(q) ||
        (d.customLabel || '').toLowerCase().includes(q) ||
        (d.issuingAuthority || '').toLowerCase().includes(q) ||
        (d.docNumber || '').toLowerCase().includes(q);
      if (filter === 'all') return match;
      return match && d.status === filter;
    });
    if (sortBy === 'default') return list;
    const arr = [...list];
    const str = (v) => String(v || '');
    const expiry = (d) => (d.expiryDate ? new Date(d.expiryDate).getTime() : Number.MAX_SAFE_INTEGER);
    switch (sortBy) {
      case 'expiryAsc':
        arr.sort((a, b) => expiry(a) - expiry(b));
        break;
      case 'expiryDesc':
        arr.sort((a, b) => expiry(b) - expiry(a));
        break;
      case 'type':
        arr.sort((a, b) => str(a.displayType || a.docType).localeCompare(str(b.displayType || b.docType)));
        break;
      case 'truck':
        arr.sort((a, b) => str(a.truckNumber).localeCompare(str(b.truckNumber)));
        break;
      case 'newest':
        arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      default:
        break;
    }
    return arr;
  }, [docs, search, filter, sortBy]);

  const count = (s) => docs.filter((d) => d.status === s).length;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Documents"
        subtitle="RC, Insurance, PUC, Fitness & more"
        actions={
          <>
            <Tooltip title="Refresh">
              <IconButton onClick={fetch} aria-label="Refresh documents" sx={{ border: 1, borderColor: 'divider' }}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Add Document
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard icon={VerifiedUser} label="Valid" value={count('Valid')} tone="#059669" hint="In compliance" delay={0} />
        <StatCard
          icon={WarningAmber}
          label="Expiring soon"
          value={count('Expiring Soon')}
          tone="#d97706"
          hint="Within 30 days"
          delay={0.04}
        />
        <StatCard
          icon={EventBusy}
          label="Expired"
          value={count('Expired')}
          tone="#dc2626"
          hint="Needs renewal"
          delay={0.08}
          badge={count('Expired') > 0 ? <SoftChip tone="#dc2626" label="Action needed" /> : null}
        />
        <StatCard
          icon={PictureAsPdf}
          label="With file"
          value={docs.filter((d) => d.hasFile).length}
          tone="#4f46e5"
          hint={`of ${docs.length} documents`}
          delay={0.12}
        />
      </StatGrid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}  sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search truck, type or number…"
          sx={{ flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          sx={{ minWidth: 215 }}
        >
          <MenuItem value="default">Default (expiry first)</MenuItem>
          <MenuItem value="expiryAsc">Expiry (soonest first)</MenuItem>
          <MenuItem value="expiryDesc">Expiry (latest first)</MenuItem>
          <MenuItem value="type">Document type (A→Z)</MenuItem>
          <MenuItem value="truck">Truck number (A→Z)</MenuItem>
          <MenuItem value="newest">Recently added</MenuItem>
        </TextField>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f === 'all' ? `All (${docs.length})` : f}
              color={filter === f ? 'primary' : 'default'}
              variant={filter === f ? 'filled' : 'outlined'}
              onClick={() => setFilter(f)}
              size="small"
            />
          ))}
        </Stack>
        <ViewToggle value={view} onChange={setView} />
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Description}
          title={docs.length === 0 ? 'No documents found' : 'No documents match your search'}
          hint={
            docs.length === 0
              ? 'Upload RC, insurance or PUC scans so expiry alerts can watch them for you.'
              : 'Try a different search term or status filter.'
          }
          action={
            docs.length === 0 ? (
              <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
                Add Document
              </Button>
            ) : null
          }
        />
      ) : view === VIEW_LIST ? (
        <Stack spacing={1}>
          {filtered.map((d) => {
            const ext = (d.fileExt || '').toLowerCase();
            const canPreview = d.hasFile && EXTS.includes(ext);
            return (
              <Card key={d._id} variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: '12px 16px !important', '&:last-child': { pb: '12px !important' } }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Avatar variant="rounded" sx={{ width: 38, height: 38, borderRadius: '12px', bgcolor: '#ede9fe', color: '#7c3aed' }}>
                        <Description fontSize="small" />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" noWrap>
                            {d.displayType || d.docType}
                          </Typography>
                          <SoftChip status={d.status} />
                          {d.source === 'rc-suggested' && <SoftChip tone="#4f46e5" label="From RC" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {d.truckNumber}
                          {d.docNumber ? ` · No: ${d.docNumber}` : ''}
                          {d.issuingAuthority ? ` · ${d.issuingAuthority}` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.expiryDate
                            ? `Expires ${new Date(d.expiryDate).toLocaleDateString()}`
                            : 'No expiry date'}
                          {d.hasFile ? ` · ${(ext || 'file').toUpperCase()}` : ' · no file'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityOutlined fontSize="small" />}
                        onClick={() => setPreview(d)}
                        disabled={!canPreview}
                      >
                        View
                      </Button>
                      <Tooltip title="Edit document">
                        <IconButton size="small" onClick={() => openEdit(d)} aria-label={`Edit ${d.displayType || d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete document">
                        <IconButton size="small" color="error" onClick={() => del(d)} aria-label={`Delete ${d.displayType || d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((d, i) => {
            const ext = (d.fileExt || '').toLowerCase();
            const canPreview = d.hasFile && EXTS.includes(ext);
            return (
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
                            <Description />
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="subtitle1" noWrap>
                                {d.displayType || d.docType}
                              </Typography>
                              {d.source === 'rc-suggested' && <SoftChip tone="#4f46e5" label="From RC" />}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                              {d.truckNumber}
                            </Typography>
                          </Box>
                        </Stack>
                        <SoftChip status={d.status} />
                      </Stack>

                      <Box sx={{ mt: 2 }}>
                        <Spec label="Doc No">
                          <Typography variant="body2" fontWeight={600}>
                            {d.docNumber || '—'}
                          </Typography>
                        </Spec>
                        {d.issuingAuthority && (
                          <Spec label="Issued By">
                            <Typography variant="body2" fontWeight={600}>
                              {d.issuingAuthority}
                            </Typography>
                          </Spec>
                        )}
                        <Spec label="Expiry">
                          <Typography variant="body2" fontWeight={600}>
                            {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : 'No expiry'}
                          </Typography>
                        </Spec>
                        <Spec label="Days Left">
                          {d.expiryDate ? (
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                color:
                                  d.daysLeft < 0 ? 'error.main' : d.daysLeft <= 30 ? 'warning.main' : 'success.main',
                              }}
                            >
                              {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} overdue` : `${d.daysLeft} days`}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </Spec>
                        {d.hasFile ? (
                          <Spec label="File">
                            <Stack direction="row" spacing={0.75}   sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                              <SoftChip tone="#4f46e5" label={(ext || 'file').toUpperCase()} />
                              {d.fileProvider === 'cloudinary' && (
                                <Typography variant="caption" color="text.secondary">
                                  · cloud
                                </Typography>
                              )}
                            </Stack>
                          </Spec>
                        ) : (
                          <Spec label="File">
                            <Typography variant="body2" color="warning.main" fontWeight={600}>
                              Not uploaded
                            </Typography>
                          </Spec>
                        )}
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Stack direction="row" spacing={1}>
                        <Button
                          variant={canPreview ? 'contained' : 'outlined'}
                          size="small"
                          startIcon={<VisibilityOutlined fontSize="small" />}
                          onClick={() => setPreview(d)}
                          disabled={!canPreview}
                          sx={{ flex: 1 }}
                        >
                          View
                        </Button>
                        <Tooltip title="Edit document">
                          <IconButton size="small" onClick={() => openEdit(d)} aria-label={`Edit ${d.displayType || d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete document">
                          <IconButton size="small" color="error" onClick={() => del(d)} aria-label={`Delete ${d.displayType || d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      <DocumentPreview doc={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />

      <Dialog open={modal} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row"   sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{editId ? 'Edit' : 'Add'} Document</span>
            <IconButton onClick={closeForm} size="small" aria-label="Close dialog">
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
          <Box component="form" id="doc-form" onSubmit={save} sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Truck *" select value={form.truck} onChange={set('truck')} required>
              <MenuItem value="">
                <em>Select</em>
              </MenuItem>
              {trucks.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  {t.truckNumber}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Type *" select value={form.docType} onChange={set('docType')}>
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            {isCustom && (
              <TextField
                label="Document Name *"
                value={form.customLabel}
                onChange={set('customLabel')}
                placeholder="e.g. Police NOC, Waybill"
                required
              />
            )}
            <TextField
              label="Issuing Authority"
              value={form.issuingAuthority}
              onChange={set('issuingAuthority')}
              placeholder="e.g. MP RTO Indore"
            />
            <TextField label="Document No" value={form.docNumber} onChange={set('docNumber')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Issue Date"
                type="date"
                value={form.issueDate}
                onChange={set('issueDate')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={needsExpiry ? 'Expiry Date *' : 'Expiry Date (optional)'}
                type="date"
                value={form.expiryDate}
                onChange={set('expiryDate')}
                required={needsExpiry}
                helperText={needsExpiry ? undefined : 'Leave blank for lifetime documents (e.g. NOC, RC)'}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {editId ? 'Replace file' : 'File'}
                {editId && !editing?.hasFile && ' (optional)'}
              </Typography>
              <DocumentDropzone
                file={file}
                current={editId && !file ? editing : null}
                onDrop={setFile}
                onClear={() => setFile(null)}
              />
              {editId && !file && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  The old file is deleted once the new one saves.
                </Typography>
              )}
            </Box>
            <TextField label="Remarks" multiline rows={2} value={form.remarks} onChange={set('remarks')} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm} color="inherit">
            Cancel
          </Button>
          <Button form="doc-form" type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
