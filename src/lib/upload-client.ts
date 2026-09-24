// Browser-side upload used by the submit/resubmit forms.
//
// Preferred path: ask the server for a presigned URL, then PUT the file straight
// to storage (R2) — the server never holds the file in memory, and we get real
// progress. If that path is unavailable for any reason (storage not configured,
// bucket CORS not set, network hiccup) we fall back to the classic multipart
// POST /api/upload, so an upload never fails just because of the fast path.

export type UploadResult = { url: string; fileKind: string; fileType: string; fileSize: number };

type Progress = (fraction: number) => void;

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) || `خطأ ${res.status}` }; }
}

function putDirect(uploadUrl: string, file: File, contentType: string, onProgress?: Progress): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.send(file);
  });
}

function postToServer(file: File, onProgress?: Progress): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(xhr.responseText); } catch { data = { error: xhr.responseText.slice(0, 200) || `خطأ ${xhr.status}` }; }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data as unknown as UploadResult);
      else reject(new Error(String(data.error || `فشل الرفع (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error('تعذّر رفع الملف — تحقق من الاتصال وحاول مجددًا.'));
    xhr.send(fd);
  });
}

export async function uploadFile(file: File, onProgress?: Progress): Promise<UploadResult> {
  let presign: Response | null = null;
  try {
    presign = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    });
  } catch {
    presign = null;
  }
  if (presign && presign.ok) {
    const p = await readJson(presign);
    if (p.uploadUrl && p.url && (await putDirect(String(p.uploadUrl), file, String(p.contentType), onProgress))) {
      return { url: String(p.url), fileKind: String(p.fileKind), fileType: String(p.fileType), fileSize: Number(p.fileSize) };
    }
  } else if (presign && presign.status !== 409) {
    // A real validation answer (wrong type, too large, signed out) — show it
    // instead of retrying the same file through the fallback.
    const p = await readJson(presign);
    throw new Error(String(p.error || `فشل الرفع (${presign.status})`));
  }
  onProgress?.(0);
  return postToServer(file, onProgress);
}
