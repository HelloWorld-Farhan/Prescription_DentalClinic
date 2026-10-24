import { Patient, SafetyCheckRecord, AuditLogEntry, InteractionRule, DrugInteractionAlert, PrescriptionItem } from '../types';

// Clean production baseline: default 0 patients, rules, checks, and audit logs
export const INITIAL_PATIENTS: Patient[] = [];
export const INITIAL_RULES: InteractionRule[] = [];
export const INITIAL_CHECKS: SafetyCheckRecord[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

// LocalStorage Keys (v4 for completely clean zero-data state)
const STORAGE_KEYS = {
  PATIENTS: 'rxguard_patients_v4',
  CHECKS: 'rxguard_checks_v4',
  RULES: 'rxguard_rules_v4',
  AUDIT: 'rxguard_audit_v4'
};

// Purge any legacy cached mock data keys from earlier sessions
try {
  ['rxguard_rules', 'rxguard_rules_v2', 'rxguard_rules_v3',
   'rxguard_checks', 'rxguard_checks_v2', 'rxguard_checks_v3',
   'rxguard_patients', 'rxguard_patients_v2', 'rxguard_patients_v3',
   'rxguard_audit', 'rxguard_audit_v2', 'rxguard_audit_v3'].forEach(k => localStorage.removeItem(k));
} catch {
  // Ignore in environments without window/localStorage
}

export class VirtualDb {
  static getPatients(): Patient[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(INITIAL_PATIENTS));
      return INITIAL_PATIENTS;
    }
    return JSON.parse(raw);
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
    const raw = localStorage.getItem(STORAGE_KEYS.CHECKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(INITIAL_CHECKS));
      return INITIAL_CHECKS;
    }
    return JSON.parse(raw);
  }

  static getCheckById(id: string): SafetyCheckRecord | undefined {
    return this.getChecks().find(c => c.id === id || c.checkNumber === id);
  }

  static addCheck(record: SafetyCheckRecord) {
    const checks = this.getChecks();
    checks.unshift(record);
    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(checks));

    // Auto append audit log
    this.addAudit({
      id: 'aud-' + Date.now(),
      timestamp: 'Just now',
      clinicianName: record.prescriberName,
      action: 'Safety Screen Initiated',
      patientMrn: record.mrn,
      details: `Screened ${record.prescriptions.length} items for ${record.patientName}. Overall result: ${record.overallStatus}.`,
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
      details: `Alert "${alert?.title}" overridden. Rationale: ${reason}`,
      severity: alert?.severity || 'major'
    });
  }

  static getRules(): InteractionRule[] {
    const raw = localStorage.getItem(STORAGE_KEYS.RULES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(INITIAL_RULES));
      return INITIAL_RULES;
    }
    return JSON.parse(raw);
  }

  static toggleRule(ruleId: string) {
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

  static getAuditLogs(): AuditLogEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  }

  static addAudit(entry: AuditLogEntry) {
    const logs = this.getAuditLogs();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
  }

  static resetDatabase() {
    localStorage.removeItem(STORAGE_KEYS.PATIENTS);
    localStorage.removeItem(STORAGE_KEYS.CHECKS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT);
    localStorage.removeItem(STORAGE_KEYS.RULES);
  }

  // Clinical Rule Engine Screen Evaluator
  static evaluateScreening(patient: Patient, items: PrescriptionItem[]): DrugInteractionAlert[] {
    const alerts: DrugInteractionAlert[] = [];
    const rules = this.getRules().filter(r => r.active);

    items.forEach(item => {
      const generic = item.genericName.toLowerCase();
      const brand = item.drugName.toLowerCase();

      // 1. Check Drug Allergies
      patient.allergies.forEach(allergy => {
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
      patient.activeMedications.forEach(med => {
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
            recommendation: 'Avoid NSAIDs entirely in anticoagulated dental patients. Use Acetaminophen 500mg-1000mg maximum 3g/day.',
            alternatives: ['Acetaminophen 500mg Oral', 'Codeine/Acetaminophen low dose', 'Cold therapy'],
            timestamp: 'Just now'
          });
        }

        // Sertraline / SSRI + Tramadol
        if ((activeMed.includes('sertraline') || activeMed.includes('fluoxetine') || activeMed.includes('escitalopram')) && generic.includes('tramadol')) {
          alerts.push({
            id: 'alt-ddi-' + Math.random().toString(36).substring(2, 9),
            title: `Serotonin Syndrome Potential: ${item.drugName} + ${med}`,
            severity: 'major',
            interactingDrugs: [item.drugName, med],
            mechanism: 'Dual inhibition of serotonin reuptake promotes excessive central 5-HT receptor stimulation.',
            clinicalImpact: 'Hyperreflexia, neuromuscular agitation, hyperthermia, and autonomic instability.',
            evidenceGrade: 'Class II (Probable)',
            recommendation: 'Substitute with a non-serotonergic analgesic or monitor closely for cognitive/autonomic changes.',
            alternatives: ['Acetaminophen 650mg + Ibuprofen 400mg combination', 'Oxycodone short course'],
            timestamp: 'Just now'
          });
        }
      });

      // 3. Organ Clearance & Pregnancy Checks
      if (patient.pregnancyStatus !== 'No' && patient.pregnancyStatus !== 'N/A') {
        if (generic.includes('ibuprofen') || generic.includes('ketorolac') || generic.includes('doxycycline')) {
          alerts.push({
            id: 'alt-preg-' + Math.random().toString(36).substring(2, 9),
            title: `Teratogenic / Fetal Risk in Pregnancy: ${item.drugName}`,
            severity: 'contraindicated',
            interactingDrugs: [item.drugName, `Pregnancy (${patient.pregnancyStatus})`],
            mechanism: 'NSAIDs in late trimesters risk premature closure of ductus arteriosus and fetal renal impairment.',
            clinicalImpact: 'Severe fetal cardiovascular compromise or permanent tooth discoloration (tetracyclines).',
            evidenceGrade: 'Class I (Definitive)',
            recommendation: 'Consult OB/GYN. Acetaminophen and Amoxicillin (if non-allergic) are generally category B safer options.',
            alternatives: ['Acetaminophen 500mg', 'Amoxicillin 500mg (if penicillin tolerant)'],
            timestamp: 'Just now'
          });
        }
      }

      // Renal clearance
      if (patient.egfr < 50 && (generic.includes('ketorolac') || generic.includes('ibuprofen'))) {
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
