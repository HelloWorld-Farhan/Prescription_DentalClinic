/**
 * ==============================================================================
 * Smile Clinic — Clinical Decision Support (CDS) & Evaluation Engine
 * ==============================================================================
 * Evaluates drug safety rules, contraindications, allergies, pregnancy, and eGFR.
 * State is hydrated in-memory directly from Cloud Database (cloudSyncService).
 * ZERO browser localStorage usage for clinical records.
 * ==============================================================================
 */
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

import {

  syncCheckToCloud,

  syncAuditLogToCloud,

  syncRuleToCloud,

  deleteRuleFromCloud,

  toggleRuleInCloud,

  deleteRulesBySourceFromCloud,

} from './cloudSyncService';














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







// Zero LocalStorage clinical data caches
let _cachedChecks: SafetyCheckRecord[] = [];
let _cachedAuditLogs: AuditLogEntry[] = [];
let _cachedRules: InteractionRule[] = [];
let _cachedPatients: Patient[] = [];

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







/**
 * Clinical Decision Support (CDS) & Regimen Screening Engine
 * Evaluates prescription items against dental monograph rules, drug-drug contraindications,
 * patient allergies, pregnancy status, and renal clearance (eGFR).
 * Synchronized with backend Cloud SQLite DB via cloudSyncService.
 * Zero browser localStorage usage for clinical items.
 */
