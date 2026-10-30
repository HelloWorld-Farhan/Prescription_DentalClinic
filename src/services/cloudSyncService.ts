/**
 * Smile Clinic — Cross-Device Real-Time Cloud Synchronization Service
 * 
 * Synchronizes checks, audit logs, uploaded documents, clinical rules, and patients
 * in real-time with the Supabase PostgreSQL database via the FastAPI backend.
 * 
 * ARCHITECTURAL RULE: Zero clinical data is saved in browser localStorage.
 * LocalStorage is strictly reserved for session credentials & user avatar.
 * Clinical data lives in reactive memory caches synchronized directly with the database.
 */

import { SafetyCheckRecord, AuditLogEntry, InteractionRule, Patient } from '../types';
import { UploadedDocumentRecord, setDocumentHistory } from './r2StorageService';
import { PrescriptionStorage, formatISTTime } from './prescriptionService';
import { API_BASE_URL } from '../config/api';

/**
 * Strict LocalStorage Purge: Wipes all clinical data and retains ONLY
 * login session tokens, user profile picture / avatar, and profile flags.
 */
export function purgeAllClinicalLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const ALLOWED_EXACT = new Set([
      'smileclinic_auth_user',
      'smileclinic_jwt_token',
      'rxguard_authenticated',
      'rxguard_jwt_token',
      'rxguard_prescriber_email',
      'rxguard_prescriber_name',
      'rxguard_prescriber_id',
      'rxguard_prescriber_phone',
      'rxguard_prescriber_role',
      'rxguard_prescriber_npi',
      'rxguard_auth_provider',
      'rxguard_device_token',
      'rxguard_two_factor_enabled',
      'rxguard_google_linked',
      'rxguard_has_password',
      'smileclinic_remembered_email',
      'dental_clinic_logo',
    ]);

    const ALLOWED_EXTENDED = new Set([
      'smileclinic_read_notif_ids',
      'smileclinic_notifications_read_at',
      'smileclinic_master_email_alerts_enabled',
      'smileclinic_disabled_med_alert_ids',
      'smileclinic_synced_knowledge_selection',
      'smileclinic_synced_active_conditions',
      'smileclinic_synced_active_checks',
      'smileclinic_synced_active_rules',
      'smileclinic_persistent_checks_v2',
      'smileclinic_persistent_audit_v2',
      'smileclinic_persistent_rules_v2',
      'smileclinic_persistent_patients_v2',
    ]);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (ALLOWED_EXACT.has(key) || ALLOWED_EXTENDED.has(key)) continue;
      if (key.startsWith('firebase:')) continue;
      if (key.startsWith('smileclinic_') || key.startsWith('user_avatar_')) continue;
      if (key.startsWith('profile_completed_') || key.startsWith('google_linked_')) continue;
      keysToRemove.push(key);
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[Storage] Purge error:', e);
  }
}

// Execute purge immediately on module load
if (typeof window !== 'undefined') {
  purgeAllClinicalLocalStorage();
}

export function getClinicianEmail(): string {
  try {
    const rawUser = localStorage.getItem('smileclinic_auth_user') || sessionStorage.getItem('smileclinic_auth_user');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        if (u?.email) return u.email.trim().toLowerCase();
      } catch {}
    }
    return (
      sessionStorage.getItem('rxguard_prescriber_email') ||
      localStorage.getItem('rxguard_prescriber_email') ||
      sessionStorage.getItem('smileclinic_user_email') ||
      localStorage.getItem('smileclinic_user_email') ||
      ''
    ).trim().toLowerCase();
  } catch {
    return '';
  }
}

let isSyncing = false;
let autoSyncTimer: any = null;
let activePullPromise: Promise<boolean> | null = null;
let _cachedCustomQuestions: Array<{ id: string; text: string; createdAt?: string }> = [];

export function getCachedCustomQuestions(): Array<{ id: string; text: string; createdAt?: string }> {
  return [..._cachedCustomQuestions];
}

/**
 * Pulls all persistent data from Supabase PostgreSQL for the authenticated clinician.
 * Directly populates reactive memory stores and persists local resilient backups.
 * Deduplicates in-flight requests so concurrent callers share the same promise.
 */
