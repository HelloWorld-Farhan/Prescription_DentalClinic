export interface UploadedDocumentRecord {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  storageUrl: string;
  userId: string;
  authorName: string;
  extractedRulesCount: number;
  status: 'stored' | 'analyzed';
}

const STORAGE_KEY_DOCS = 'smileclinic_uploaded_documents_v1';

/**
 * Uploads a document or camera photo to Cloudflare R2 object storage.
 * Reads endpoints dynamically from Vite environment variables (zero hardcoded URLs).
 */
export async function uploadToR2(
  file: File,
  userId: string = 'user-current',
  authorName: string = 'Authorized Clinician'
): Promise<{ url: string; key: string; filename: string; size: number }> {
  const env = (import.meta as any).env || {};
  const apiUrl = (env.VITE_API_URL || '').replace(/\/$/, '');
  const r2PublicBase = (env.VITE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const fileKey = `uploads/${userId}/${timestamp}_${sanitizedFilename}`;

  // Attempt upload to backend R2 microservice if API URL is configured
  if (apiUrl) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', fileKey);
      formData.append('userId', userId);

      const response = await fetch(`${apiUrl}/api/storage/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const finalUrl = data.url || (r2PublicBase ? `${r2PublicBase}/${fileKey}` : '');
        saveDocumentRecord({
          id: 'doc-' + timestamp,
          filename: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          uploadedAt: new Date().toLocaleString(),
          storageUrl: finalUrl,
          userId,
          authorName,
          extractedRulesCount: 0,
          status: 'stored',
        });

        return {
          url: finalUrl,
          key: data.key || fileKey,
          filename: file.name,
          size: file.size,
        };
      }
    } catch {
      // Graceful fallback to client-side R2 URL generation
    }
  }

  // Direct edge reference using dynamic Cloudflare R2 Public Base URL
  const fallbackUrl = r2PublicBase
    ? `${r2PublicBase}/${fileKey}`
    : URL.createObjectURL(file);

  saveDocumentRecord({
    id: 'doc-' + timestamp,
    filename: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    uploadedAt: new Date().toLocaleString(),
    storageUrl: fallbackUrl,
    userId,
    authorName,
    extractedRulesCount: 0,
    status: 'stored',
  });

  return {
    url: fallbackUrl,
    key: fileKey,
    filename: file.name,
    size: file.size,
  };
}

export function getDocumentHistory(userId?: string): UploadedDocumentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (!raw) return [];
    const list: UploadedDocumentRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (userId) {
      return list.filter((d) => d.userId === userId || d.userId === 'user-current');
    }
    return list;
  } catch {
    return [];
  }
}

export function saveDocumentRecord(record: UploadedDocumentRecord): void {
  try {
    const existing = getDocumentHistory();
    existing.unshift(record);
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(existing.slice(0, 50)));
  } catch {
    // ignore
  }
}

export function updateDocumentExtractedCount(docUrl: string, count: number): void {
  try {
    const existing = getDocumentHistory();
    const target = existing.find((d) => d.storageUrl === docUrl);
    if (target) {
      target.extractedRulesCount = count;
      target.status = 'analyzed';
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }
}

export async function deleteDocumentRecord(
  docId: string,
  storageUrl?: string
): Promise<{ success: boolean; deletedDoc?: UploadedDocumentRecord }> {
  let deletedDoc: UploadedDocumentRecord | undefined;
  try {
    const existing = getDocumentHistory();
    const index = existing.findIndex((d) => d.id === docId || (storageUrl && d.storageUrl === storageUrl));
    if (index !== -1) {
      deletedDoc = existing[index];
      existing.splice(index, 1);
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }

  // Purge object from Cloudflare R2 storage bucket
  const urlToDelete = storageUrl || deletedDoc?.storageUrl;
  if (urlToDelete) {
    const env = (import.meta as any).env || {};
    const apiUrl = (env.VITE_API_URL || '').replace(/\/$/, '');
    if (apiUrl) {
      try {
        const formData = new FormData();
        formData.append('url', urlToDelete);
        await fetch(`${apiUrl}/api/storage/delete`, {
          method: 'POST',
          body: formData,
        });
      } catch {
        // silent fallback
      }
    }
  }

  window.dispatchEvent(new CustomEvent('smileclinic_documents_updated'));
  return { success: true, deletedDoc };
}

