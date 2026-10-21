import { Patient, SafetyCheckRecord, AuditLogEntry, InteractionRule, DrugInteractionAlert, PrescriptionItem } from '../types';

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pt-1',
    mrn: 'MRN-849201',
    name: 'Eleanor Vance',
    age: 68,
    gender: 'Female',
    weightKg: 64.5,
    egfr: 42, // Moderate Renal Impairment
    pregnancyStatus: 'No',
    conditions: ['Atrial Fibrillation', 'Chronic Kidney Disease Stage 3', 'Hypertension'],
    allergies: ['Penicillin (Anaphylaxis)', 'Sulfa drugs (Hives)'],
    activeMedications: ['Warfarin 5mg QD', 'Lisinopril 10mg QD', 'Metoprolol 50mg BID'],
    roomOrUnit: 'Dental Surgery Bay 2'
  },
  {
    id: 'pt-2',
    mrn: 'MRN-720194',
    name: 'Marcus Chen',
    age: 45,
    gender: 'Male',
    weightKg: 82.0,
    egfr: 94,
    pregnancyStatus: 'No',
    conditions: ['Depression', 'Gastroesophageal Reflux (GERD)'],
    allergies: ['Codeine (Nausea/Vomiting)'],
    activeMedications: ['Sertraline 100mg QD', 'Omeprazole 20mg QD'],
    roomOrUnit: 'Operatory 01'
  },
  {
    id: 'pt-3',
    mrn: 'MRN-551029',
    name: 'Sophia Rodriguez',
    age: 29,
    gender: 'Female',
    weightKg: 58.0,
    egfr: 110,
    pregnancyStatus: 'Second Trimester',
    conditions: ['Pregnancy (22 weeks)', 'Gestational Gingivitis'],
    allergies: ['No Known Drug Allergies (NKDA)'],
    activeMedications: ['Prenatal Multivitamin', 'Ferrous Sulfate 325mg'],
    roomOrUnit: 'Dental Clinic Suite 4'
  },
  {
    id: 'pt-4',
    mrn: 'MRN-339811',
    name: 'Arthur Pendelton',
    age: 74,
    gender: 'Male',
    weightKg: 78.5,
    egfr: 52,
    conditions: ['Type 2 Diabetes', 'Coronary Artery Disease', 'Osteoporosis'],
    pregnancyStatus: 'No',
    allergies: ['Aspirin (Bronchospasm)'],
    activeMedications: ['Clopidogrel 75mg QD', 'Metformin 1000mg BID', 'Alendronate 70mg Weekly'],
    roomOrUnit: 'Periodontal Bay 1'
  },
  {
    id: 'pt-5',
    mrn: 'MRN-902414',
    name: 'Maya Lin',
    age: 38,
    gender: 'Female',
    weightKg: 62.0,
    egfr: 105,
    conditions: ['Mild Asthma'],
    pregnancyStatus: 'No',
    allergies: ['Ibuprofen (Facial Swelling)'],
    activeMedications: ['Albuterol inhaler PRN'],
    roomOrUnit: 'Hygiene Room 3'
  }
];

export const INITIAL_RULES: InteractionRule[] = [
  {
    id: 'rule-1',
    drugA: 'Warfarin',
    drugB: 'Ibuprofen',
    severity: 'contraindicated',
    category: 'Drug-Drug',
    description: 'Concurrent use markedly elevates hemorrhage and gastrointestinal bleeding risk through dual antiplatelet and anticoagulant synergy.',
    active: true
  },
  {
    id: 'rule-2',
    drugA: 'Penicillin',
    drugB: 'Amoxicillin',
    severity: 'contraindicated',
    category: 'Drug-Allergy',
    description: 'Direct beta-lactam cross-reactivity triggering severe IgE-mediated type I anaphylaxis in penicillin-allergic patients.',
    active: true
  },
  {
    id: 'rule-3',
    drugA: 'Sertraline',
    drugB: 'Tramadol',
    severity: 'major',
    category: 'Drug-Drug',
    description: 'Serotonergic synergy: tramadol inhibits serotonin reuptake and can precipitate potentially fatal Serotonin Syndrome.',
    active: true
  },
  {
    id: 'rule-4',
    drugA: 'Metronidazole',
    drugB: 'Alcohol / Elixirs',
    severity: 'major',
    category: 'Drug-Drug',
    description: 'Disulfiram-like reaction causing severe nausea, tachycardia, flushing, and acute hypotension.',
    active: true
  },
  {
    id: 'rule-5',
    drugA: 'Clarithromycin',
    drugB: 'Statins (Atorvastatin)',
    severity: 'major',
    category: 'Drug-Drug',
    description: 'Potent CYP3A4 inhibition elevates systemic statin exposure, dramatically increasing risk of rhabdomyolysis.',
    active: true
  },
  {
    id: 'rule-6',
    drugA: 'Pregnancy',
    drugB: 'Ibuprofen',
    severity: 'contraindicated',
    category: 'Drug-Condition',
    description: 'NSAIDs in 2nd/3rd trimester risk premature closure of the fetal ductus arteriosus and renal dysfunction/oligohydramnios.',
    active: true
  },
  {
    id: 'rule-7',
    drugA: 'Chronic Kidney Disease',
    drugB: 'Ketorolac',
    severity: 'contraindicated',
    category: 'Renal Dose Adjustment',
    description: 'Renal prostaglandin synthesis inhibition precipitating acute on chronic tubular necrosis in low eGFR patients.',
    active: true
  }
];

