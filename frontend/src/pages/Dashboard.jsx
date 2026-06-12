import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUploads, uploadFile, deleteUpload, updateUploadStatus } from '../services/api';
import FileModal from './FileModal';
import './Dashboard.css';

const BASE_STEPS = [
  'Cargado',
  'Procesando',
  'En revisión',
  'Creando Solución',
  'Test y Ajustes',
  'Desplegando en Plataforma',
  'Completado',
];

function StatusStepper({ status }) {
  const isError = status === 'Error';
  const steps = isError ? [...BASE_STEPS, 'Error'] : BASE_STEPS;
  const currentIdx = isError ? -1 : BASE_STEPS.indexOf(status);

  return (
    <div className="stepper">
      {steps.map((step, idx) => {
        const isErrStep = step === 'Error';
        const isPast    = !isError && idx < currentIdx;
        const isCurrent = !isError && idx === currentIdx;
        const lineActive = !isError && idx > 0 && idx <= currentIdx;

        let dotCls   = 'stepper-dot';
        let labelCls = 'stepper-label';

        if (isErrStep)   { dotCls += ' dot-error';   labelCls += ' label-error'; }
        else if (isCurrent) { dotCls += ' dot-current'; labelCls += ' label-current'; }
        else if (isPast)    { dotCls += ' dot-past';    labelCls += ' label-past'; }

        return (
          <React.Fragment key={step}>
            {idx > 0 && (
              <div className={`stepper-line${lineActive ? ' line-active' : ''}`} />
            )}
            <div className="stepper-step">
              <div className={dotCls} />
              <span className={labelCls}>{step}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function formatSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const [files,        setFiles]        = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [dragging,     setDragging]     = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  useEffect(() => { loadFiles(); }, []);

  async function loadFiles() {
    try {
      const data = await getUploads();
      setFiles(data);
    } catch {
      showNotification('Error al cargar los archivos del servidor', 'error');
    }
  }

  async function openFile(file) {
    setSelectedFile(file);
    if (file.status === 'Cargado') {
      try {
        await updateUploadStatus(file._id, 'Procesando');
        setFiles(prev =>
          prev.map(f => f._id === file._id ? { ...f, status: 'Procesando' } : f)
        );
      } catch { /* silencioso */ }
    }
  }

  async function handleDelete(file) {
    setConfirmingId(null);
    try {
      await deleteUpload(file._id);
      setFiles(prev => prev.filter(f => f._id !== file._id));
      showNotification(`Archivo "${file.originalName}" eliminado`);
    } catch {
      showNotification('Error al eliminar el archivo', 'error');
    }
  }

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleUpload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showNotification('Solo se permiten archivos ZIP', 'error');
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadFile(file);
      setFiles(prev => [doc, ...prev]);
      showNotification(`Archivo "${file.name}" cargado exitosamente`);
    } catch (err) {
      showNotification(err.message || 'Error al cargar el archivo', 'error');
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files[0]);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  function onFileChange(e) {
    handleUpload(e.target.files[0]);
    e.target.value = '';
  }

  return (
    <div className="dashboard">

      {/* ── Toast de notificación ── */}
      {notification && (
        <div className={`toast toast-${notification.type}`}>
          <span className="toast-icon">
            {notification.type === 'success' ? '✓' : '✕'}
          </span>
          {notification.message}
        </div>
      )}

      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" fill="#7c5cfc" />
            <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" fill="#0d0d1a" />
          </svg>
          <span>AppFactory</span>
        </div>
        <button className="btn-logout" onClick={() => navigate('/login')}>
          Cerrar sesión
        </button>
      </header>

      {/* ── Conteúdo principal ── */}
      <main className="dash-main">
        <div className="dash-container">

          <div className="page-heading">
            <h1>Gestión de Archivos ZIP</h1>
            <p>Carga y realiza seguimiento de tus archivos comprimidos</p>
          </div>

          {/* Zona de upload */}
          <div
            className={`upload-zone${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />

            <div className="upload-icon-wrap">
              {uploading ? (
                <div className="spinner" />
              ) : (
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </div>

            <p className="upload-primary">
              {uploading ? 'Cargando archivo...' : 'Arrastra y suelta tu archivo ZIP aquí'}
            </p>
            {!uploading && (
              <>
                <p className="upload-secondary">o haz clic para seleccionar un archivo</p>
                <span className="upload-badge">Solo archivos .zip</span>
              </>
            )}
          </div>

          {/* Lista de arquivos */}
          {files.length > 0 && (
            <section className="files-section">
              <div className="files-section-head">
                <h2>Archivos cargados</h2>
                <span className="files-count">{files.length}</span>
              </div>

              <div className="table-wrapper">
                <table className="files-table">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Tamaño</th>
                      <th>Fecha de carga</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => (
                      <React.Fragment key={file._id}>
                        {/* linha 1 — info do arquivo */}
                        <tr className="file-row-main">
                          <td>
                            <button
                              className="file-name-cell"
                              onClick={() => openFile(file)}
                              title="Ver contenido del archivo"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span>{file.originalName}</span>
                            </button>
                          </td>
                          <td className="cell-muted">{formatSize(file.size)}</td>
                          <td className="cell-muted">{formatDate(file.createdAt)}</td>
                          <td className="td-actions">
                            {confirmingId === file._id ? (
                              <div className="delete-confirm">
                                <span className="delete-confirm-text">¿Eliminar?</span>
                                <button className="btn-confirm-yes" onClick={() => handleDelete(file)} title="Confirmar">✓</button>
                                <button className="btn-confirm-no"  onClick={() => setConfirmingId(null)} title="Cancelar">✕</button>
                              </div>
                            ) : (
                              <button className="btn-delete" onClick={() => setConfirmingId(file._id)} title="Eliminar archivo">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* linha 2 — stepper de status */}
                        <tr className="file-row-stepper">
                          <td colSpan={4} className="td-stepper-full">
                            <StatusStepper status={file.status} />
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {files.length === 0 && !uploading && (
            <p className="empty-hint">Aún no hay archivos cargados</p>
          )}
        </div>
      </main>

      {selectedFile && (
        <FileModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onStatusChange={(newStatus) =>
            setFiles(prev =>
              prev.map(f => f._id === selectedFile._id ? { ...f, status: newStatus } : f)
            )
          }
        />
      )}
    </div>
  );
}