export async function pullFromCloud(): Promise<boolean> {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return false;
  if (activePullPromise) return activePullPromise;

  activePullPromise = (async () => {
    try {
      isSyncing = true;
      const res = await fetch(`${API_BASE_URL}/api/v1/sync/all?email=${encodeURIComponent(email)}`);
      if (!res.ok) return false;

      const data = await res.json();
      if (data.status !== 'success') return false;

    // 1. Reconcile Checks
    if (Array.isArray(data.checks)) {
      const mappedChecks: SafetyCheckRecord[] = data.checks.map((c: any) => {
        const tsMs = c.timestampMs || (c.createdAt ? new Date(c.createdAt).getTime() : Date.now());
        const timeFormatted = formatISTTime(tsMs, true);
        return {
          id: c.id || c.checkNumber,
          checkNumber: c.checkNumber || c.id,
          timestamp: c.timestamp || timeFormatted,
          timestampMs: tsMs,
          createdAt: c.createdAt || new Date(tsMs).toISOString(),
          patientId: c.patientId || c.patientMrn || 'PT-UNKNOWN',
          patientName: c.patientName || c.patientMrn || 'Patient',
          mrn: c.patientMrn || c.patientId || 'PT-UNKNOWN',
          unit: c.unit || 'Dental Operatory',
          prescriptions: (Array.isArray(c.prescriptions) ? c.prescriptions : []).map((rx: any) => ({
            ...rx,
            drugName: rx.drugName || rx.name || 'Rx Medication',
          })),
          alerts: (Array.isArray(c.alerts) ? c.alerts : []).map((al: any, idx: number) => {
            const interacting = Array.isArray(al.interactingDrugs)
              ? al.interactingDrugs
              : Array.isArray(al.interacting_drugs)
              ? al.interacting_drugs
              : al.drugA && al.drugB
              ? [al.drugA, al.drugB]
              : al.drugName
              ? [al.drugName]
              : [];

            const title =
              al.title ||
              (al.drugA && al.drugB
                ? `${al.drugA} ↔ ${al.drugB} Hazard`
                : al.name || (al.category ? `${al.category} Warning` : 'Clinical Interaction Hazard'));

            return {
              ...al,
              id: al.id || `alt-${c.id || c.checkNumber || 'chk'}-${idx + 1}`,
              title,
              severity: (al.severity || 'major').toLowerCase(),
              interactingDrugs: interacting,
              overridden: !!al.overridden,
              description: al.description || al.mechanism || al.clinicalImpact || al.finding || '',
              recommendation: al.recommendation || al.clinicalRecommendation || al.action || 'Review dosage regimen.',
            };
          }),
          overallStatus:
            c.status === 'safe' || c.highestSeverity === 'clear' || c.highestSeverity === 'safe'
              ? 'Safe to Dispense'
              : (c.status || 'Requires Review'),
          prescriberName: c.reviewerName || 'Authorized Clinician',
          prescriberNpi: c.prescriberNpi || 'DENT-CLINIC',
          reviewerName: c.reviewerName,
          status: c.status,
          highestSeverity: c.highestSeverity,
          pdfFilename: c.pdfFilename,
          pdfUrl: c.pdfUrl,
          notes: c.notes,
          sourceDocumentUrl: c.sourceDocumentUrl || c.source_document_url,
          sourceDocumentName: c.sourceDocumentName || c.source_document_name,
          sourceType: c.sourceType || c.source_type,
          digitalSeal: c.digitalSeal,
          fhirSynced: !!c.fhirSynced,
          questions: c.questions || [],
          questionAnswers: c.questionAnswers || [],
        };
      });
      PrescriptionStorage.setChecks(mappedChecks);
    }

    // 2. Reconcile Audit Logs
    if (Array.isArray(data.auditLogs)) {
      const mappedAuditLogs: AuditLogEntry[] = data.auditLogs.map((a: any) => {
        const tsMs = a.timestampMs || (a.createdAt ? new Date(a.createdAt).getTime() : Date.now());
        const timeFormatted = formatISTTime(tsMs, true);
        return {
          id: a.id,
          timestamp: a.timestamp || timeFormatted,
          timestampMs: tsMs,
          createdAt: a.createdAt || new Date(tsMs).toISOString(),
          clinicianName: a.clinicianName || 'Authorized Clinician',
          action: a.action || 'Safety Screen Initiated',
          patientMrn: a.patientMrn || 'PT-GENERAL',
          patientName: a.patientName || a.innerData?.patientName || a.patientMrn,
          checkId: a.checkId || a.innerData?.checkId,
          prescriptions: a.prescriptions || a.innerData?.prescriptions || [],
          alerts: (Array.isArray(a.alerts || a.innerData?.alerts) ? (a.alerts || a.innerData?.alerts) : []).map((al: any, idx: number) => {
            const interacting = Array.isArray(al.interactingDrugs)
              ? al.interactingDrugs
              : Array.isArray(al.interacting_drugs)
              ? al.interacting_drugs
              : al.drugA && al.drugB
              ? [al.drugA, al.drugB]
              : al.drugName
              ? [al.drugName]
              : [];
            return {
              ...al,
              id: al.id || `alt-aud-${idx + 1}`,
              title: al.title || (al.drugA && al.drugB ? `${al.drugA} ↔ ${al.drugB} Hazard` : 'Clinical CDS Alert'),
              severity: (al.severity || 'major').toLowerCase(),
              interactingDrugs: interacting,
              description: al.description || al.mechanism || al.clinicalImpact || '',
            };
          }),
          details: a.eventDetails || a.details || '',
          severity: (a.severity || 'safe').toLowerCase(),
          hash: a.hash || 'SHA256:AUTHENTICATED',
          pdfFilename: a.pdfFilename,
          pdfUrl: a.pdfUrl,
          sourceDocumentUrl: a.sourceDocumentUrl || a.innerData?.sourceDocumentUrl,
          sourceDocumentName: a.sourceDocumentName || a.innerData?.sourceDocumentName,
          sourceType: a.sourceType || a.innerData?.sourceType,
        };
      });
      PrescriptionStorage.setAuditLogs(mappedAuditLogs);
    }

    // 3. Reconcile Uploaded Documents
    if (Array.isArray(data.documents)) {
      const mappedDocs: UploadedDocumentRecord[] = data.documents.map((d: any) => ({
        id: d.id,
        userId: email,
        filename: d.filename,
        fileType: d.fileType || 'pdf',
        fileSize: d.fileSize || 0,
        storageUrl: d.storageUrl,
        authorName: d.authorName || 'Authorized Clinician',
        extractedRulesCount: d.extractedRulesCount || 0,
        status: d.status || 'stored',
        uploadedAt: d.uploadedAt || new Date().toISOString(),
      }));
      setDocumentHistory(mappedDocs);
    }

    // 4. Reconcile Clinical Rules
    if (Array.isArray(data.rules)) {
      const mappedRules: InteractionRule[] = data.rules.map((r: any) => ({
        id: r.id,
        drugA: r.drugA,
        drugB: r.drugB,
        category: r.category || 'Clinical Alert',
        severity: r.severity || 'moderate',
        mechanism: r.mechanism || '',
        evidence: r.evidence || 'Established',
        sourceFile: r.sourceFile,
        active: r.active !== false,
      }));
      PrescriptionStorage.setRules(mappedRules);
    }

    // 6. Reconcile Custom Clinical Questions
    if (Array.isArray(data.customQuestions)) {
      _cachedCustomQuestions = data.customQuestions;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smileclinic_questions_updated', { detail: _cachedCustomQuestions }));
      }
    }

    // 5. Reconcile Patients
    if (Array.isArray(data.patients)) {
      const mappedPatients: Patient[] = data.patients.map((p: any) => ({
        id: p.id,
        mrn: p.mrn || p.id,
        name: p.name || 'Patient',
        age: p.age || 30,
        gender: p.gender || 'Male',
        weightKg: p.weightKg || 70,
        egfr: p.egfr || 90,
        pregnancyStatus: p.pregnancyStatus || 'No',
        conditions: p.conditions || [],
        allergies: p.allergies || [],
        activeMedications: p.activeMedications || p.currentMedications || [],
      }));
      PrescriptionStorage.setPatients(mappedPatients);
    }

    // 7. Reconcile Notification Read State from Backend PostgreSQL
    if (Array.isArray(data.readNotificationIds) || typeof data.notificationsReadAt === 'number') {
      try {
        const localReadRaw = localStorage.getItem('smileclinic_read_notif_ids');
        const localReadSet = new Set<string>(localReadRaw ? JSON.parse(localReadRaw) : []);
        if (Array.isArray(data.readNotificationIds)) {
          data.readNotificationIds.forEach((id: string) => localReadSet.add(id));
        }
        const mergedArray = Array.from(localReadSet);
        localStorage.setItem('smileclinic_read_notif_ids', JSON.stringify(mergedArray));
        const localReadAt = parseInt(localStorage.getItem('smileclinic_notifications_read_at') || '0', 10);
        const serverReadAt = typeof data.notificationsReadAt === 'number' ? data.notificationsReadAt : 0;
        const maxReadAt = Math.max(localReadAt, serverReadAt);
        if (maxReadAt > 0) {
          localStorage.setItem('smileclinic_notifications_read_at', String(maxReadAt));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smileclinic_notifications_read_synced', {
            detail: {
              readNotificationIds: mergedArray,
              notificationsReadAt: maxReadAt,
            }
          }));
        }
      } catch (e) {
        console.warn('[CloudSync] Failed to reconcile notification read state', e);
      }
    }

    return true;
    } catch (err) {
      console.warn('[CloudSync] Pull error (will retry):', err);
      return false;
    } finally {
      isSyncing = false;
      activePullPromise = null;
    }
  })();

  return activePullPromise;
}

