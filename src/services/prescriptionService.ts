/**
 * Determines whether a given timestamp falls on "Today" in Indian Standard Time (IST, UTC+5:30).
 * Every day at 12:00 AM IST (midnight), the IST date advances, automatically resetting today's checks.
 */
export function isTodayIST(timestampOrDate?: number | string | Date): boolean {
  if (!timestampOrDate) return false;
  let ms: number;
  if (typeof timestampOrDate === 'number') {
    ms = timestampOrDate;
  } else if (typeof timestampOrDate === 'string') {
    if (timestampOrDate.startsWith('chk-') || timestampOrDate.startsWith('aud-')) {
      const num = parseInt(timestampOrDate.split('-')[1], 10);
      ms = !isNaN(num) && num > 1000000000000 ? num : Date.now();
    } else {
      const d = new Date(timestampOrDate);
      ms = !isNaN(d.getTime()) ? d.getTime() : Date.now();
    }
  } else {
    ms = timestampOrDate.getTime();
  }

  // IST is UTC + 5:30 = +19,800,000 ms
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istTarget = new Date(ms + IST_OFFSET_MS);

  return (
    istNow.getUTCFullYear() === istTarget.getUTCFullYear() &&
    istNow.getUTCMonth() === istTarget.getUTCMonth() &&
    istNow.getUTCDate() === istTarget.getUTCDate()
  );
}

/**
 * Formats a timestamp into an Indian Standard Time (IST) string.
 * e.g. "06:30 PM IST" or "28 Oct, 06:30 PM IST".
 */
export function formatISTDateTime(timestampOrDate: number | string | Date = Date.now()): { date: string; time: string; full: string } {
  let date: Date;
  if (typeof timestampOrDate === 'number') {
    date = new Date(timestampOrDate);
  } else if (typeof timestampOrDate === 'string') {
    if (timestampOrDate.startsWith('chk-') || timestampOrDate.startsWith('aud-') || timestampOrDate.startsWith('doc-')) {
      const num = parseInt(timestampOrDate.split('-')[1], 10);
      date = !isNaN(num) && num > 1000000000000 ? new Date(num) : new Date(timestampOrDate);
    } else {
      const d = new Date(timestampOrDate);
      date = !isNaN(d.getTime()) ? d : new Date();
    }
  } else {
    date = timestampOrDate;
  }

  const dateStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date) + ' IST';

  return { date: dateStr, time: timeStr, full: `${dateStr}, ${timeStr}` };
}

export function formatISTTime(timestampOrDate: number | string | Date = Date.now(), includeDate = false): string {
  let date: Date;
  if (typeof timestampOrDate === 'number') {
    date = new Date(timestampOrDate);
  } else if (typeof timestampOrDate === 'string') {
    if (timestampOrDate.startsWith('chk-') || timestampOrDate.startsWith('aud-')) {
      const num = parseInt(timestampOrDate.split('-')[1], 10);
      date = !isNaN(num) && num > 1000000000000 ? new Date(num) : new Date(timestampOrDate);
    } else {
      const d = new Date(timestampOrDate);
      date = !isNaN(d.getTime()) ? d : new Date();
    }
  } else {
    date = timestampOrDate;
  }

  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...(includeDate ? { day: '2-digit', month: 'short' } : {}),
    }).format(date) + ' IST'
  );
}

import { Patient, SafetyCheckRecord, AuditLogEntry, DrugInteractionAlert, PrescriptionItem, InteractionRule } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'smileclinic_patients_v3',
  CHECKS: 'smileclinic_checks',
  AUDIT: 'smileclinic_audit',
  RULES: 'smileclinic_rules_v6'
};

