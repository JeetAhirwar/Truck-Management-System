import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

/** Strips the query string so `.pdf?x=1` still resolves to pdf. */
export function extOf(url = '') {
  const clean = String(url).split('?')[0].split('#')[0];
  const ext = clean.includes('.') ? clean.split('.').pop() : '';
  return (ext || '').toLowerCase();
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png'];
const PDF_EXT = ['pdf'];

export default function DocumentPreview({ doc, open, onClose }) {
  if (!doc) return null;

  const url = doc.documentUrl || doc.uploadedFile || '';
  const ext = doc.fileExt || extOf(url);
  const isImage = IMAGE_EXT.includes(ext);
  const isPdf = PDF_EXT.includes(ext);
  const name = doc.fileOriginalName || doc.docNumber || url.split('/').pop() || 'Document';
  const meta = [
    doc.docType,
    doc.truckNumber,
    doc.docNumber ? `No. ${doc.docNumber}` : null,
    doc.expiryDate ? `Expires ${new Date(doc.expiryDate).toLocaleDateString()}` : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { height: '92vh', maxHeight: 900 } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            sx={(t) => ({
              width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0,
              bgcolor: isPdf ? alpha(t.palette.error.main, 0.12) : alpha(t.palette.primary.main, 0.12),
              color: isPdf ? 'error.main' : 'primary.main',
            })}
          >
            {isPdf ? <PictureAsPdfRoundedIcon /> : isImage ? <ImageRoundedIcon /> : <InsertDriveFileOutlinedIcon />}
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" noWrap fontWeight={700} title={name}>
              {name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
              {meta.map((m) => (
                <Chip key={m} label={m} size="small" variant="outlined" sx={{ height: 22, fontSize: 11.5 }} />
              ))}
              {doc.fileSize > 0 && (
                <Chip label={`${(doc.fileSize / 1024).toFixed(0)} KB`} size="small" sx={{ height: 22, fontSize: 11.5 }} />
              )}
            </Box>
          </Box>

          <IconButton onClick={onClose} aria-label="Close preview" size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', minHeight: 0, bgcolor: 'background.default' }}>
        {!url ? (
          <CenteredStack icon={<InsertDriveFileOutlinedIcon color="disabled" fontSize="large" />}>
            <Typography color="text.secondary">No file attached to this document.</Typography>
          </CenteredStack>
        ) : isImage ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', p: 2, overflow: 'auto' }}>
            <Box
              component="img"
              src={url}
              alt={name}
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2, boxShadow: 4 }}
            />
          </Box>
        ) : isPdf ? (
          <Box
            component="iframe"
            src={`${url}#view=FitH&toolbar=0`}
            title={name}
            sx={{ flex: 1, width: '100%', minHeight: 0, border: 0, bgcolor: '#525659' }}
          />
        ) : (
          <CenteredStack
            icon={<InsertDriveFileOutlinedIcon color="action" sx={{ fontSize: 56 }} />}
          >
            <Typography gutterBottom>This file type can’t be previewed in-app.</Typography>
            <Typography variant="body2" color="text.secondary">
              Supported for preview: PDF, JPG, PNG.
            </Typography>
          </CenteredStack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          size="small"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!url}
        >
          Open
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose}>Close</Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<DownloadRoundedIcon fontSize="small" />}
          href={url || undefined}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!url}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const CenteredStack = ({ icon, children }) => (
  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, p: 4, textAlign: 'center' }}>
    {icon}
    {children}
  </Box>
);
