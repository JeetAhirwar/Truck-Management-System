import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

export const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

export const ACCEPTED_LABEL = '.pdf, .jpg, .jpeg, .png';
const MAX_MB = 10;

/** Image thumbnails need a local object URL; PDFs are shown as an icon. */
function FileChip({ file, onRemove, tone = 'new' }) {
  const [preview, setPreview] = useState(null);
  const isImage = file.type?.startsWith('image/');

  useEffect(() => {
    if (!isImage || !file.preview) return undefined;
    setPreview(file.preview);
    return () => URL.revokeObjectURL(file.preview);
  }, [file, isImage]);

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25,
        borderRadius: 2, border: '1px solid', borderColor: 'divider',
        bgcolor: (t) => alpha(t.palette[tone === 'current' ? 'info' : 'success'].main, 0.06),
      }}
    >
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt=""
          sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }}
        />
      ) : isImage ? (
        <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <ImageRoundedIcon fontSize="small" color="action" />
        </Box>
      ) : (
        <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: 'error.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <PictureAsPdfRoundedIcon fontSize="small" sx={{ color: 'common.white' }} />
        </Box>
      )}

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap fontWeight={600}>
          {file.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tone === 'current' ? 'Currently uploaded — ' : ''}
          {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}
          {file.size && file.type ? ' · ' : ''}
          {(file.type || 'file').replace('application/', '').toUpperCase()}
        </Typography>
      </Box>

      {tone === 'current' ? (
        <CheckCircleRoundedIcon color="info" fontSize="small" />
      ) : (
        <CheckCircleRoundedIcon color="success" fontSize="small" />
      )}

      {onRemove && (
        <Box
          component="button"
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          sx={{
            display: 'grid', placeItems: 'center', p: 0.5, border: 0, borderRadius: 1,
            bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover', color: 'error.main' },
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
        </Box>
      )}
    </Box>
  );
}

export default function DocumentDropzone({ file, current, onDrop, onClear, disabled }) {
  const onDropCb = useCallback(
    (accepted) => {
      if (accepted.length) onDrop(accepted[0]);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: onDropCb,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_MB * 1024 * 1024,
    useFsAccessApi: true,
    disabled: disabled || Boolean(file),
  });

  const rejection = fileRejections[0];
  const reason = rejection?.errors?.[0]?.code === 'file-too-large'
    ? `File is larger than ${MAX_MB} MB`
    : rejection?.errors?.[0]?.code === 'file-invalid-type'
      ? `Only ${ACCEPTED_LABEL} files are allowed`
      : rejection?.errors?.[0]?.message;

  const locked = Boolean(disabled || file);
  const borderOf = (t) => (isDragActive ? t.palette.primary.main : t.palette.divider);
  const zoneSx = (t) => ({
    borderStyle: 'dashed',
    borderWidth: 2,
    borderRadius: 2.5,
    p: 3,
    textAlign: 'center',
    borderColor: borderOf(t),
    cursor: locked ? 'default' : 'pointer',
    transition: 'all .18s ease',
    bgcolor: 'background.paper',
    ...(isDragActive && {
      bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.06),
    }),
    '&:hover': locked
      ? {}
      : { borderColor: 'primary.main', bgcolor: alpha(t.palette.primary.main, 0.04) },
  });

  return (
    <Box>
      {file ? (
        <StackGap>
          <FileChip file={file} tone="new" onRemove={onClear} />
          <Typography variant="caption" color="text.secondary">
            Drop a different file or remove this one to choose again.
          </Typography>
        </StackGap>
      ) : current ? (
        <StackGap>
          <FileChip
            file={{
              name: current.fileOriginalName || current.documentUrl?.split('/').pop() || 'Uploaded file',
              type: current.fileMimeType || '',
              size: current.fileSize || 0,
            }}
            tone="current"
            onRemove={onClear}
          />
          <Typography variant="caption" color="text.secondary">
            Drop a new file below to replace it.
          </Typography>
          <Box {...getRootProps()} sx={zoneSx}>
            <input {...getInputProps()} />
            <DropCopy compact />
          </Box>
        </StackGap>
      ) : (
        <Box {...getRootProps()} sx={zoneSx}>
          <input {...getInputProps()} />
          <DropCopy />
        </Box>
      )}

      {reason && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          {reason}
        </Typography>
      )}
    </Box>
  );
}

const StackGap = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
);

const DropCopy = ({ compact }) => (
  <Box>
    <Box
      sx={(t) => ({
        width: compact ? 40 : 52,
        height: compact ? 40 : 52,
        mx: 'auto',
        mb: 1.25,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: alpha(t.palette.primary.main, 0.12),
        color: 'primary.main',
        transition: 'transform .18s ease',
      })}
    >
      <CloudUploadRoundedIcon sx={{ fontSize: compact ? 22 : 28 }} />
    </Box>
    <Typography variant="body2" fontWeight={600}>
      {compact ? 'Drop a new file to replace' : 'Drag & drop a file here'}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
      or <Typography component="span" variant="caption" color="primary" fontWeight={600}>browse</Typography>
      {' '}· {ACCEPTED_LABEL} · max {MAX_MB} MB
    </Typography>
  </Box>
);
