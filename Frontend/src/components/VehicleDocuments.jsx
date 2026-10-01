/**
 * VehicleDocuments — the per-vehicle document list used inside the Add/Edit
 * Truck dialog.
 *
 * Reuses the existing document stack end to end: the same
 * `GET/POST/PUT/DELETE /api/documents` endpoints, the same `DocumentDropzone`
 * and `DocumentPreview`, and the backend `status` virtual for expiry state
 * (never re-implemented here).
 *
 * One vehicle can hold any number of documents of any type, including
 * unlimited custom "Other" documents.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddRounded,
  CloseRounded,
  DeleteOutlined,
  DescriptionOutlined,
  EditOutlined,
  UploadFileRounded,
  VisibilityOutlined,
} from '@mui/icons-material';
import DocumentDropzone from './DocumentDropzone';
import DocumentPreview from './DocumentPreview';
import { SoftChip, toneFor } from './ui';
import {
  getDocumentTypes,
  listDocuments,
  replaceDocumentFile,
  saveDocument,
  deleteDocument,
} from '../utils/vehicleDocuments';

const STATUS_TONE = {
  Valid: '#059669',
  'Expiring Soon': '#d97706',
  Expired: '#dc2626',
  'No Expiry': '#64748b',
  Unknown: '#64748b',
};

const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];

const emptyForm = {
  docType: 'RC',
  customLabel: '',
  issuingAuthority: '',
  docNumber: '',
  issueDate: '',
  expiryDate: '',
  remarks: '',
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Days-remaining label; mirrors the backend's own wording. */
function daysLeftLabel(doc) {
  if (!doc.expiryDate) return 'No expiry';
  const days = Number(doc.daysLeft);
  if (!Number.isFinite(days)) return '';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Expires today';
  return `${days} days left`;
}