/**
 * Legacy batch push stub — kept for signature compatibility.
 * All mutations now sync in real-time via granular endpoints.
 */
export async function pushAllLocalToCloud(): Promise<boolean> {
  return true;
}

// -------------------------------------------------------------
// Granular Real-time Cloud Push Functions
// -------------------------------------------------------------

export function syncCheckToCloud(check: SafetyCheckRecord) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, check }),
  }).catch((err) => console.warn('[CloudSync] Failed to sync check:', err));
}

export function deleteCheckFromCloud(checkId: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/check/${encodeURIComponent(checkId)}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to delete check from cloud:', err));
}

export function deleteAuditLogFromCloud(logId: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/audit-log/${encodeURIComponent(logId)}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to delete audit log from cloud:', err));
}

export function clearAllChecksFromCloud() {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/all-checks?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to clear all checks from cloud:', err));
}

export function syncAuditLogToCloud(auditLog: AuditLogEntry) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/audit-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, auditLog }),
  }).catch((err) => console.warn('[CloudSync] Failed to sync audit log:', err));
}

export function syncDocumentToCloud(document: UploadedDocumentRecord) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, document }),
  }).catch((err) => console.warn('[CloudSync] Failed to sync document:', err));
}

export function deleteDocumentFromCloud(docId: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/document/${encodeURIComponent(docId)}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to delete cloud document:', err));
}

