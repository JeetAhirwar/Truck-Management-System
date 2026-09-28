const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const CLOUDINARY_FOLDER = 'truckpro/documents';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

const hasCloudinaryKeys = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
);

/**
 * DOCUMENT_STORAGE = "auto" (default) | "cloudinary" | "local"
 * "local" forces disk storage even when Cloudinary keys are present, which is
 * handy for development without editing .env.
 */
const storagePreference = String(process.env.DOCUMENT_STORAGE || 'auto').toLowerCase();
const isCloudinaryEnabled = storagePreference === 'local'
  ? false
  : storagePreference === 'cloudinary' || storagePreference === 'auto'
    ? hasCloudinaryKeys
    : hasCloudinaryKeys;

if (storagePreference === 'cloudinary' && !hasCloudinaryKeys) {
  throw new Error('DOCUMENT_STORAGE=cloudinary but CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET are missing');
}

if (isCloudinaryEnabled) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// ---------------------------------------------------------------- local disk
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!isCloudinaryEnabled && !fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOCAL_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`);
  },
});

/** Turns opaque Cloudinary SDK errors into something actionable. */
function describeCloudinaryError(err) {
  const msg = String(err?.message || err || '');
  const status = /status code - (\d{3})/.exec(msg)?.[1];
  if (status === '401') {
    return 'Cloudinary authentication failed (401). Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.';
  }
  if (status === '403') {
    return 'Cloudinary rejected the upload (403). The API key lacks upload/write permission — check it in the Cloudinary console (Settings → API Keys), or blank the CLOUDINARY_* vars to use local storage.';
  }
  if (status === '404') {
    return 'Cloudinary cloud not found (404). Check CLOUDINARY_CLOUD_NAME.';
  }
  if (status === '420') {
    return 'Cloudinary rate limit or quota reached. Try again shortly.';
  }
  if (/invalid pdf|invalid image|invalid file|not a valid|unsupported format/i.test(msg)) {
    return `Cloudinary rejected the file content: ${msg}. The file may be corrupt or not a real ${msg.toLowerCase().includes('pdf') ? 'PDF' : 'image'}.`;
  }
  return `Cloudinary upload failed: ${msg}`;
}

// ---------------------------------------------------------------- cloudinary
let cloudinaryStorage = null;
if (isCloudinaryEnabled) {
  // v2 exports the class directly; v3/v4 export { CloudinaryStorage }.
  const mod = require('multer-storage-cloudinary');
  const CloudinaryStorage = mod.CloudinaryStorage || mod;
  const base = new CloudinaryStorage({
    cloudinary,
    folder: CLOUDINARY_FOLDER,
    // multer-storage-cloudinary validates the extension server-side, so a
    // renamed .exe cannot slip through.
    allowed_formats: ALLOWED_EXTENSIONS,
    resource_type: 'auto', // required so PDFs upload as documents, not images
    use_filename: false,
    unique_filename: true,
    overwrite: false,
  });

  // Annotate SDK errors as they surface through the multer stream.
  cloudinaryStorage = {
    _handleFile(req, file, cb) {
      base._handleFile(req, file, (err, ...rest) => {
        if (err) err.message = describeCloudinaryError(err);
        cb(err, ...rest);
      });
    },
    _removeFile(req, file, cb) {
      base._removeFile(req, file, cb);
    },
  };
}

const storage = cloudinaryStorage || localStorage;

/** Extension of a filename or a stored URL, lowercased, without the dot. */
function extensionOf(value = '') {
  const clean = String(value).split('?')[0].split('#')[0];
  const ext = path.extname(clean).replace('.', '').toLowerCase();
  return ext;
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = extensionOf(file.originalname);
    const mime = (file.mimetype || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported file type ".${ext}". Allowed: .pdf, .jpg, .jpeg, .png`));
    }
    if (!ALLOWED_MIME.includes(mime)) {
      return cb(new Error(`Unsupported content type "${mime}". Allowed: PDF and JPEG/PNG images`));
    }
    cb(null, true);
  },
});

/**
 * Best-effort cleanup of a previously stored file. Never throws — a failed
 * delete must not block the user's update.
 * @param {{uploadedFile?: string, filePublicId?: string}} stored
 */
async function deleteStoredFile({ uploadedFile = '', filePublicId = '' } = {}) {
  const url = uploadedFile;
  try {
    if (isCloudinaryEnabled && filePublicId) {
      // `auto` lets Cloudinary resolve the resource type (PDFs are stored as
      // image assets, JPEGs as image, so hardcoding 'raw' would 404).
      await cloudinary.uploader.destroy(filePublicId, { resource_type: 'auto' });
      return { ok: true, provider: 'cloudinary', publicId: filePublicId };
    }
    if (isCloudinaryEnabled && !filePublicId) {
      // Fall back to deriving the public id from a delivery URL.
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
      if (match) {
        const id = decodeURIComponent(match[1]);
        await cloudinary.uploader.destroy(id, { resource_type: 'auto' });
        return { ok: true, provider: 'cloudinary', publicId: id };
      }
      return { ok: false, reason: 'no public id' };
    }
    if (url) {
      // Accepts both "/uploads/<name>" and an absolute filesystem path.
      const name = path.basename(String(url).split('?')[0]);
      const target = path.join(LOCAL_UPLOAD_DIR, name);
      // Guard against path traversal before unlinking.
      if (path.dirname(path.resolve(target)) === path.resolve(LOCAL_UPLOAD_DIR)) {
        if (fs.existsSync(target)) fs.unlinkSync(target);
        return { ok: true, provider: 'local', file: name };
      }
      return { ok: false, reason: 'refused: outside uploads dir' };
    }
    return { ok: false, reason: 'nothing to delete' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Normalises a multer file into Document-model fields. The returned keys match
 * the schema exactly — Mongoose silently drops anything else.
 */
function toStoredFile(file) {
  if (!file) return null;
  return {
    // Cloudinary's storage engine sets `path` to the secure delivery URL, but
    // multer's diskStorage sets it to the absolute *filesystem* path. Only the
    // former is a URL, so the local case is rebuilt from the filename.
    uploadedFile: isCloudinaryEnabled ? file.path : `/uploads/${file.filename}`,
    filePublicId: file.filename || '',
    fileProvider: isCloudinaryEnabled ? 'cloudinary' : 'local',
    fileOriginalName: file.originalname,
    fileMimeType: file.mimetype,
    fileSize: file.size,
  };
}

/**
 * Wraps multer so its errors become clean 4xx JSON responses instead of
 * falling through to the generic 500 handler.
 */
function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field — use the "file" field' });
      }
      return res.status(400).json({ error: err.message });
    });
  };
}

module.exports = {
  upload,
  uploadSingle: handleUpload(upload.single('file')),
  handleUpload,
  deleteStoredFile,
  toStoredFile,
  extensionOf,
  isCloudinaryEnabled,
  isLocalStorage: !isCloudinaryEnabled,
  LOCAL_UPLOAD_DIR,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
};
