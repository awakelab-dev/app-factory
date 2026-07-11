require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');
const uploads   = require('./routes/uploads');

const app  = express();
const PORT = process.env.PORT || 3001;

connectDB();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

app.use('/api/uploads', uploads);

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
