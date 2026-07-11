# Gestión de Archivos ZIP

Sistema fullstack para cargar archivos ZIP, almacenarlos en el servidor y hacer seguimiento de su estado.

---

## Estructura del proyecto

```
app-factory/
├── backend/
│   ├── src/
│   │   ├── config/db.js        # Conexión a MongoDB
│   │   ├── models/Upload.js    # Modelo Mongoose (collection: archivo_zip)
│   │   ├── routes/uploads.js   # Rutas GET y POST /api/uploads
│   │   └── app.js              # Entrada del servidor Express
│   ├── uploads/                # Archivos ZIP guardados en disco
│   ├── .env.example            # Variables de entorno de ejemplo
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx / Login.css       # Pantalla de login
│   │   │   └── Dashboard.jsx / Dashboard.css  # Dashboard principal
│   │   ├── services/api.js     # Llamadas a la API
│   │   ├── App.jsx             # Rutas de React Router
│   │   ├── main.jsx            # Entrada de React
│   │   └── index.css           # Reset global
│   ├── index.html
│   ├── vite.config.js          # Proxy /api → localhost:3001
│   └── package.json
│
└── README.md
```

---

## Configuración de MongoDB

1. Crea el archivo `.env` dentro de la carpeta `backend/`:

```bash
cp backend/.env.example backend/.env
```

2. Edita `backend/.env` con tu cadena de conexión:

```env
MONGO_URI=mongodb://localhost:27017/app-factory
PORT=3001
```

> La base de datos `app-factory` y la collection `archivo_zip` son creadas automáticamente al guardar el primer documento.

---

## Instalación

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

---

## Ejecución

### Backend (en una terminal)

```bash
cd backend
npm run dev
```

El servidor quedará disponible en: `http://localhost:3001`

### Frontend (en otra terminal)

```bash
cd frontend
npm run dev
```

La aplicación quedará disponible en: `http://localhost:5173`

---

## Endpoints de la API

| Método | Ruta            | Descripción                          |
|--------|-----------------|--------------------------------------|
| GET    | /api/health     | Verifica que el servidor esté activo |
| POST   | /api/uploads    | Sube un archivo ZIP                  |
| GET    | /api/uploads    | Lista todos los archivos subidos     |

---

## Estados de los archivos

| Estado      | Descripción                        |
|-------------|------------------------------------|
| Cargado     | El archivo fue recibido con éxito  |
| En revisión | En proceso de revisión             |
| Procesando  | Siendo procesado                   |
| Completado  | Procesamiento finalizado           |
| Error       | Ocurrió un error durante el proceso|
