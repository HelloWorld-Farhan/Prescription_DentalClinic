import { Patient, SafetyCheckRecord, AuditLogEntry, DrugInteractionAlert, PrescriptionItem, InteractionRule } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'smileclinic_patients',
  CHECKS: 'smileclinic_checks',
  AUDIT: 'smileclinic_audit',
  RULES: 'smileclinic_rules_v5'
};

// Purge legacy mock rules and audits if present
try {
  localStorage.removeItem('smileclinic_rules');
  localStorage.removeItem('smileclinic_rules_v5');
  localStorage.removeItem('smileclinic_audit');
} catch {
  // ignore
}

export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_CHECKS: SafetyCheckRecord[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
export const INITIAL_RULES: InteractionRule[] = [];

export class PrescriptionStorage {
  static getRules(): InteractionRule[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RULES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
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
    this.addAudit({
      id: 'aud-' + Date.now(),
      timestamp: 'Just now',
      clinicianName: 'Dr. Sarah Lin, PharmD',
      action: 'Rule Updated',
      patientMrn: 'Global Rules',
      details: `${newRules.length} rule${newRules.length > 1 ? 's' : ''} added to clinical decision matrix.`,
      severity: newRules[0]?.severity || 'major'
    });
    return rules;
  }

  static addRule(rule: InteractionRule): InteractionRule[] {
    const rules = this.getRules();
    rules.unshift(rule);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    this.addAudit({
      id: 'aud-' + Date.now(),
      timestamp: 'Just now',
      clinicianName: 'Dr. Sarah Lin, PharmD',
      action: 'Rule Updated',
      patientMrn: 'Global Rules',
      details: `Rule "${rule.drugA} + ${rule.drugB}" created.`,
      severity: rule.severity
    });
    return rules;
  }

  static deleteRule(ruleId: string): InteractionRule[] {
    const rules = this.getRules().filter(r => r.id !== ruleId);
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    return rules;
  }

  static toggleRule(ruleId: string): InteractionRule[] {
    const rules = this.getRules();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.active = !rule.active;
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
      this.addAudit({
        id: 'aud-' + Date.now(),
        timestamp: 'Just now',
        clinicianName: 'Dr. Sarah Lin, PharmD',
        action: 'Rule Updated',
        patientMrn: 'Global Rules',
        details: `Rule "${rule.drugA} + ${rule.drugB}" set to ${rule.active ? 'ACTIVE' : 'DISABLED'}.`,
        severity: rule.severity
      });
    }
    return rules;
  }

  static getPatients(): Patient[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      return raw ? JSON.parse(raw) : INITIAL_PATIENTS;
    } catch {
      return INITIAL_PATIENTS;
    }
  }

  static getPatientById(id: string): Patient | undefined {
    return this.getPatients().find(p => p.id === id || p.mrn.toLowerCase() === id.toLowerCase());
  }

  static addPatient(patient: Patient) {
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
      return raw ? JSON.parse(raw) : INITIAL_CHECKS;
    } catch {
      return INITIAL_CHECKS;
    }
  }

  static getCheckById(id: string): SafetyCheckRecord | undefined {
    return this.getChecks().find(c => c.id === id || c.checkNumber === id);
  }

  static addCheck(record: SafetyCheckRecord) {
    const checks = this.getChecks();
    checks.unshift(record);
    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(checks));

    this.addAudit({
      id: 'aud-' + Date.now(),
      timestamp: 'Just now',
      clinicianName: record.prescriberName,
      action: 'Safety Screen Initiated',
      patientMrn: record.mrn,
      details: `Screened ${record.prescriptions.length} items for ${record.patientName}. Result: ${record.overallStatus}.`,
      severity: record.alerts.length > 0 ? record.alerts[0].severity : 'safe'
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

    this.addAudit({
      id: 'aud-' + Date.now(),
      timestamp: 'Just now',
      clinicianName: author,
      action: 'Alert Overridden',
      patientMrn: check.mrn,
      details: `Alert "${alert?.title}" overridden: ${reason}`,
      severity: alert?.severity || 'major'
    });
  }

  static getAuditLogs(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
      return raw ? JSON.parse(raw) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
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
