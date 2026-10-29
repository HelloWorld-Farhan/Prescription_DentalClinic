export type AlertSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor' | 'safe';



export interface Patient {

  id: string;

  mrn: string;

  name: string;

  age: number;

  gender: 'Male' | 'Female' | 'Other' | string;

  weightKg: number;

  height?: string;

  egfr: number; // mL/min/1.73m²

  pregnancyStatus: 'No' | 'First Trimester' | 'Second Trimester' | 'Third Trimester' | 'Lactating' | 'N/A';

  conditions: string[];

  allergies: string[];

  activeMedications: string[];

  roomOrUnit?: string;

}



export interface PrescriptionItem {

  id: string;

  drugName: string;

  genericName: string;

  dosage: string;

  frequency: string;

  route: string;

  duration: string;

  indication: string;

  status?: string;

  monograph?: string;

  dentalGuidance?: string;

}



export interface DrugInteractionAlert {

  id: string;

  title: string;

  severity: AlertSeverity;

  interactingDrugs: string[];

  mechanism: string;

  clinicalImpact: string;

  description?: string;

  evidenceGrade: 'Class I (Definitive)' | 'Class II (Probable)' | 'Class III (Theoretical)' | string;

  recommendation: string;

  alternatives: string[];

  alternativeSuggestion?: string;

  overridden?: boolean;

  overrideReason?: string;

  overrideAuthor?: string;

  timestamp: string;

}



export interface SafetyCheckRecord {

  id: string;

  checkNumber: string;

  timestamp: string;

  timestampMs?: number;

  createdAt?: string;

  patientId: string;

  patientName: string;

  patientKey?: string;

  mrn: string;

  unit: string;

  prescriptions: PrescriptionItem[];

  prescribedDrugs?: string[];

  alerts: DrugInteractionAlert[];

  overallStatus: 'Safe to Dispense' | 'Requires Review' | 'Contraindicated' | 'Overridden';

  prescriberName: string;

  prescriberNpi: string;

  reviewerName?: string;

  status?: string;

  patientAge?: number | string;

  patientGender?: string;

  gender?: string;

  patientAllergies?: string[];

  digitalSeal?: string;

  hash?: string;

  pdfUrl?: string;

  pdfFilename?: string;

  wordUrl?: string;

  csvUrl?: string;

  inquiryAnswers?: { question: string; answer: string }[];

  fhirSynced: boolean;

  notes?: string;

  sourceDocumentUrl?: string;

  sourceDocumentName?: string;

  sourceType?: 'upload' | 'camera' | 'manual';

  questions?: string[];

  questionAnswers?: { question: string; answer: string; }[];
}



export interface AuditLogEntry {
  sourceDocumentUrl?: string;
  sourceDocumentName?: string;
  sourceType?: 'upload' | 'camera' | 'manual';
  pdfFilename?: string;
  pdfUrl?: string;

  id: string;

  timestamp: string;

  timestampMs?: number;

  createdAt?: string;

  clinicianName: string;

  action: 'Safety Screen Initiated' | 'Alert Overridden' | 'Prescription Modified' | 'Report Printed' | 'Rule Updated' | 'FHIR Synced' | string;

  patientMrn: string;

  patientName?: string;

  checkId?: string;

  prescriptions?: PrescriptionItem[];

  alerts?: DrugInteractionAlert[];

  overrideReason?: string;

  overrideAuthor?: string;

  details: string;

  severity: AlertSeverity;

  hash?: string;

}



export interface InteractionRule {

  id: string;

  drugA: string;

  drugB: string;

  severity: AlertSeverity;

  category: 'Drug-Drug' | 'Drug-Allergy' | 'Drug-Condition' | 'Renal Dose Adjustment' | string;

  description: string;

  active: boolean;

  userId?: string;

  authorName?: string;

  createdAt?: string;

  sourceFile?: string;

  storageUrl?: string;

}

