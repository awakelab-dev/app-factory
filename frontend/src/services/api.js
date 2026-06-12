const BASE = '/api';

export async function getUploads() {
  const res = await fetch(`${BASE}/uploads`);
  if (!res.ok) throw new Error('Error al obtener los archivos');
  return res.json();
}

export async function updateUploadStatus(id, status) {
  const res = await fetch(`${BASE}/uploads/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Error al actualizar el estado');
  return res.json();
}

export async function deleteUpload(id) {
  const res = await fetch(`${BASE}/uploads/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar el archivo');
  return res.json();
}

export async function getUploadContents(id) {
  const res = await fetch(`${BASE}/uploads/${id}/contents`);
  if (!res.ok) throw new Error('Error al leer el contenido del ZIP');
  return res.json();
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE}/uploads`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al cargar el archivo');
  return data;
}