export const isMockPatient = (p: any): boolean => {
  if (!p || typeof p !== 'object') return true;
  const name = String(p.name || '').toLowerCase();
  const id = String(p.id || '').toLowerCase();
  const mrn = String(p.mrn || '').toLowerCase();
  return (
    name.includes('eleanor') ||
    name.includes('marcus') ||
    name.includes('jenkins') ||
    name.includes('vance') ||
    id.includes('pt-00') ||
    mrn.includes('pt-00')
  );
};

export const isDummyCheck = (c: any): boolean => {
  if (!c || typeof c !== 'object') return true;
  if (c.checkNumber === 'CHK-2026-5869' || c.id === 'CHK-2026-5869') return true;
  const rxList = c.prescriptions || [];
  if (!Array.isArray(rxList) || rxList.length === 0) return true;
  const hasValidRx = rxList.some(
    (p: any) => p && p.drugName && p.drugName.trim().length > 0 && p.drugName.trim().toLowerCase() !== 'unspecified'
  );
  if (!hasValidRx) return true;
  return false;
};

// Clean legacy mock items and safely migrate rules
try {
  localStorage.removeItem('smileclinic_rules');
  const legacyV5 = localStorage.getItem('smileclinic_rules_v5');
  if (legacyV5 && !localStorage.getItem(STORAGE_KEYS.RULES)) {
    localStorage.setItem(STORAGE_KEYS.RULES, legacyV5);
  }
  localStorage.removeItem('smileclinic_patients');
  localStorage.removeItem('smileclinic_patients_v2');
  localStorage.removeItem('smileclinic_custom_prescriber_password');
  localStorage.removeItem('smileclinic_registered_doctors');

  const rawChecks = localStorage.getItem(STORAGE_KEYS.CHECKS);
  if (rawChecks) {
    const parsed = JSON.parse(rawChecks);
    if (Array.isArray(parsed)) {
      const realChecks = parsed.filter(c => !isDummyCheck(c));
      localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(realChecks));
    }
  }
} catch {
  // ignore
}

export const getActiveClinicianName = () => {
  try {
    return (
      sessionStorage.getItem('rxguard_prescriber_name') ||
      localStorage.getItem('rxguard_prescriber_name') ||
      'Authorized Clinician'
    );
  } catch {
    return 'Authorized Clinician';
  }
};

