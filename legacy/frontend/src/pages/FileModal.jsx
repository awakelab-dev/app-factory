import { useState, useEffect, useCallback } from 'react';
import { getUploadContents, updateUploadStatus } from '../services/api';
import './FileModal.css';

/* ── helpers ─────────────────────────────────────────── */
const STATUS_COLOR = {
  'Cargado':    '#60a5fa', 'En revisión': '#fbbf24',
  'Procesando': '#a78bfa', 'Completado':  '#34d399', 'Error': '#f87171',
};

const TEXT_EXTS  = new Set([
  'txt','md','csv','js','jsx','ts','tsx','css','scss','html','json',
  'xml','yml','yaml','sh','bash','py','rb','php','java','c','cpp',
  'h','go','rs','env','sql','gitignore','editorconfig','prettierrc','eslintrc',
]);
const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','svg','webp','ico','bmp']);

function extOf(name) {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
}
function isText(name)  { const e = extOf(name); return TEXT_EXTS.has(e)  || !e; }
function isImage(name) { return IMAGE_EXTS.has(extOf(name)); }

function formatSize(bytes) {
  if (!bytes) return '—';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('es-ES', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
}
function depth(entry) {
  return entry.name.split('/').filter(Boolean).length - 1;
}
function displayName(entry) {
  const p = entry.name.split('/').filter(Boolean);
  return p[p.length - 1] + (entry.isDirectory ? '/' : '');
}

/* ── íconos ── */
function IconFile({ color = 'currentColor' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
    </svg>
  );
}
function IconBack() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════
   Componente principal
════════════════════════════════════════════════════════ */
export default function FileModal({ file, onClose, onStatusChange }) {
  /* lista de arquivos do ZIP */
  const [contents,  setContents]  = useState(null);
  const [loadingZip, setLoadingZip] = useState(true);
  const [errorZip,   setErrorZip]   = useState(null);

  /* arquivo interno sendo visualizado */
  const [viewing,     setViewing]     = useState(null);
  const [entryData,   setEntryData]   = useState(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [errorEntry,   setErrorEntry]   = useState(null);

  /* domínio */
  const [domainType,      setDomainType]      = useState(null);
  const [domainValue,     setDomainValue]     = useState('');
  const [domainConfirmed, setDomainConfirmed] = useState(false);


  /* carrega lista do ZIP */
  useEffect(() => {
    getUploadContents(file._id)
      .then(d  => setContents(d.contents))
      .catch(e => setErrorZip(e.message))
      .finally(() => setLoadingZip(false));
  }, [file._id]);

  /* fecha com Esc */
  const handleKey = useCallback(e => {
    if (e.key === 'Escape') viewing ? closeEntry() : onClose();
  }, [onClose, viewing]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  /* abre um arquivo interno do ZIP */
  async function openEntry(entry) {
    if (entry.isDirectory) return;
    setViewing(entry);
    setLoadingEntry(true);
    setEntryData(null);
    setErrorEntry(null);

    try {
      const url = `/api/uploads/${file._id}/entry?path=${encodeURIComponent(entry.name)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo leer el archivo');

      const name = entry.name;
      if (isImage(name)) {
        const blob    = await res.blob();
        const dataUrl = URL.createObjectURL(blob);
        setEntryData({ type: 'image', content: dataUrl });
      } else if (isText(name)) {
        const text = await res.text();
        setEntryData({ type: 'text', content: text });
      } else {
        setEntryData({ type: 'unknown' });
      }
    } catch (e) {
      setErrorEntry(e.message);
    } finally {
      setLoadingEntry(false);
    }
  }

  async function handleDownloadExtracted() {
    try {
      await updateUploadStatus(file._id, 'En revisión');
      if (onStatusChange) onStatusChange('En revisión');
    } catch { /* silencioso */ }
    onClose();
  }

  function closeEntry() {
    if (entryData?.type === 'image') URL.revokeObjectURL(entryData.content);
    setViewing(null);
    setEntryData(null);
    setErrorEntry(null);
  }

  /* lista ordenada: pastas → arquivos */
  const folders = contents?.filter(e => e.isDirectory)  ?? [];
  const files   = contents?.filter(e => !e.isDirectory) ?? [];
  const sorted  = [...folders, ...files];

  /* ── render ── */
  return (
    <div className="modal-backdrop" onClick={viewing ? undefined : onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            {viewing ? (
              <button className="btn-back" onClick={closeEntry}>
                <IconBack /> Volver
              </button>
            ) : (
              <span className="modal-file-icon"><IconFile color="rgba(124,92,252,0.7)" /></span>
            )}
            <span className="modal-filename" title={viewing ? viewing.name : file.originalName}>
              {viewing ? displayName(viewing) : file.originalName}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Vista: lista do ZIP ── */}
        {!viewing && (
          <>
            <div className="modal-meta">
              <div className="meta-pill">
                <span className="meta-key">Tamaño</span>
                <span className="meta-val">{formatSize(file.size)}</span>
              </div>
              <div className="meta-pill">
                <span className="meta-key">Cargado</span>
                <span className="meta-val">{formatDate(file.createdAt)}</span>
              </div>
              <div className="meta-pill">
                <span className="meta-key">Estado</span>
                <span className="meta-val" style={{ color: STATUS_COLOR[file.status] }}>
                  {file.status}
                </span>
              </div>
              {!loadingZip && contents && (
                <div className="meta-pill">
                  <span className="meta-key">Contenido</span>
                  <span className="meta-val">{files.length} archivos · {folders.length} carpetas</span>
                </div>
              )}
            </div>

            {/* ── Domínio ── */}
            <div className="modal-domain-section">
              <div className="domain-radios">
                <label className="radio-option">
                  <input
                    type="radio" name="domainType" value="subdomain"
                    checked={domainType === 'subdomain'}
                    onChange={() => { setDomainType('subdomain'); setDomainValue(''); }}
                  />
                  <span>Sub dominio</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio" name="domainType" value="domain"
                    checked={domainType === 'domain'}
                    onChange={() => { setDomainType('domain'); setDomainValue(''); }}
                  />
                  <span>Dominio</span>
                </label>
                <button type="button" className="dns-help-btn">
                  <span className="dns-help-icon">?</span>
                  <span>Cómo configurar mis DNS</span>
                </button>
              </div>

              {domainType && (
                <div className="domain-input-wrap">
                  <input
                    className="domain-input"
                    type="text"
                    placeholder={domainType === 'subdomain' ? 'Ej: midominio' : 'Ej: midominio'}
                    value={domainValue}
                    onChange={e => { setDomainValue(e.target.value.replace(/\s/g, '')); setDomainConfirmed(false); }}
                  />
                  {domainValue && !domainConfirmed && (
                    <div
                      className="domain-preview"
                      title="Haz clic para usar este valor"
                      onClick={() => {
                        const full = domainType === 'subdomain'
                          ? `${domainValue}.awkfactory.com`
                          : domainValue;
                        setDomainValue(full);
                        setDomainConfirmed(true);
                      }}
                    >
                      {domainType === 'subdomain'
                        ? `${domainValue}.awkfactory.com`
                        : domainValue}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-section-label">Contenido del archivo — haz clic para abrir</div>

            <div className="modal-body">
              {loadingZip && (
                <div className="modal-state">
                  <div className="modal-spinner" /> Leyendo contenido del ZIP...
                </div>
              )}
              {errorZip && <div className="modal-state modal-state-error">{errorZip}</div>}
              {!loadingZip && !errorZip && sorted.length === 0 && (
                <div className="modal-state">El archivo ZIP está vacío</div>
              )}
              {!loadingZip && !errorZip && sorted.map((entry, idx) => (
                <div
                  key={idx}
                  className={`entry-row${entry.isDirectory ? ' entry-dir' : ' entry-file'}`}
                  style={{ paddingLeft: `${16 + depth(entry) * 18}px` }}
                  onClick={() => openEntry(entry)}
                  role={entry.isDirectory ? undefined : 'button'}
                  title={entry.isDirectory ? undefined : 'Abrir archivo'}
                >
                  <span className="entry-icon">
                    {entry.isDirectory ? <IconFolder /> : <IconFile />}
                  </span>
                  <span className="entry-name">{displayName(entry)}</span>
                  {!entry.isDirectory && (
                    <>
                      <span className="entry-size">{formatSize(entry.size)}</span>
                      <span className="entry-open-hint">Abrir →</span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* ── Footer: botão de download ── */}
            <div className="modal-footer">
              <button
                className="btn-download-extracted"
                onClick={handleDownloadExtracted}
                disabled={!domainValue.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Continuar
              </button>
            </div>
          </>
        )}

        {/* ── Vista: conteúdo de arquivo interno ── */}
        {viewing && (
          <div className="viewer-wrap">
            {loadingEntry && (
              <div className="modal-state">
                <div className="modal-spinner" /> Cargando archivo...
              </div>
            )}
            {errorEntry && (
              <div className="modal-state modal-state-error">{errorEntry}</div>
            )}
            {!loadingEntry && entryData?.type === 'text' && (
              <pre className="viewer-code">{entryData.content}</pre>
            )}
            {!loadingEntry && entryData?.type === 'image' && (
              <div className="viewer-image-wrap">
                <img src={entryData.content} alt={viewing.name} className="viewer-image" />
              </div>
            )}
            {!loadingEntry && entryData?.type === 'unknown' && (
              <div className="modal-state">
                Vista previa no disponible para este tipo de archivo
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