export const INITIAL_CHECKS: SafetyCheckRecord[] = [
  {
    id: 'chk-1092',
    checkNumber: 'RXG-2026-1092',
    timestamp: '10 mins ago',
    patientId: 'pt-1',
    patientName: 'Eleanor Vance',
    mrn: 'MRN-849201',
    unit: 'Dental Surgery Bay 2',
    prescriptions: [
      {
        id: 'rx-1',
        drugName: 'Ibuprofen 600mg',
        genericName: 'Ibuprofen',
        dosage: '600mg',
        frequency: 'Every 6 hours PRN',
        route: 'Oral',
        duration: '5 days',
        indication: 'Post-Surgical Dental Pain'
      },
      {
        id: 'rx-2',
        drugName: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Every 8 hours',
        route: 'Oral',
        duration: '7 days',
        indication: 'Prophylactic Odontogenic Infection'
      }
    ],
    alerts: [
      {
        id: 'alt-1',
        title: 'Drug-Allergy Anaphylaxis Risk: Amoxicillin with Documented Penicillin Allergy',
        severity: 'contraindicated',
        interactingDrugs: ['Amoxicillin', 'Penicillin Allergy'],
        mechanism: 'Beta-lactam core cross-sensitivity triggers acute IgE-mediated mast cell degranulation and bronchospasm.',
        clinicalImpact: 'Life-threatening anaphylactic shock.',
        evidenceGrade: 'Class I (Definitive)',
        recommendation: 'Discontinue Amoxicillin immediately. Prescribe Clindamycin 300mg Q8H or Azithromycin 500mg as safe non-beta-lactam alternatives.',
        alternatives: ['Clindamycin 300mg Oral', 'Azithromycin 500mg Oral', 'Cephalexin (caution if severe)'],
        timestamp: '10 mins ago'
      },
      {
        id: 'alt-2',
        title: 'Major Hemorrhage Interaction: Ibuprofen + Warfarin',
        severity: 'contraindicated',
        interactingDrugs: ['Ibuprofen 600mg', 'Warfarin 5mg'],
        mechanism: 'NSAIDs displace warfarin from albumin and inhibit platelet aggregation via COX-1, while damaging gastric mucosa.',
        clinicalImpact: 'Catastrophic post-operative bleeding, oral hematoma, and gastrointestinal ulceration.',
        evidenceGrade: 'Class I (Definitive)',
        recommendation: 'Switch analgesic to Acetaminophen (Paracetamol) 500mg-1000mg maximum 3g/day, or consider local ice and mild opioid if refractory.',
        alternatives: ['Acetaminophen 500mg Q6H', 'Tramadol low-dose (non-NSAID)', 'Cold Compress protocol'],
        timestamp: '10 mins ago'
      }
    ],
    overallStatus: 'Contraindicated',
    prescriberName: 'Dr. Sarah Lin, PharmD',
    prescriberNpi: 'NPI-9834210',
    fhirSynced: true
  },
  {
    id: 'chk-1091',
    checkNumber: 'RXG-2026-1091',
    timestamp: '42 mins ago',
    patientId: 'pt-2',
    patientName: 'Marcus Chen',
    mrn: 'MRN-720194',
    unit: 'Operatory 01',
    prescriptions: [
      {
        id: 'rx-3',
        drugName: 'Tramadol 50mg',
        genericName: 'Tramadol HCl',
        dosage: '50mg',
        frequency: 'Every 6-8 hours PRN',
        route: 'Oral',
        duration: '3 days',
        indication: 'Impaction Surgery Severe Pain'
      }
    ],
    alerts: [
      {
        id: 'alt-3',
        title: 'Serotonin Syndrome Potential: Tramadol with Active Sertraline',
        severity: 'major',
        interactingDrugs: ['Tramadol 50mg', 'Sertraline 100mg'],
        mechanism: 'Tramadol inhibits neuronal serotonin reuptake while stimulating serotonin release, synergizing with SSRI reuptake inhibition.',
        clinicalImpact: 'Risk of tremor, hyperreflexia, agitation, autonomic instability, and hyperthermia.',
        evidenceGrade: 'Class II (Probable)',
        recommendation: 'Monitor for mental status changes or substitute with Acetaminophen/Codeine or scheduled Ibuprofen 600mg.',
        alternatives: ['Acetaminophen 650mg + Ibuprofen 400mg', 'Oxycodone low-dose without serotonergic activity'],
        overridden: true,
        overrideReason: 'Patient tolerated tramadol previously. Advised on early signs of tremor or diaphoresis. Limited 3-day supply only.',
        overrideAuthor: 'Dr. Sarah Lin, PharmD',
        timestamp: '35 mins ago'
      }
    ],
    overallStatus: 'Overridden',
    prescriberName: 'Dr. Sarah Lin, PharmD',
    prescriberNpi: 'NPI-9834210',
    fhirSynced: true
  },
  {
    id: 'chk-1090',
    checkNumber: 'RXG-2026-1090',
    timestamp: '2 hours ago',
    patientId: 'pt-4',
    patientName: 'Arthur Pendelton',
    mrn: 'MRN-339811',
    unit: 'Periodontal Bay 1',
    prescriptions: [
      {
        id: 'rx-4',
        drugName: 'Chlorhexidine 0.12% Oral Rinse',
        genericName: 'Chlorhexidine Gluconate',
        dosage: '15mL',
        frequency: 'Twice daily after brushing',
        route: 'Topical Oral',
        duration: '14 days',
        indication: 'Periodontal Pocket Disinfection'
      }
    ],
    alerts: [],
    overallStatus: 'Safe to Dispense',
    prescriberName: 'Dr. Priya Patel, DDS',
    prescriberNpi: 'NPI-4491028',
    fhirSynced: true
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-1',
    timestamp: 'Today at 05:22 PM',
    clinicianName: 'Dr. Sarah Lin, PharmD',
    action: 'Safety Screen Initiated',
    patientMrn: 'MRN-849201',
    details: 'Screened Amoxicillin 500mg and Ibuprofen 600mg for Eleanor Vance. 2 Contraindicated alerts triggered.',
    severity: 'contraindicated'
  },
  {
    id: 'aud-2',
    timestamp: 'Today at 04:55 PM',
    clinicianName: 'Dr. Sarah Lin, PharmD',
    action: 'Alert Overridden',
    patientMrn: 'MRN-720194',
    details: 'Overrode Major alert (Tramadol + Sertraline). Reason: "Patient tolerated previously. 3-day short course with close observation."',
    severity: 'major'
  },
  {
    id: 'aud-3',
    timestamp: 'Today at 03:40 PM',
    clinicianName: 'Dr. Priya Patel, DDS',
    action: 'Report Printed',
    patientMrn: 'MRN-339811',
    details: 'Generated and signed PDF Clinical Interaction Review Report #RXG-2026-1090 for Arthur Pendelton.',
    severity: 'safe'
  },
  {
    id: 'aud-4',
    timestamp: 'Today at 01:15 PM',
    clinicianName: 'System Clinical Gateway',
    action: 'FHIR Synced',
    patientMrn: 'All Records',
    details: 'SMART on FHIR v4.0.1 batch sync reconciled with St. Jude Health System EMR.',
    severity: 'safe'
  }
];

// LocalStorage Keys
const STORAGE_KEYS = {
  PATIENTS: 'rxguard_patients_v1',
  CHECKS: 'rxguard_checks_v1',
  RULES: 'rxguard_rules_v1',
  AUDIT: 'rxguard_audit_v1'
};

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