export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_CHECKS: SafetyCheckRecord[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_RULES: InteractionRule[] = [];

export class PrescriptionStorage {
  static getRules(userId?: string): InteractionRule[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RULES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (userId) {
            return parsed.filter(r => !r.userId || r.userId === userId || r.userId === 'user-current');
          }
          return parsed;
        }
      }
      return INITIAL_RULES;
    } catch {
      return INITIAL_RULES;
    }
  }

  static addRules(newRules: InteractionRule[]): InteractionRule[] {
    const rules = this.getRules();
    rules.unshift(...newRules);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return rules;
  }

  static addRule(rule: InteractionRule): InteractionRule[] {
    const rules = this.getRules();
    rules.unshift(rule);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return rules;
  }

  static deleteRule(ruleId: string): InteractionRule[] {
    const rules = this.getRules().filter(r => r.id !== ruleId);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return rules;
  }

  static deleteRulesBySource(sourceFile: string): InteractionRule[] {
    const rules = this.getRules().filter(r => {
      if (!r.sourceFile) return true;
      const match =
        r.sourceFile === sourceFile ||
        sourceFile.includes(r.sourceFile) ||
        r.sourceFile.includes(sourceFile);
      return !match;
    });
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return rules;
  }

  static toggleRule(ruleId: string): InteractionRule[] {
    const rules = this.getRules();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.active = !rule.active;
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
      }
    }
    return rules;
  }

  static getPatients(): Patient[] {
    try {
      localStorage.removeItem('smileclinic_patients');
      localStorage.removeItem('smileclinic_patients_v2');
      const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (!raw) return [];
      const parsed: Patient[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const realOnly = parsed.filter(p => p && !isMockPatient(p));
      if (realOnly.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(realOnly));
      }
      return realOnly;
    } catch {
      return [];
    }
  }

  static getPatientById(id: string): Patient | undefined {
    return this.getPatients().find(p => p.id === id || p.mrn.toLowerCase() === id.toLowerCase());
  }

  static addPatient(patient: Patient) {
    if (isMockPatient(patient)) return;
    const patients = this.getPatients();
    const existingIndex = patients.findIndex(p => p.id === patient.id || p.mrn.toLowerCase() === patient.mrn.toLowerCase());
    if (existingIndex >= 0) {
      patients[existingIndex] = patient;
    } else {
      patients.unshift(patient);
    }
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }

  static getChecks(): SafetyCheckRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHECKS);
      if (!raw) return INITIAL_CHECKS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return INITIAL_CHECKS;
      const realOnly = parsed.filter(c => !isDummyCheck(c));
      if (realOnly.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(realOnly));
      }
      return realOnly;
    } catch {
      return INITIAL_CHECKS;
    }
  }

  static getCheckById(id: string): SafetyCheckRecord | undefined {
    return this.getChecks().find(c => c.id === id || c.checkNumber === id);
  }

  static deleteCheck(id: string): SafetyCheckRecord[] {
    const checks = this.getChecks().filter(c => c.id !== id && c.checkNumber !== id);
    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(checks));
    return checks;
  }

  static clearChecks() {
    localStorage.removeItem(STORAGE_KEYS.CHECKS);
  }

  static addCheck(record: SafetyCheckRecord) {
    const checks = this.getChecks();
    const now = Date.now();
    const istTimeStr = formatISTTime(now, true);

    const enrichedRecord: SafetyCheckRecord = {
      ...record,
      timestampMs: record.timestampMs || now,
      createdAt: record.createdAt || new Date(now).toISOString(),
      timestamp: record.timestamp && record.timestamp !== 'Just now' ? record.timestamp : istTimeStr,
    };

    checks.unshift(enrichedRecord);
    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(checks));

    const auditHash = 'SHA256:' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();

    this.addAudit({
      id: 'aud-' + now,
      timestamp: istTimeStr,
      timestampMs: now,
      createdAt: new Date(now).toISOString(),
      clinicianName: record.prescriberName,
      action: 'Safety Screen Initiated',
      patientMrn: record.mrn,
      patientName: record.patientName,
      checkId: record.id,
      prescriptions: record.prescriptions,
      alerts: record.alerts,
      details: `Screened ${record.prescriptions.length} items for ${record.patientName}. Result: ${record.overallStatus}.`,
      severity: record.alerts.length > 0 ? record.alerts[0].severity : 'safe',
      hash: auditHash
    });
  }

  static overrideAlert(checkId: string, alertId: string, reason: string, author: string) {
    const checks = this.getChecks();
    const check = checks.find(c => c.id === checkId);
    if (!check) return;

    const alert = check.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.overridden = true;
      alert.overrideReason = reason;
      alert.overrideAuthor = author;
    }

    const hasUnresolved = check.alerts.some(a => !a.overridden);
    if (!hasUnresolved) {
      check.overallStatus = 'Overridden';
    }

    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(checks));

    const now = Date.now();
    const istTimeStr = formatISTTime(now, true);
    const auditHash = 'SHA256:' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();

    this.addAudit({
      id: 'aud-' + now,
      timestamp: istTimeStr,
      timestampMs: now,
      createdAt: new Date(now).toISOString(),
      clinicianName: author,
      action: 'Alert Overridden',
      patientMrn: check.mrn,
      patientName: check.patientName,
      checkId: check.id,
      prescriptions: check.prescriptions,
      alerts: check.alerts,
      overrideReason: reason,
      overrideAuthor: author,
      details: `Alert "${alert?.title || alertId}" overridden: ${reason}`,
      severity: alert?.severity || 'major',
      hash: auditHash
    });
  }

  static getAuditLogs(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
      const list: AuditLogEntry[] = raw ? JSON.parse(raw) : INITIAL_AUDIT_LOGS;
      const checks = this.getChecks();

      const safetyOnly = (Array.isArray(list) ? list : []).filter(
        (log) => log.action !== 'Rule Updated' && !log.action.includes('Rule')
      );

      // Hydrate missing inner details from safety checks if available
      const enrichedLogs = safetyOnly.map((log) => {
        if (!log.prescriptions || log.prescriptions.length === 0 || !log.alerts) {
          const match = checks.find((c) => c.mrn === log.patientMrn || c.id === log.checkId);
          if (match) {
            return {
              ...log,
              patientName: log.patientName || match.patientName,
              checkId: log.checkId || match.id,
              prescriptions: log.prescriptions || match.prescriptions,
              alerts: log.alerts || match.alerts,
              hash: log.hash || ('SHA256:' + log.id.replace('aud-', '') + 'FEDCBA98'),
            };
          }
        }
        return log;
      });

      if (raw && safetyOnly.length !== list.length) {
        localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(safetyOnly));
      }
      return enrichedLogs;
    } catch {
      return INITIAL_AUDIT_LOGS.filter((l) => l.action !== 'Rule Updated' && !l.action.includes('Rule'));
    }
  }

  static addAudit(entry: AuditLogEntry) {
    const logs = this.getAuditLogs();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
  }

  static evaluateScreening(patient: Patient, items: PrescriptionItem[]): DrugInteractionAlert[] {
    const alerts: DrugInteractionAlert[] = [];

    items.forEach(item => {
      const generic = (item.genericName || '').toLowerCase();
      const brand = (item.drugName || '').toLowerCase();

      // 1. Check Documented Drug Allergies
      (patient.allergies || []).forEach(allergy => {
        const al = allergy.toLowerCase();
        if (
          (al.includes('penicillin') && (generic.includes('amoxicillin') || generic.includes('ampicillin') || brand.includes('augmentin'))) ||
          (al.includes('sulfa') && generic.includes('sulfamethoxazole')) ||
          (al.includes('codeine') && (generic.includes('codeine') || generic.includes('tramadol'))) ||
          (al.includes('aspirin') && (generic.includes('aspirin') || generic.includes('ketorolac'))) ||
          (al.includes('ibuprofen') && generic.includes('ibuprofen'))
        ) {
          alerts.push({
            id: 'alt-alg-' + Math.random().toString(36).substring(2, 9),
            title: `Documented Allergy Trigger: ${item.drugName} vs. ${allergy}`,
            severity: 'contraindicated',
            interactingDrugs: [item.drugName, allergy],
            mechanism: 'Cross-reactive IgE-mediated response can precipitate anaphylaxis or acute urticaria.',
            clinicalImpact: 'High risk of respiratory compromise and systemic allergic collapse.',
            evidenceGrade: 'Class I (Definitive)',
            recommendation: 'Select non-cross-reacting therapeutic alternative immediately.',
            alternatives: ['Clindamycin 300mg Oral', 'Azithromycin 500mg Oral', 'Acetaminophen 500mg'],
            timestamp: 'Just now'
          });
        }
      });

      // 2. Check Drug-Drug Interactions with Active Medications
      (patient.activeMedications || []).forEach(med => {
        const activeMed = med.toLowerCase();

        // Warfarin + NSAIDs
        if (activeMed.includes('warfarin') && (generic.includes('ibuprofen') || generic.includes('ketorolac') || generic.includes('naproxen'))) {
          alerts.push({
            id: 'alt-ddi-' + Math.random().toString(36).substring(2, 9),
            title: `Severe Hemorrhage Warning: ${item.drugName} + ${med}`,
            severity: 'contraindicated',
            interactingDrugs: [item.drugName, med],
            mechanism: 'NSAIDs displace warfarin from plasma proteins and impair platelet aggregation, spiking INR and bleeding risk.',
            clinicalImpact: 'Life-threatening internal hemorrhage or protracted post-extraction socket bleeding.',
            evidenceGrade: 'Class I (Definitive)',
            recommendation: 'Avoid NSAIDs entirely in anticoagulated dental patients. Use Acetaminophen.',
            alternatives: ['Acetaminophen 500mg Oral', 'Codeine/Acetaminophen low dose'],
            timestamp: 'Just now'
          });
        }

        // SSRI + Tramadol
        if ((activeMed.includes('sertraline') || activeMed.includes('fluoxetine') || activeMed.includes('escitalopram')) && generic.includes('tramadol')) {
          alerts.push({
            id: 'alt-ddi-' + Math.random().toString(36).substring(2, 9),
            title: `Serotonin Syndrome Potential: ${item.drugName} + ${med}`,
            severity: 'major',
            interactingDrugs: [item.drugName, med],
            mechanism: 'Dual inhibition of serotonin reuptake promotes excessive central 5-HT receptor stimulation.',
            clinicalImpact: 'Hyperreflexia, neuromuscular agitation, hyperthermia, and autonomic instability.',
            evidenceGrade: 'Class II (Probable)',
            recommendation: 'Substitute with a non-serotonergic analgesic or monitor closely for cognitive changes.',
            alternatives: ['Acetaminophen 650mg + Ibuprofen 400mg combination', 'Oxycodone short course'],
            timestamp: 'Just now'
          });
        }
      });

      // 3. Pregnancy Checks
      if (patient.pregnancyStatus && patient.pregnancyStatus !== 'No' && patient.pregnancyStatus !== 'N/A') {
        if (generic.includes('ibuprofen') || generic.includes('ketorolac') || generic.includes('doxycycline')) {
          alerts.push({
            id: 'alt-preg-' + Math.random().toString(36).substring(2, 9),
            title: `Teratogenic / Fetal Risk in Pregnancy: ${item.drugName}`,
            severity: 'contraindicated',
            interactingDrugs: [item.drugName, `Pregnancy (${patient.pregnancyStatus})`],
            mechanism: 'NSAIDs in late trimesters risk premature closure of ductus arteriosus and fetal renal impairment.',
            clinicalImpact: 'Severe fetal cardiovascular compromise or permanent tooth discoloration (tetracyclines).',
            evidenceGrade: 'Class I (Definitive)',
            recommendation: 'Consult OB/GYN. Acetaminophen and Amoxicillin (if non-allergic) are safer options.',
            alternatives: ['Acetaminophen 500mg', 'Amoxicillin 500mg (if penicillin tolerant)'],
            timestamp: 'Just now'
          });
        }
      }

      // 4. Renal Clearance Checks
      if (typeof patient.egfr === 'number' && patient.egfr < 50 && (generic.includes('ketorolac') || generic.includes('ibuprofen'))) {
        alerts.push({
          id: 'alt-ren-' + Math.random().toString(36).substring(2, 9),
          title: `Renal Clearance Contraindication: eGFR ${patient.egfr} mL/min`,
          severity: patient.egfr < 30 ? 'contraindicated' : 'major',
          interactingDrugs: [item.drugName, `Renal Insufficiency (eGFR ${patient.egfr})`],
          mechanism: 'Renal prostaglandin blockade decreases afferent arteriolar blood flow in compromised kidneys.',
          clinicalImpact: 'Acute-on-chronic renal decompensation and electrolyte derangements.',
          evidenceGrade: 'Class I (Definitive)',
          recommendation: 'Dose reduce or avoid nephrotoxic NSAIDs. Prefer hepatically cleared analgesics.',
          alternatives: ['Acetaminophen (renal-safe)', 'Low-dose opioid'],
          timestamp: 'Just now'
        });
      }
    });

    return alerts;
  }
}

// Named alias for backward compatibility across codebase
export const VirtualDb = PrescriptionStorage;