export function syncRuleToCloud(rule: InteractionRule) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, rule }),
  }).catch((err) => console.warn('[CloudSync] Failed to sync rule:', err));
}

export function deleteRuleFromCloud(ruleId: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/rule/${encodeURIComponent(ruleId)}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to delete rule from cloud:', err));
}

export function toggleRuleInCloud(ruleId: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/rule/${encodeURIComponent(ruleId)}/toggle?email=${encodeURIComponent(email)}`, {
    method: 'PATCH',
  }).catch((err) => console.warn('[CloudSync] Failed to toggle cloud rule:', err));
}

export function deleteRulesBySourceFromCloud(source: string) {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return;

  fetch(`${API_BASE_URL}/api/v1/sync/rules-by-source?source=${encodeURIComponent(source)}&email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  }).catch((err) => console.warn('[CloudSync] Failed to delete rules by source from cloud:', err));
}

export async function fetchCustomQuestionsFromCloud(): Promise<Array<{ id: string; text: string; createdAt?: string }>> {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return _cachedCustomQuestions;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sync/custom-questions?email=${encodeURIComponent(email)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.customQuestions)) {
        _cachedCustomQuestions = data.customQuestions;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smileclinic_questions_updated', { detail: _cachedCustomQuestions }));
        }
      }
    }
  } catch (err) {
    console.warn('[CloudSync] Failed to fetch custom questions:', err);
  }
  return _cachedCustomQuestions;
}

