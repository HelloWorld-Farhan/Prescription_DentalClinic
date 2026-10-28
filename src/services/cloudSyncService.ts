/**
 * Smile Clinic — Cross-Device Real-Time Cloud Synchronization Service
 * 
 * Synchronizes checks, audit logs, uploaded documents, clinical rules, and patients
 * in real-time with the Supabase PostgreSQL database via the FastAPI backend.
 * Ensures data created on one device (e.g. desktop) appears instantly on another (e.g. mobile phone).
 */

import { SafetyCheckRecord, AuditLogEntry, InteractionRule, Patient } from '../types';
import { UploadedDocumentRecord } from './storageService';

import { API_BASE_URL } from '../config/api';

const STORAGE_KEYS = {
  CHECKS: 'smileclinic_checks',
  AUDIT: 'smileclinic_audit',
  RULES: 'smileclinic_rules_v6',
  DOCUMENTS: 'smileclinic_uploaded_documents_v1',
  PATIENTS: 'smileclinic_patients_v3',
};

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

/**
 * Pulls all persistent data from Supabase PostgreSQL for the current clinician.
 * Merges new items into local state without overwriting newer local edits.
 */
export async function pullFromCloud(): Promise<boolean> {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL || isSyncing) return false;

  try {
    isSyncing = true;
    const res = await fetch(`${API_BASE_URL}/api/v1/sync/all?email=${encodeURIComponent(email)}`);
    if (!res.ok) return false;

    const data = await res.json();
    if (data.status !== 'success') return false;

    let hasChecksChanged = false;
    let hasAuditChanged = false;
    let hasDocsChanged = false;
    let hasRulesChanged = false;
    let hasPatientsChanged = false;

    // 1. Reconcile Checks
    if (Array.isArray(data.checks)) {
      const localChecksRaw = localStorage.getItem(STORAGE_KEYS.CHECKS);
      const localChecks: SafetyCheckRecord[] = localChecksRaw ? JSON.parse(localChecksRaw) : [];
      const localMap = new Map(localChecks.map(c => [c.id || c.checkNumber, c]));

      data.checks.forEach((cloudCheck: any) => {
        const id = cloudCheck.id || cloudCheck.checkNumber;
        if (!id) return;
        if (!localMap.has(id)) {
          localMap.set(id, cloudCheck);
          hasChecksChanged = true;
        }
      });

      if (hasChecksChanged) {
        const mergedChecks = Array.from(localMap.values()).sort(
          (a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)
        );
        localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(mergedChecks));
        window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
      }
    }

    // 2. Reconcile Audit Logs
    if (Array.isArray(data.auditLogs)) {
      const localAuditRaw = localStorage.getItem(STORAGE_KEYS.AUDIT);
      const localAudit: AuditLogEntry[] = localAuditRaw ? JSON.parse(localAuditRaw) : [];
      const auditMap = new Map(localAudit.map(a => [a.id, a]));

      data.auditLogs.forEach((cloudLog: any) => {
        if (!cloudLog.id) return;
        if (!auditMap.has(cloudLog.id)) {
          auditMap.set(cloudLog.id, cloudLog);
          hasAuditChanged = true;
        }
      });

      if (hasAuditChanged) {
        const mergedAudit = Array.from(auditMap.values()).sort(
          (a, b) => (b.timestampMs || 0) - (a.timestampMs || 0)
        );
        localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(mergedAudit));
        window.dispatchEvent(new CustomEvent('smileclinic_audit_updated'));
      }
    }

    // 3. Reconcile Uploaded Documents
    if (Array.isArray(data.documents)) {
      const localDocsRaw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      const localDocs: UploadedDocumentRecord[] = localDocsRaw ? JSON.parse(localDocsRaw) : [];
      const docMap = new Map(localDocs.map(d => [d.id, d]));

      data.documents.forEach((cloudDoc: any) => {
        if (!cloudDoc.id) return;
        if (!docMap.has(cloudDoc.id)) {
          docMap.set(cloudDoc.id, cloudDoc);
          hasDocsChanged = true;
        }
      });

      if (hasDocsChanged) {
        const mergedDocs = Array.from(docMap.values());
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(mergedDocs));
        window.dispatchEvent(new CustomEvent('smileclinic_documents_updated'));
      }
    }

    // 4. Reconcile Clinical Rules
    if (Array.isArray(data.rules)) {
      const localRulesRaw = localStorage.getItem(STORAGE_KEYS.RULES);
      const localRules: InteractionRule[] = localRulesRaw ? JSON.parse(localRulesRaw) : [];
      const ruleMap = new Map(localRules.map(r => [r.id, r]));

      data.rules.forEach((cloudRule: any) => {
        if (!cloudRule.id) return;
        const local = ruleMap.get(cloudRule.id);
        if (!local) {
          ruleMap.set(cloudRule.id, cloudRule);
          hasRulesChanged = true;
        } else if (local.active !== cloudRule.active) {
          local.active = cloudRule.active;
          hasRulesChanged = true;
        }
      });

      if (hasRulesChanged) {
        const mergedRules = Array.from(ruleMap.values());
        localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(mergedRules));
        window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
      }
    }

    // 5. Reconcile Patients
    if (Array.isArray(data.patients)) {
      const localPatientsRaw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      const localPatients: Patient[] = localPatientsRaw ? JSON.parse(localPatientsRaw) : [];
      const patientMap = new Map(localPatients.map(p => [p.id, p]));

      data.patients.forEach((cloudPatient: any) => {
        if (!cloudPatient.id) return;
        if (!patientMap.has(cloudPatient.id)) {
          patientMap.set(cloudPatient.id, cloudPatient);
          hasPatientsChanged = true;
        }
      });

      if (hasPatientsChanged) {
        const mergedPatients = Array.from(patientMap.values());
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(mergedPatients));
        window.dispatchEvent(new CustomEvent('smileclinic_patients_updated'));
      }
    }

    return true;
  } catch (err) {
    console.warn('[CloudSync] Pull error (will retry):', err);
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * Pushes all local records to the Supabase database.
 * Used on login or when syncing a device with previously stored local records.
 */
export async function pushAllLocalToCloud(): Promise<boolean> {
  const email = getClinicianEmail();
  if (!email || !API_BASE_URL) return false;

  try {
    const checks: SafetyCheckRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKS) || '[]');
    const auditLogs: AuditLogEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT) || '[]');
    const documents: UploadedDocumentRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENTS) || '[]');
    const rules: InteractionRule[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.RULES) || '[]');
    const patients: Patient[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PATIENTS) || '[]');

    const res = await fetch(`${API_BASE_URL}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        checks,
        auditLogs,
        documents,
        rules,
        patients,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('[CloudSync] Batch push error:', err);
    return false;
  }
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

/**
 * Initializes the background real-time synchronization loop.
 * - Instantly syncs upon load
 * - Listens for window focus / screen unlocking on mobile devices
 * - Polls every 15 seconds silently
 */
export function initAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Initial pull and reconcile
  pullFromCloud().then(() => {
    pushAllLocalToCloud();
  });

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

  // Periodic polling every 15 seconds
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    pullFromCloud();
  }, 15000);

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (autoSyncTimer) clearInterval(autoSyncTimer);
  };
}

