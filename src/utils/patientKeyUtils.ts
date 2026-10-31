/**
 * Unified Patient Key & Prescription Check Identifier Generator
 * Standard format:
 * - Patient MRN: PS-<FirstInitial><LastInitial>-<3-digit-seq> (e.g. PS-FK-001 for Farhan Khalid)
 * - Check / Report ID: <PatientMRN>-<PrescriptionName> (e.g. PS-FK-001-Prescription_7)
 */

export function extractInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'FK';
  const clean = name.replace(/^(mr|ms|mrs|dr|prof)\.?\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0][0] || 'F';
    const last = parts[parts.length - 1][0] || 'K';
    return (first + last).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    return (parts[0][0] + 'X').toUpperCase();
  }
  return 'FK';
}

export function generatePatientMRN(name: string, existingPatients?: { mrn?: string }[]): string {
  const initials = extractInitials(name);
  const prefix = `PS-${initials}-`;

  let maxSeq = 0;
  if (existingPatients && Array.isArray(existingPatients)) {
    for (const p of existingPatients) {
      const m = String(p.mrn || '').toUpperCase();
      if (m.startsWith(prefix)) {
        const num = parseInt(m.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

export function cleanDocumentPrescriptionTag(filename?: string, fallbackIndex = 1): string {
  if (!filename || !filename.trim()) {
    return `Prescription_${fallbackIndex}`;
  }

  // Remove directory and extension
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, '').trim();

  // If it matches prescription patterns like prescription_7, prescription-7, rx-7, rx 7
  const matchRx = base.match(/(?:prescription|rx)[\s_.-]*([0-9a-zA-Z]+)/i);
  if (matchRx) {
    return `Prescription_${matchRx[1]}`;
  }

  // Normalize other names (replace spaces and dashes with underscore, capitalize)
  const normalized = base
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!normalized) return `Prescription_${fallbackIndex}`;

  // Capitalize first character of each segment
  return normalized
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('_');
}

export function generatePrescriptionCheckNumber(patientMrn: string, rawFileName?: string, fallbackIndex = 1): string {
  const cleanMrn = (patientMrn && patientMrn.trim()) ? (patientMrn.startsWith('PS-') ? patientMrn : `PS-${patientMrn.replace(/^PT-/, '')}`) : 'PS-FK-001';
  const tag = cleanDocumentPrescriptionTag(rawFileName, fallbackIndex);
  return `${cleanMrn}-${tag}`;
}

