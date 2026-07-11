const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const AdmZip   = require('adm-zip');
const archiver = require('archiver');
const Upload   = require('../models/Upload');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename:    (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const fileFilter = (_req, file, cb) => {
  const isZip =
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed' ||
    file.originalname.toLowerCase().endsWith('.zip');
  isZip ? cb(null, true) : cb(new Error('Solo se permiten archivos ZIP'), false);
};

const upload = multer({ storage, fileFilter });

router.get('/', async (_req, res) => {
  try {
    const uploads = await Upload.find().sort({ createdAt: -1 });
    res.json(uploads);
  } catch {
    res.status(500).json({ message: 'Error al obtener los archivos' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó ningún archivo' });
    }
    const doc = await Upload.create({
      originalName: req.file.originalname,
      fileName:     req.file.filename,
      size:         req.file.size,
      status:       'Cargado',
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar el archivo', error: error.message });
  }
});

router.get('/:id/download-extracted', async (req, res) => {
  try {
    const upload = await Upload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Archivo no encontrado' });

    const filePath = path.join(__dirname, '../../uploads', upload.fileName);

    await Upload.findByIdAndUpdate(upload._id, { status: 'En revisión' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`);

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al descargar el archivo', error: error.message });
    }
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const upload = await Upload.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!upload) return res.status(404).json({ message: 'Archivo no encontrado' });
    res.json(upload);
  } catch (error) {
    res.status(400).json({ message: 'Estado inválido', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const upload = await Upload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Archivo no encontrado' });

    const fs       = require('fs');
    const filePath = path.join(__dirname, '../../uploads', upload.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await Upload.findByIdAndDelete(req.params.id);
    res.json({ message: 'Archivo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el archivo', error: error.message });
  }
});

router.get('/:id/entry', async (req, res) => {
  try {
    const { path: entryPath } = req.query;
    if (!entryPath) return res.status(400).json({ message: 'Ruta no especificada' });

    const upload = await Upload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Archivo no encontrado' });

    const filePath = path.join(__dirname, '../../uploads', upload.fileName);
    const zip      = new AdmZip(filePath);
    const entry    = zip.getEntry(entryPath);

    if (!entry || entry.isDirectory) {
      return res.status(404).json({ message: 'Entrada no encontrada' });
    }

    const ext = path.extname(entryPath).toLowerCase();
    const mimeMap = {
      '.txt': 'text/plain', '.md':  'text/plain', '.csv': 'text/plain',
      '.js':  'text/plain', '.jsx': 'text/plain', '.ts':  'text/plain',
      '.tsx': 'text/plain', '.css': 'text/plain', '.html':'text/plain',
      '.json':'text/plain', '.xml': 'text/plain', '.yml': 'text/plain',
      '.yaml':'text/plain', '.sh':  'text/plain', '.py':  'text/plain',
      '.env': 'text/plain', '.sql': 'text/plain',
      '.png': 'image/png',  '.jpg': 'image/jpeg', '.jpeg':'image/jpeg',
      '.gif': 'image/gif',  '.svg': 'image/svg+xml', '.webp':'image/webp',
      '.ico': 'image/x-icon', '.bmp':'image/bmp',
      '.pdf': 'application/pdf',
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(entry.getData());
  } catch (error) {
    res.status(500).json({ message: 'Error al leer el archivo', error: error.message });
  }
});

router.get('/:id/contents', async (req, res) => {
  try {
    const upload = await Upload.findById(req.params.id);
    if (!upload) return res.status(404).json({ message: 'Archivo no encontrado' });

    const filePath = path.join(__dirname, '../../uploads', upload.fileName);
    const zip      = new AdmZip(filePath);
    const entries  = zip.getEntries();

    const contents = entries.map(entry => ({
      name:           entry.entryName,
      size:           entry.header.size,
      compressedSize: entry.header.compressedSize,
      isDirectory:    entry.isDirectory,
    }));

    res.json({ upload, contents });
  } catch (error) {
    res.status(500).json({ message: 'Error al leer el archivo ZIP', error: error.message });
  }
});

module.exports = router;
