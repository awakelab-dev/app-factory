const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName:     { type: String, required: true },
    size:         { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'Cargado',
        'Procesando',
        'En revisión',
        'Creando Solución',
        'Test y Ajustes',
        'Desplegando en Plataforma',
        'Completado',
      ],
      default: 'Cargado',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'archivo_zip' }
);

module.exports = mongoose.model('Upload', uploadSchema);