export default function VehicleDocuments({
  truckId,
  truckNumber,
  registrationNumber,
  onCountChange,
  onDocumentsChange,
  toast,
  compact = false,
}) {
  const [documents, setDocuments] = useState([]);
  const [types, setTypes] = useState([]);
  const [expiryRequired, setExpiryRequired] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState(null);
  const [replaceMode, setReplaceMode] = useState(false);

  const applyDocuments = useCallback(
    (list) => {
      setDocuments(list);
      onCountChange?.(list.length);
      onDocumentsChange?.(list);
    },
    [onCountChange, onDocumentsChange]
  );

  const refresh = useCallback(async () => {
    if (!truckId) {
      applyDocuments([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listDocuments(truckId);
      applyDocuments(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load documents');
    } finally {
      setLoading(false);
    }
  }, [truckId, applyDocuments]);

  useEffect(() => {
    getDocumentTypes().then((data) => {
      setTypes(data.types);
      setExpiryRequired(data.expiryRequired);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openAdd = () => {
    setForm(emptyForm);
    setEditing(null);
    setFile(null);
    setFormError('');
    setReplaceMode(false);
    setEditorOpen(true);
  };

  const openEdit = (doc) => {
    setForm({
      docType: doc.docType,
      customLabel: doc.customLabel || '',
      issuingAuthority: doc.issuingAuthority || '',
      docNumber: doc.docNumber || '',
      issueDate: doc.issueDate ? String(doc.issueDate).slice(0, 10) : '',
      expiryDate: doc.expiryDate ? String(doc.expiryDate).slice(0, 10) : '',
      remarks: doc.remarks || '',
    });
    setEditing(doc);
    setFile(null);
    setFormError('');
    setReplaceMode(false);
    setEditorOpen(true);
  };

  const openReplace = (doc) => {
    setEditing(doc);
    setFile(null);
    setFormError('');
    setReplaceMode(true);
    setEditorOpen(true);
  };

  const needsExpiry = expiryRequired.includes(form.docType);
  const isCustom = form.docType === 'Other';

  const submit = async (e) => {
    e.preventDefault();
    if (isCustom && !form.customLabel.trim()) {
      setFormError('Please enter a document name for the "Other" type');
      return;
    }
    if (needsExpiry && !form.expiryDate) {
      setFormError('Expiry date is required for this document type');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (replaceMode && editing) {
        if (!file) {
          setFormError('Choose a file to upload');
          setSaving(false);
          return;
        }
        await replaceDocumentFile(editing._id, file);
        toast?.({ severity: 'success', title: 'File updated', message: editing.displayType || editing.docType });
      } else {
        await saveDocument({ ...form, truck: truckId }, file, editing?._id);
        toast?.({
          severity: 'success',
          title: editing ? 'Document updated' : 'Document added',
          message: form.customLabel || form.docType,
        });
      }
      setEditorOpen(false);
      setFile(null);
      await refresh();
    } catch (err) {
      setFormError(err.message || 'Could not save the document');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete ${doc.displayType || doc.docType} for ${truckNumber}? The stored file will be removed too.`)) {
      return;
    }
    try {
      await deleteDocument(doc._id);
      toast?.({ severity: 'success', title: 'Document deleted' });
      await refresh();
    } catch (err) {
      toast?.({ severity: 'error', title: 'Delete failed', message: err.message });
    }
  };

  if (!truckId) {
    return (
      <Box
        sx={{
          border: 1,
          borderStyle: 'dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2.5,
          textAlign: 'center',
        }}
      >
        <Typography variant="subtitle2">Vehicle Documents</Typography>
        <Typography variant="caption" color="text.secondary">
          Save this vehicle first — then you can add any number of documents (RC, insurance, fitness,
          permit, tax, PUC, NOC and custom ones).
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">Vehicle Documents ({documents.length})</Typography>
        <Button size="small" startIcon={<AddRounded />} onClick={openAdd}>
          Add Document
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
          <CircularProgress size={22} />
        </Box>
      ) : documents.length === 0 ? (
        <Box
          sx={{
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2.5,
            textAlign: 'center',
          }}
        >
          <DescriptionOutlined sx={{ color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            No documents yet. Add the RC, insurance, fitness, permit, tax, PUC or any custom document.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {documents.map((doc) => {
            const status = doc.status || 'Unknown';
            const ext = (doc.fileExt || '').toLowerCase();
            const canPreview = doc.hasFile && EXTS.includes(ext);
            return (
              <Card key={doc._id} variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: '14px !important', '&:last-child': { pb: '14px !important' } }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2">{doc.displayType || doc.docType}</Typography>
                        <SoftChip tone={STATUS_TONE[status] || toneFor(status)} label={status} />
                        {doc.source === 'rc-suggested' && <SoftChip tone="#4f46e5" label="From RC" />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {doc.docNumber ? `No: ${doc.docNumber}` : 'No document number'}
                        {doc.issuingAuthority ? ` · ${doc.issuingAuthority}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.expiryDate ? `Expires ${formatDate(doc.expiryDate)} · ${daysLeftLabel(doc)}` : 'No expiry date'}
                      </Typography>
                      {!doc.hasFile && (
                        <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                          Validity known from RC data — no file uploaded yet
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={canPreview ? 'View file' : 'No file uploaded'}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!canPreview}
                            onClick={() => setPreview(doc)}
                            aria-label={`View ${doc.displayType || doc.docType}`}
                            sx={{ border: 1, borderColor: 'divider' }}
                          >
                            <VisibilityOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={doc.hasFile ? 'Replace file' : 'Upload file'}>
                        <IconButton
                          size="small"
                          onClick={() => openReplace(doc)}
                          aria-label={`Upload file for ${doc.displayType || doc.docType}`}
                          sx={{ border: 1, borderColor: 'divider' }}
                        >
                          <UploadFileRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit details">
                        <IconButton
                          size="small"
                          onClick={() => openEdit(doc)}
                          aria-label={`Edit ${doc.displayType || doc.docType}`}
                          sx={{ border: 1, borderColor: 'divider' }}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete document">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => remove(doc)}
                          aria-label={`Delete ${doc.displayType || doc.docType}`}
                          sx={{ border: 1, borderColor: 'divider' }}
                        >
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
      )}

      <DocumentPreview doc={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {replaceMode ? 'Upload file' : editing ? 'Edit document' : 'Add document'}
              {truckNumber ? ` · ${truckNumber}` : ''}
            </span>
            <IconButton onClick={() => setEditorOpen(false)} size="small" aria-label="Close dialog">
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Box component="form" id="vehicle-doc-form" onSubmit={submit} sx={{ display: 'grid', gap: 2, pt: 1 }}>
            {replaceMode ? (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Replace file
                </Typography>
                <DocumentDropzone file={file} current={editing} onDrop={setFile} onClear={() => setFile(null)} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  The old file is deleted once the new one saves.
                </Typography>
              </Box>
            ) : (
              <>
                <TextField label="Document Type *" select value={form.docType} onChange={set('docType')}>
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
                    placeholder="e.g. Police Clearance, Police NOC"
                    required
                  />
                )}
                <TextField label="Document Number" value={form.docNumber} onChange={set('docNumber')} />
                <TextField
                  label="Issuing Authority"
                  value={form.issuingAuthority}
                  onChange={set('issuingAuthority')}
                  placeholder="e.g. MP RTO Indore"
                />
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
                    helperText={needsExpiry ? undefined : 'Lifetime documents can be left blank'}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Document file
                  </Typography>
                  <DocumentDropzone file={file} current={editing} onDrop={setFile} onClear={() => setFile(null)} />
                </Box>
                <TextField
                  label="Notes"
                  value={form.remarks}
                  onChange={set('remarks')}
                  multiline
                  rows={2}
                  placeholder="Anything worth remembering about this document"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button form="vehicle-doc-form" type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : replaceMode ? 'Upload' : editing ? 'Update' : 'Add Document'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
