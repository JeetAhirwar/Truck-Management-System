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
import {
  EmptyState,
  PageHeader,
  SearchField,
  SoftChip,
  StatCard,
  StatGrid,
} from '../components/ui';

const types = ['RC', 'Insurance', 'PUC', 'Fitness Certificate', 'Permit', 'National Permit', 'Tax', 'Roadworthiness', 'Other'];
const empty = { truck: '', truckNumber: '', docType: 'Insurance', docNumber: '', issueDate: '', expiryDate: '', remarks: '' };
const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const FILTERS = ['all', 'Valid', 'Expiring Soon', 'Expired'];

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
    if (!window.confirm(`Delete ${d.docType} for ${d.truckNumber}? The stored file will be removed too.`)) return;
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
    return docs.filter((d) => {
      const match =
        (d.truckNumber || '').toLowerCase().includes(q) ||
        (d.docType || '').toLowerCase().includes(q) ||
        (d.docNumber || '').toLowerCase().includes(q);
      if (filter === 'all') return match;
      return match && d.status === filter;
    });
  }, [docs, search, filter]);

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
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
                            <Typography variant="subtitle1" noWrap>
                              {d.docType}
                            </Typography>
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
                        <Spec label="Expiry">
                          <Typography variant="body2" fontWeight={600}>
                            {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : '—'}
                          </Typography>
                        </Spec>
                        <Spec label="Days Left">
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
                        </Spec>
                        {d.hasFile && (
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
                          <IconButton size="small" onClick={() => openEdit(d)} aria-label={`Edit ${d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete document">
                          <IconButton size="small" color="error" onClick={() => del(d)} aria-label={`Delete ${d.docType}`} sx={{ border: 1, borderColor: 'divider' }}>
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
            <TextField label="Document No" value={form.docNumber} onChange={set('docNumber')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField label="Issue Date" type="date" value={form.issueDate} onChange={set('issueDate')} InputLabelProps={{ shrink: true }} />
              <TextField label="Expiry *" type="date" value={form.expiryDate} onChange={set('expiryDate')} required InputLabelProps={{ shrink: true }} />
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