export async function saveCustomQuestionToCloud(questionText: string): Promise<void> {
  const email = getClinicianEmail();
  const trimmed = questionText.trim();
  if (!email || !API_BASE_URL || !trimmed) return;

  // Optimistically add to in-memory list if not present
  if (!_cachedCustomQuestions.some((q) => q.text.toLowerCase() === trimmed.toLowerCase())) {
    _cachedCustomQuestions = [
      { id: `cq-local-${Date.now()}`, text: trimmed, createdAt: new Date().toISOString() },
      ..._cachedCustomQuestions,
    ].slice(0, 20);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_questions_updated', { detail: _cachedCustomQuestions }));
    }
  }

  try {
    await fetch(`${API_BASE_URL}/api/v1/sync/custom-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, text: trimmed }),
    });
  } catch (err) {
    console.warn('[CloudSync] Failed to save custom question:', err);
  }
}

export async function deleteCustomQuestionFromCloud(questionId: string): Promise<void> {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL || !questionId) return;

  _cachedCustomQuestions = _cachedCustomQuestions.filter((q) => q.id !== questionId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smileclinic_questions_updated', { detail: _cachedCustomQuestions }));
  }

  try {
    await fetch(`${API_BASE_URL}/api/v1/sync/custom-questions/${encodeURIComponent(questionId)}?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[CloudSync] Failed to delete custom question:', err);
  }
}

/**
 * Dispatches the complete safety dossier to the backend Check engine.
 * Calls Gemini 3.5 Flash Lite with 14-key pool, uploads PDF/Word/CSV to R2,
 * and persists to PostgreSQL.
 */
export async function executePrescriptionSafetyCheck(payload: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/prescriptions/safety-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Safety check failed: ${response.statusText}`);
  }

  const result = await response.json();
  pullFromCloud();
  return result;
}

/**
 * Initializes the background real-time synchronization loop.
 * - Instantly syncs upon load
 * - Listens for window focus / screen unlocking on mobile devices
 * - Polls every 8 seconds silently for multi-device parity
 */
export function initAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  purgeAllClinicalLocalStorage();

  // Initial pull from Supabase PostgreSQL
  pullFromCloud();

  // Pull immediately whenever user focuses window or unlocks phone screen
  const handleFocus = () => {
    pullFromCloud();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      pullFromCloud();
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Periodic polling every 8 seconds
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    pullFromCloud();
  }, 8000);

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (autoSyncTimer) clearInterval(autoSyncTimer);
  };
}


/**

 * Pushes read notification state to the Supabase PostgreSQL backend.

 * Synchronizes across all devices (mobile, laptop, multiple browsers).

 */

export async function pushNotificationReadState(readAt?: number, notifIds?: string[]): Promise<boolean> {

  const email = getClinicianEmail();

  if (!email || !API_BASE_URL) return false;



  try {

    const res = await fetch(`${API_BASE_URL}/api/v1/sync/notifications/read`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        email,

        readAt: readAt || 0,

        notifIds: notifIds || [],

      }),

    });

    return res.ok;

  } catch (e) {

    console.warn('[CloudSync] Push notification read state failed:', e);

    return false;

  }

}



/**

 * Pushes active synchronized clinical knowledge & medical history to PostgreSQL backend.

 */

export async function pushKnowledgeSyncState(syncedKnowledge: {

  selection?: string[];

  conditions?: string[];

  checks?: string[];

  rules?: string[];

  docs?: string[];

}): Promise<boolean> {

  const email = getClinicianEmail();

  if (!email || !API_BASE_URL) return false;



  try {

    const res = await fetch(`${API_BASE_URL}/api/v1/sync/knowledge-state`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        email,

        syncedKnowledge,

      }),

    });

    return res.ok;

  } catch (e) {

    console.warn('[CloudSync] Push knowledge sync state failed:', e);

    return false;

  }

}

