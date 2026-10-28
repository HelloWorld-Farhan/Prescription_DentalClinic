import { syncDocumentToCloud, deleteDocumentFromCloud } from './cloudSyncService';

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

export function isAvatarFile(filenameOrUrl: string = ''): boolean {
  const lower = (filenameOrUrl || '').toLowerCase();
  return (
    lower.startsWith('avatar_') ||
    lower.includes('/avatar_') ||
    lower.includes('_avatar_') ||
    lower.includes('avatar-')
  );
}

export function isPrescriptionCheckFile(filenameOrUrl: string = ''): boolean {
  const lower = (filenameOrUrl || '').toLowerCase();
  return (
    lower.includes('rx_slip') ||
    lower.includes('prescription_') ||
    lower.includes('prescription-') ||
    lower.includes('camera_captured_rx') ||
    lower.startsWith('rx-') ||
    lower.includes('_rx_') ||
    lower.includes('cds_report')
  );
}



/**
 * Generates a non-colliding distinct filename if a file with the same name
 * already exists in the user's document history (e.g. file (1).pdf, file (2).pdf).
 */
export function getDistinctFilename(filename: string, userId: string = 'user-current'): string {
  const history = getDocumentHistory(userId);
  const existingNames = new Set(history.map((d) => d.filename.toLowerCase()));

  if (!existingNames.has(filename.toLowerCase())) {
    return filename;
  }

  const lastDot = filename.lastIndexOf('.');
  const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot !== -1 ? filename.slice(lastDot) : '';

  let counter = 1;
  while (existingNames.has(`${base} (${counter})${ext}`.toLowerCase())) {
    counter++;
  }

  return `${base} (${counter})${ext}`;
}

/**
 * Uploads a document or camera photo to Cloudflare R2 object storage.
 * Reads endpoints dynamically from Vite environment variables (zero hardcoded URLs).
 * Automatically resolves duplicate filenames with distinct non-colliding display names.
 */
export async function uploadToR2(
  file: File,
  userId: string = 'user-current',
  authorName: string = 'Authorized Clinician',
  customFilename?: string,
  saveRecord: boolean = true
): Promise<{ url: string; key: string; filename: string; size: number }> {
  const env = (import.meta as any).env || {};
  const apiUrl = (env.VITE_API_URL || '').replace(/\/$/, '');
  const r2PublicBase = (env.VITE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  const distinctFilename = customFilename || getDistinctFilename(file.name, userId);
  const sanitizedFilename = distinctFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
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
        const shouldSaveRecord = saveRecord && !isAvatarFile(distinctFilename) && !isAvatarFile(file.name) && !isPrescriptionCheckFile(distinctFilename) && !isPrescriptionCheckFile(file.name);
        if (shouldSaveRecord) {
          saveDocumentRecord({
            id: 'doc-' + timestamp,
            filename: distinctFilename,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            uploadedAt: new Date().toLocaleString(),
            storageUrl: finalUrl,
            userId,
            authorName,
            extractedRulesCount: 0,
            status: 'stored',
          });
        }

        return {
          url: finalUrl,
          key: data.key || fileKey,
          filename: distinctFilename,
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

  const shouldSaveFallback = saveRecord && !isAvatarFile(distinctFilename) && !isAvatarFile(file.name) && !isPrescriptionCheckFile(distinctFilename) && !isPrescriptionCheckFile(file.name);
  if (shouldSaveFallback) {
    saveDocumentRecord({
      id: 'doc-' + timestamp,
      filename: distinctFilename,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      uploadedAt: new Date().toLocaleString(),
      storageUrl: fallbackUrl,
      userId,
      authorName,
      extractedRulesCount: 0,
      status: 'stored',
    });
  }

  return {
    url: fallbackUrl,
    key: fileKey,
    filename: distinctFilename,
    size: file.size,
  };
}

export function getDocumentHistory(userId?: string): UploadedDocumentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (!raw) return [];
    let list: UploadedDocumentRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Auto-purge any avatar records or prescription checks mistakenly saved in knowledge document history
    const sanitizedList = list.filter((d) => 
      !isAvatarFile(d.filename) && 
      !isAvatarFile(d.storageUrl) &&
      !isPrescriptionCheckFile(d.filename) &&
      !isPrescriptionCheckFile(d.storageUrl)
    );
    if (sanitizedList.length !== list.length) {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(sanitizedList));
      list = sanitizedList;
    }

    if (userId) {
      return list.filter((d) => d.userId === userId || d.userId === 'user-current');
    }
    return list;
  } catch {
    return [];
  }
}

export function saveDocumentRecord(record: UploadedDocumentRecord): void {
  if (
    isAvatarFile(record.filename) ||
    isAvatarFile(record.storageUrl) ||
    isPrescriptionCheckFile(record.filename) ||
    isPrescriptionCheckFile(record.storageUrl)
  ) {
    return; // Avatars and patient prescription checks are never clinical rule documents
  }
  try {
    const existing = getDocumentHistory();
    existing.unshift(record);
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(existing.slice(0, 50)));
    syncDocumentToCloud(record);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_documents_updated'));
    }
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
    const index = existing.findIndex(
      (d) => (docId ? d.id === docId : false) || (storageUrl ? d.storageUrl === storageUrl : false)
    );
    if (index !== -1) {
      deletedDoc = existing[index];
      existing.splice(index, 1);
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(existing));
      if (deletedDoc?.id) {
        deleteDocumentFromCloud(deletedDoc.id);
      }
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

/**
 * Directly purges a file from Cloudflare R2 object storage by URL or key.
 */
export async function deleteFromR2(urlOrKey: string): Promise<boolean> {
  if (!urlOrKey) return false;
  const env = (import.meta as any).env || {};
  const apiUrl = (env.VITE_API_URL || '').replace(/\/$/, '');
  if (!apiUrl) return false;

  try {
    const formData = new FormData();
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
      formData.append('url', urlOrKey);
    } else {
      formData.append('key', urlOrKey);
    }

    const res = await fetch(`${apiUrl}/api/storage/delete`, {
      method: 'POST',
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