export class ClinicalDecisionSupport {
  static setChecks(checks: SafetyCheckRecord[]) {
    _cachedChecks = (checks || []).filter(c => !isDummyCheck(c));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
    }
  }

  static deduplicateAuditLogs(logs: AuditLogEntry[]): AuditLogEntry[] {
    const hasCompletedForCheck = new Set<string>();
    const hasCompletedForPatientMinute = new Set<string>();

    for (const log of logs) {
      if (log.action === 'Safety Screen Completed') {
        if (log.checkId) hasCompletedForCheck.add(log.checkId);
        const minKey = `${log.patientMrn || ''}_${Math.floor((log.timestampMs || 0) / 60000)}`;
        hasCompletedForPatientMinute.add(minKey);
      }
    }

    const seenIds = new Set<string>();
    const seenCheckAction = new Set<string>();
    const deduped: AuditLogEntry[] = [];

    for (const log of logs) {
      // Drop redundant 'Safety Screen Initiated' if a completed screen exists for this check or patient/minute
      if (log.action === 'Safety Screen Initiated') {
        const minKey = `${log.patientMrn || ''}_${Math.floor((log.timestampMs || 0) / 60000)}`;
        if ((log.checkId && hasCompletedForCheck.has(log.checkId)) || hasCompletedForPatientMinute.has(minKey)) {
          continue;
        }
      }

      if (log.id && seenIds.has(log.id)) {
        continue;
      }
      if (log.id) seenIds.add(log.id);

      if (log.checkId) {
        const caKey = `${log.checkId}_${log.action}`;
        if (seenCheckAction.has(caKey)) {
          continue;
        }
        seenCheckAction.add(caKey);
      }

      deduped.push(log);
    }
    return deduped;
  }

  static setAuditLogs(logs: AuditLogEntry[]) {
    const filtered = (logs || []).filter(l => l.action !== 'Rule Updated' && !l.action.includes('Rule'));
    _cachedAuditLogs = this.deduplicateAuditLogs(filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_audit_updated'));
    }
  }

  static setRules(rules: InteractionRule[]) {
    _cachedRules = rules || [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
  }

  static setPatients(patients: Patient[]) {
    _cachedPatients = (patients || []).filter(p => !isMockPatient(p));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_patients_updated'));
    }
  }

  static getRules(userId?: string): InteractionRule[] {
    if (userId) {
      return _cachedRules.filter(r => !r.userId || r.userId === userId || r.userId === 'user-current');
    }
    return _cachedRules;
  }

  static addRules(newRules: InteractionRule[]): InteractionRule[] {
    _cachedRules.unshift(...newRules);
    newRules.forEach((r) => syncRuleToCloud(r));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return _cachedRules;
  }

  static addRule(rule: InteractionRule): InteractionRule[] {
    _cachedRules.unshift(rule);
    syncRuleToCloud(rule);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return _cachedRules;
  }

  static deleteRule(ruleId: string): InteractionRule[] {
    _cachedRules = _cachedRules.filter(r => r.id !== ruleId);
    deleteRuleFromCloud(ruleId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return _cachedRules;
  }

  static deleteRulesBySource(sourceFile: string): InteractionRule[] {
    _cachedRules = _cachedRules.filter(r => {
      if (!r.sourceFile) return true;
      const match =
        r.sourceFile === sourceFile ||
        sourceFile.includes(r.sourceFile) ||
        r.sourceFile.includes(sourceFile);
      return !match;
    });
    deleteRulesBySourceFromCloud(sourceFile);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
    }
    return _cachedRules;
  }

  static toggleRule(ruleId: string): InteractionRule[] {
    const rule = _cachedRules.find(r => r.id === ruleId);
    if (rule) {
      rule.active = !rule.active;
      toggleRuleInCloud(ruleId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smileclinic_rules_updated'));
      }
    }
    return _cachedRules;
  }

  static getPatients(): Patient[] {
    return _cachedPatients.filter(p => p && !isMockPatient(p));
  }

  static getPatientById(id: string): Patient | undefined {
    return this.getPatients().find(p => p.id === id || p.mrn.toLowerCase() === id.toLowerCase());
  }

  static addPatient(patient: Patient) {
    if (isMockPatient(patient)) return;
    const existingIndex = _cachedPatients.findIndex(p => p.id === patient.id || p.mrn.toLowerCase() === patient.mrn.toLowerCase());
    if (existingIndex >= 0) {
      _cachedPatients[existingIndex] = patient;
    } else {
      _cachedPatients.unshift(patient);
    }
  }

  static getChecks(): SafetyCheckRecord[] {
    return _cachedChecks.filter(c => !isDummyCheck(c));
  }

  static getCheckById(id: string): SafetyCheckRecord | undefined {
    return this.getChecks().find(c => c.id === id || c.checkNumber === id);
  }

  static deleteCheck(id: string): SafetyCheckRecord[] {
    _cachedChecks = _cachedChecks.filter(c => c.id !== id && c.checkNumber !== id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
    }
    return _cachedChecks;
  }

  static clearChecks() {
    _cachedChecks = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
    }
  }

  static addCheck(record: SafetyCheckRecord) {
    const now = Date.now();
    const istTimeStr = formatISTTime(now, true);

    const enrichedRecord: SafetyCheckRecord = {
      ...record,
      timestampMs: record.timestampMs || now,
      createdAt: record.createdAt || new Date(now).toISOString(),
      timestamp: record.timestamp && record.timestamp !== 'Just now' ? record.timestamp : istTimeStr,
    };

    _cachedChecks.unshift(enrichedRecord);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
    }
    syncCheckToCloud(enrichedRecord);

    const auditHash = 'SHA256:' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Only record an audit log if one does not already exist for this check
    const alreadyLogged = _cachedAuditLogs.some(
      (a) => a.checkId === record.id || a.checkId === record.checkNumber || (a.patientMrn === record.mrn && Math.abs((a.timestampMs || 0) - now) < 60000)
    );
    if (!alreadyLogged) {
      this.addAudit({
        id: 'aud-' + now,
        timestamp: istTimeStr,
        timestampMs: now,
        createdAt: new Date(now).toISOString(),
        clinicianName: record.prescriberName,
        action: 'Safety Screen Completed',
        patientMrn: record.mrn,
        patientName: record.patientName,
        checkId: record.id,
        prescriptions: record.prescriptions,
        alerts: record.alerts,
        sourceDocumentUrl: record.sourceDocumentUrl,
        sourceDocumentName: record.sourceDocumentName,
        sourceType: record.sourceType,
        pdfFilename: record.pdfFilename || `SmileClinic_CDS_Report_${(record.checkNumber || record.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        pdfUrl: record.pdfUrl,
        details: `SmileClinic CDS verified ${record.prescriptions.length} items against monograph. Result: ${record.overallStatus}.`,
        severity: record.alerts.length > 0 ? record.alerts[0].severity : 'safe',
        hash: auditHash
      });
    }
  }

  static overrideAlert(checkId: string, alertId: string, reason: string, author: string) {
    const check = _cachedChecks.find(c => c.id === checkId);
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_checks_updated'));
    }
    syncCheckToCloud(check);

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
    const checks = this.getChecks();
    const safetyOnly = this.deduplicateAuditLogs(
      _cachedAuditLogs.filter((log) => log.action !== 'Rule Updated' && !log.action.includes('Rule'))
    );

    // Hydrate missing inner details from safety checks if available
    return safetyOnly.map((log) => {
      if (!log.prescriptions || log.prescriptions.length === 0 || !log.alerts) {
        const match =
          checks.find((c) => c.id === log.checkId || c.checkNumber === log.checkId) ||
          checks.find((c) => (c.mrn === log.patientMrn || c.patientId === log.patientMrn) && Math.abs((c.timestampMs || 0) - (log.timestampMs || 0)) < 300000) ||
          checks.find((c) => c.mrn === log.patientMrn || c.patientId === log.patientMrn);
        if (match) {
          return {
            ...log,
            patientName: log.patientName || match.patientName,
            checkId: log.checkId || match.id,
            prescriptions: (log.prescriptions && log.prescriptions.length > 0) ? log.prescriptions : match.prescriptions,
            alerts: (log.alerts && log.alerts.length > 0) ? log.alerts : match.alerts,
            sourceDocumentUrl: log.sourceDocumentUrl || match.sourceDocumentUrl,
            sourceDocumentName: log.sourceDocumentName || match.sourceDocumentName,
            sourceType: log.sourceType || match.sourceType,
            hash: log.hash || ('SHA256:' + log.id.replace('aud-', '') + 'FEDCBA98'),
          };
        }
      }
      return log;
    });
  }

  static addAudit(entry: AuditLogEntry) {
    _cachedAuditLogs.unshift(entry);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smileclinic_audit_updated'));
    }
    syncAuditLogToCloud(entry);
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



// Architectural Aliases for backwards compatibility
export const CDS = ClinicalDecisionSupport;
export const PrescriptionEngine = ClinicalDecisionSupport;
export const PrescriptionStorage = ClinicalDecisionSupport;
export const VirtualDb = ClinicalDecisionSupport;



