const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const heicConvert = require('heic-convert');

// ── Helper: HEIC/HEIF → JPEG buffer so Sharp can process it ──────────────────
async function resolveSharpInput(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.heic' || ext === '.heif') {
    const inputBuffer = await fsp.readFile(filePath);
    const jpegBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 1 });
    return Buffer.from(jpegBuffer);
  }
  return filePath;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Directories ──────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CONVERTED_DIR = path.join(__dirname, 'converted');
[UPLOADS_DIR, CONVERTED_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 100 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp',
      'image/dng',
      'image/x-adobe-dng',
      'image/heic',
      'image/heif',
      'image/heic-sequence',
      'image/heif-sequence',
      'application/octet-stream'
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.dng', '.heic', '.heif']);

    if (allowedMimeTypes.has(file.mimetype) || allowedExts.has(ext)) cb(null, true);
    else cb(new Error(`Unsupported type: ${file.mimetype || ext || 'unknown'}`));
  }
});

// ── Helper: format bytes ──────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(2)} MB`;
}

// ── Helper: clean old files (>1 hour) ────────────────────────────────────────
async function cleanOldFiles(dir) {
  try {
    const files = await fsp.readdir(dir);
    const now = Date.now();
    for (const f of files) {
      const fp = path.join(dir, f);
      const stat = await fsp.stat(fp);
      if (now - stat.mtimeMs > 60 * 60 * 1000) await fsp.unlink(fp).catch(() => {});
    }
  } catch {}
}
setInterval(() => { cleanOldFiles(UPLOADS_DIR); cleanOldFiles(CONVERTED_DIR); }, 15 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/convert ─ single or bulk conversion ────────────────────────────
app.post('/api/convert', upload.array('images', 100), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded.' });
  }

  const quality  = Math.min(100, Math.max(1, parseInt(req.body.quality)  || 82));
  const lossless = req.body.lossless === 'true';
  const effort   = Math.min(6,  Math.max(0, parseInt(req.body.effort)    || 4));
  const resize   = req.body.resize ? JSON.parse(req.body.resize) : null;

  const results = [];

  for (const file of req.files) {
    const outName = path.basename(file.filename, path.extname(file.filename)) + '.webp';
    const outPath = path.join(CONVERTED_DIR, outName);

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const isWebP = ext === '.webp';
      const needsResize = resize && (resize.width || resize.height);

      // ── WebP passthrough: if already WebP and no resize needed, just copy ──
      // Re-encoding WebP→WebP decodes to raw pixels first, which always inflates size.
      if (isWebP && !needsResize) {
        await fsp.copyFile(file.path, outPath);
        const origSize = fs.statSync(file.path).size;
        const meta = await sharp(file.path).metadata();
        results.push({
          status: 'success', originalName: file.originalname,
          convertedName: outName, downloadUrl: `/api/download/${outName}`,
          originalSize: origSize, convertedSize: origSize,
          originalSizeFmt: fmtBytes(origSize), convertedSizeFmt: fmtBytes(origSize),
          savingsPercent: 0, width: meta.width, height: meta.height,
          originalWidth: meta.width, originalHeight: meta.height,
          format: 'webp', passthrough: true
        });
        await fsp.unlink(file.path).catch(() => {});
        continue;
      }

      // ── WebP + resize: re-encode but use lossless to avoid extra inflation ──
      const webpOptions = isWebP && needsResize
        ? { lossless: true, effort, smartSubsample: true }
        : { quality, lossless, effort, smartSubsample: true };

      // Resolve input: HEIC/HEIF → JPEG buffer first
      const sharpInput = await resolveSharpInput(file.path);
      let pipeline = sharp(sharpInput).rotate();

      // Optional resize
      if (needsResize) {
        pipeline = pipeline.resize({
          width:  resize.width  ? parseInt(resize.width)  : undefined,
          height: resize.height ? parseInt(resize.height) : undefined,
          fit: resize.fit || 'inside',
          withoutEnlargement: true
        });
      }

      // Get metadata before conversion
      const meta = await sharp(sharpInput).metadata();

      // Convert to WebP
      const info = await pipeline
        .webp(webpOptions)
        .toFile(outPath);

      const origSize  = fs.statSync(file.path).size;
      const convSize  = fs.statSync(outPath).size;
      const savings   = (((origSize - convSize) / origSize) * 100).toFixed(1);

      results.push({
        status:       'success',
        originalName: file.originalname,
        convertedName: outName,
        downloadUrl:  `/api/download/${outName}`,
        originalSize: origSize,
        convertedSize: convSize,
        originalSizeFmt: fmtBytes(origSize),
        convertedSizeFmt: fmtBytes(convSize),
        savingsPercent: parseFloat(savings),
        width:  info.width,
        height: info.height,
        originalWidth:  meta.width,
        originalHeight: meta.height,
        format: info.format
      });

      // Clean up upload
      await fsp.unlink(file.path).catch(() => {});

    } catch (err) {
      results.push({
        status: 'error',
        originalName: file.originalname,
        error: err.message
      });
      await fsp.unlink(file.path).catch(() => {});
    }
  }

  const successful  = results.filter(r => r.status === 'success');
  const totalOrig   = successful.reduce((a, r) => a + r.originalSize, 0);
  const totalConv   = successful.reduce((a, r) => a + r.convertedSize, 0);
  const totalSaving = totalOrig > 0 ? (((totalOrig - totalConv) / totalOrig) * 100).toFixed(1) : 0;

  res.json({
    success: true,
    processed: results.length,
    successCount: successful.length,
    errorCount: results.filter(r => r.status === 'error').length,
    totalOriginalSize: totalOrig,
    totalConvertedSize: totalConv,
    totalOriginalSizeFmt: fmtBytes(totalOrig),
    totalConvertedSizeFmt: fmtBytes(totalConv),
    totalSavingsPercent: parseFloat(totalSaving),
    batchDownloadUrl: successful.length > 1 ? `/api/download-zip?files=${successful.map(r => r.convertedName).join(',')}` : null,
    results
  });
});

// ── GET /api/download/:filename ───────────────────────────────────────────────
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.webp')) return res.status(400).json({ error: 'Invalid file.' });

  const filePath = path.join(CONVERTED_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found or expired.' });

  const dlName = filename.replace(/^[a-f0-9-]{36}/, 'converted');
  res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
  res.setHeader('Content-Type', 'image/webp');
  res.sendFile(filePath);
});

// ── GET /api/download-zip ─────────────────────────────────────────────────────
app.get('/api/download-zip', (req, res) => {
  const names = (req.query.files || '').split(',').map(f => path.basename(f)).filter(f => f.endsWith('.webp'));
  if (names.length === 0) return res.status(400).json({ error: 'No files specified.' });

  res.setHeader('Content-Disposition', 'attachment; filename="converted-webp.zip"');
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.on('error', err => { console.error(err); res.status(500).end(); });
  archive.pipe(res);

  names.forEach((name, i) => {
    const fp = path.join(CONVERTED_DIR, name);
    if (fs.existsSync(fp)) {
      archive.file(fp, { name: `image-${String(i + 1).padStart(3, '0')}.webp` });
    }
  });

  archive.finalize();
});

// ── GET /api/preview/:filename ────────────────────────────────────────────────
app.get('/api/preview/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.webp')) return res.status(400).json({ error: 'Invalid file.' });

  const filePath = path.join(CONVERTED_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath);
});

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', sharp: sharp.versions });
});

// ── GET /api/docs ─────────────────────────────────────────────────────────────
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'WebP Converter API',
    version: '1.0.0',
    baseUrl: `http://localhost:${PORT}`,
    endpoints: {
      'POST /api/convert': {
        description: 'Convert one or more images to WebP',
        contentType: 'multipart/form-data',
        fields: {
            images: 'File(s) — supports JPG, PNG, GIF, BMP, TIFF, DNG (max 100 files, 50MB each)',
          quality: 'Number 1–100 (default: 82)',
          lossless: 'Boolean string "true"/"false" (default: false)',
          effort: 'Number 0–6, compression effort (default: 4)',
          resize: 'JSON string e.g. {"width":1920,"height":1080,"fit":"inside"}'
        },
        example: 'curl -X POST http://localhost:3000/api/convert -F "images=@photo.jpg" -F "quality=85"'
      },
      'GET /api/download/:filename': {
        description: 'Download a single converted WebP file',
        example: 'curl -O http://localhost:3000/api/download/converted-abc.webp'
      },
      'GET /api/download-zip': {
        description: 'Download multiple files as a ZIP',
        params: { files: 'Comma-separated filenames from convert response' },
        example: 'curl -O "http://localhost:3000/api/download-zip?files=a.webp,b.webp"'
      },
      'GET /api/preview/:filename': {
        description: 'Preview a converted image in browser'
      },
      'GET /api/health': {
        description: 'Server health check'
      }
    }
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 50MB).' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ error: 'Too many files (max 100).' });
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  WebP Converter running at http://localhost:${PORT}`);
  console.log(`📖  API docs at http://localhost:${PORT}/api/docs\n`);
});