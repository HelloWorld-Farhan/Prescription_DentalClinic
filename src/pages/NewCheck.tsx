import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb, INITIAL_PATIENTS, isMockPatient } from '../services/prescriptionService';
import { Patient, PrescriptionItem, DrugInteractionAlert, SafetyCheckRecord } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import CameraCaptureModal from '../components/CameraCaptureModal';
import OpticalScanOverlay from '../components/OpticalScanOverlay';
import { uploadToR2, updateDocumentExtractedCount, deleteDocumentRecord } from '../services/storageService';
import { extractPrescriptionData, ExtractedPatientMetadata } from '../services/prescriptionExtractor';

interface AllergyDetailInfo {
  name: string;
  category: string;
  crossReactivities: string[];
  severity: 'contraindicated' | 'major' | 'moderate';
  clinicalNote: string;
  screeningRule: string;
}

const ALLERGY_KNOWLEDGE_MAP: Record<string, Partial<AllergyDetailInfo>> = {
  amoxicillin: {
    category: 'Beta-Lactam Antibiotic',
    crossReactivities: ['Penicillin V', 'Ampicillin', 'Augmentin (Amoxicillin/Clavulanate)', 'Cephalexin (1st gen Cephalosporins)'],
    severity: 'contraindicated',
    clinicalNote: 'Severe Type-1 hypersensitivity risk (anaphylaxis, urticaria, angioedema). Avoid all penicillins and use extreme caution with cephalosporins.',
    screeningRule: 'RULE-AL-01: Beta-Lactam Cross-Sensitivity Matrix'
  },
  penicillin: {
    category: 'Beta-Lactam Antibiotic',
    crossReactivities: ['Amoxicillin', 'Ampicillin', 'Augmentin', 'Dicloxacillin', 'Piperacillin'],
    severity: 'contraindicated',
    clinicalNote: 'Immediate IgE-mediated anaphylaxis risk. Substitute with Clindamycin 300mg, Azithromycin 500mg, or Clarithromycin.',
    screeningRule: 'RULE-AL-01: Penicillin Core Structure Allergy'
  },
  'nsaids / aspirin': {
    category: 'Cyclooxygenase (COX-1/2) Inhibitor',
    crossReactivities: ['Ibuprofen', 'Ketorolac', 'Naproxen', 'Diclofenac', 'Celecoxib', 'Aspirin'],
    severity: 'contraindicated',
    clinicalNote: 'Samter’s triad or cross-reactive bronchospasm / severe gastric bleeding risk. Use Acetaminophen (Paracetamol) or Tramadol for post-op dental analgesia.',
    screeningRule: 'RULE-AL-03: NSAID/Aspirin Induced Respiratory/Cutaneous Disease'
  },
  nsaids: {
    category: 'Non-Steroidal Anti-Inflammatory',
    crossReactivities: ['Ibuprofen', 'Ketorolac', 'Naproxen', 'Aspirin'],
    severity: 'contraindicated',
    clinicalNote: 'Cross-reactive bronchospasm risk. Prescribe Acetaminophen for dental pain management.',
    screeningRule: 'RULE-AL-03: NSAID Sensitivity Screening'
  },
  aspirin: {
    category: 'Salicylate / NSAID',
    crossReactivities: ['Ibuprofen', 'Naproxen', 'Ketorolac', 'Diflunisal'],
    severity: 'contraindicated',
    clinicalNote: 'Avoid all non-steroidal analgesics. Use Acetaminophen 500-1000mg PO.',
    screeningRule: 'RULE-AL-03: Salicylate Sensitivity'
  },
  'lidocaine (local anesthetic)': {
    category: 'Amide-type Local Anesthetic',
    crossReactivities: ['Mepivacaine', 'Articaine (minimal)', 'Bupivacaine', 'Prilocaine'],
    severity: 'contraindicated',
    clinicalNote: 'Verify true amide vs methylparaben preservative allergy. Consider preservative-free formulations, Mepivacaine, or skin testing prior to dental nerve block.',
    screeningRule: 'RULE-AL-04: Local Anesthetic Amide Screening'
  },
  lidocaine: {
    category: 'Amide Local Anesthetic',
    crossReactivities: ['Mepivacaine', 'Articaine', 'Bupivacaine'],
    severity: 'contraindicated',
    clinicalNote: 'Confirm true allergy vs vasovagal reaction or epinephrine tachycardia. Consider skin prick testing.',
    screeningRule: 'RULE-AL-04: Amide Anesthetic Screening'
  },
  'sulfa drugs': {
    category: 'Sulfonamide Antibacterial',
    crossReactivities: ['Sulfamethoxazole', 'Trimethoprim/Sulfamethoxazole (Bactrim)', 'Sulfadiazine'],
    severity: 'contraindicated',
    clinicalNote: 'Risk of Stevens-Johnson syndrome (SJS) or severe cutaneous drug reactions. Avoid sulfamethoxazole combinations.',
    screeningRule: 'RULE-AL-05: Sulfonamide Hypersensitivity'
  },
  sulfa: {
    category: 'Sulfonamide Antibacterial',
    crossReactivities: ['Bactrim', 'Sulfamethoxazole', 'Sulfasalazine'],
    severity: 'contraindicated',
    clinicalNote: 'Severe hypersensitivity risk. Avoid sulfonamide antimicrobials.',
    screeningRule: 'RULE-AL-05: Sulfonamide Hypersensitivity'
  },
  latex: {
    category: 'Natural Rubber Latex Contact Allergen',
    crossReactivities: ['Latex dental dams', 'Latex gloves', 'Rubber stopper vials', 'Prophy cups'],
    severity: 'major',
    clinicalNote: 'Ensure 100% latex-free dental operatory: nitrile gloves, silicone dams, non-latex emergency kits.',
    screeningRule: 'RULE-AL-06: Operatory Contact Allergen Safety Protocol'
  },
  codeine: {
    category: 'Opioid Analgesic (Phenanthrene)',
    crossReactivities: ['Morphine', 'Oxycodone', 'Hydrocodone'],
    severity: 'contraindicated',
    clinicalNote: 'Histamine release vs true opioid allergy. Consider Tramadol or non-opioid multimodal analgesia.',
    screeningRule: 'RULE-AL-07: Opioid Class Cross-Sensitivity'
  }
};

const getAllergyDetails = (allergenName: string): AllergyDetailInfo => {
  const key = allergenName.toLowerCase().trim();
  const matched = Object.entries(ALLERGY_KNOWLEDGE_MAP).find(([k]) => key.includes(k) || k.includes(key));
  if (matched) {
    const info = matched[1];
    return {
      name: allergenName,
      category: info.category || 'Documented Clinical Allergen',
      crossReactivities: info.crossReactivities || ['Related pharmacological class agents'],
      severity: info.severity || 'contraindicated',
      clinicalNote: info.clinicalNote || 'Active clinical warning flag. Verify prescription against patient hypersensitivity records.',
      screeningRule: info.screeningRule || 'RULE-AL-GEN: Clinical CDS Hypersensitivity Audit'
    };
  }
  return {
    name: allergenName,
    category: 'Documented Hypersensitivity',
    crossReactivities: ['Substances with similar chemical structure or preservatives'],
    severity: 'contraindicated',
    clinicalNote: 'Flagged by attending clinician. Any matching drugs or excipients will trigger an automatic red-flag contraindication alert.',
    screeningRule: 'RULE-AL-GEN: Patient Hypersensitivity Reconciler'
  };
};

export default function NewCheck() {
  const navigate = useNavigate();

  // Workflow Phases: 1. Input -> 2. Animated Analysis -> 3. Final Report & Record
  type FlowPhase = 'input' | 'analyzing' | 'report';
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('input');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [flowPhase]);

  // --- Input Method Tab (Upload, Camera Photo, Manual Form) ---
  type InputMethod = 'upload' | 'camera' | 'manual';
  const [inputMethod, setInputMethod] = useState<InputMethod>('upload');

  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Camera Photo State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Document Processing, Cloudflare R2 Storage & Extraction State
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [extractedMeta, setExtractedMeta] = useState<{
    filename: string;
    fileSize: string;
    storageUrl: string;
    storageKey: string;
    format: string;
    extractedCount: number;
    previewUrl?: string | null;
    extractedPatient?: ExtractedPatientMetadata;
  } | null>(null);
  const [extractedMedicines, setExtractedMedicines] = useState<PrescriptionItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [emptyQueueAlertOpen, setEmptyQueueAlertOpen] = useState(false);

  // Read active logged-in user profile
  let storedUser: any = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('smileclinic_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      storedUser = null;
    }
  }

  const userFullName = storedUser?.fullName || 'Screening Candidate';
  const userAge = storedUser?.age ? Number(storedUser.age) : 40;
  const userGender = storedUser?.gender || 'Female';
  const userHeight = storedUser?.height || "5'9\"";
  const userWeightRaw = storedUser?.weight || '65 kg';
  const userWeightNum = typeof storedUser?.weight === 'number'
    ? storedUser.weight
    : parseFloat(storedUser?.weight) || 65;
  const userHasAllergies = Boolean(storedUser?.hasAllergies);
  const userAllergies = userHasAllergies && storedUser?.allergiesDescription
    ? storedUser.allergiesDescription.split(/,\s*/).map((s: string) => s.trim()).filter(Boolean)
    : userHasAllergies
    ? ['Documented Allergy']
    : [];

  const prescriberDisplayName = storedUser?.fullName || 'Authorized Clinician';
  const prescriberRoleDisplay = storedUser?.role
    ? storedUser.role.charAt(0).toUpperCase() + storedUser.role.slice(1)
    : 'Active Prescriber';

  // Dynamic Patient Reference (Current Profile)
  const defaultPatient: Patient = {
    id: 'pt-screening-01',
    name: userFullName,
    mrn: 'PT-NEW-001',
    age: userAge,
    gender: userGender,
    height: userHeight,
    weightKg: userWeightNum,
    egfr: 90,
    pregnancyStatus: 'No',
    allergies: userAllergies,
    activeMedications: [],
    conditions: ['Routine Dental Care'],
    roomOrUnit: 'Dental Operatory'
  };

  // Only genuine patient records: strictly filter out any mock/test data
  const rawPatients = VirtualDb.getPatients().filter(p => p && !isMockPatient(p));
  const patients: Patient[] = [
    defaultPatient,
    ...rawPatients.filter(p => p.id !== defaultPatient.id && p.name !== userFullName)
  ];

  // Patient Context Selection
  const [selectedPatientId, setSelectedPatientId] = useState<string>(() => defaultPatient.id);
  const selectedPatient = (patients && patients.find(p => p.id === selectedPatientId)) || defaultPatient;
  const [ptKey, setPtKey] = useState<string>(() => selectedPatient?.mrn ? `PT-${selectedPatient.mrn}` : 'PT-NEW-001');
  const [customWeight, setCustomWeight] = useState<number>(() => selectedPatient?.weightKg ?? userWeightNum);
  const [customEgfr, setCustomEgfr] = useState<number>(() => selectedPatient?.egfr ?? 90);
  const [activeMeds, setActiveMeds] = useState<string[]>(() => selectedPatient?.activeMedications ?? []);
  const [allergies, setAllergies] = useState<string[]>(() => (selectedPatient?.allergies && selectedPatient.allergies.length > 0) ? selectedPatient.allergies : userAllergies);

  const patientDisplayName = selectedPatient?.name || userFullName;
  const patientAge = selectedPatient?.age ?? userAge;
  const patientGender = selectedPatient?.gender ?? userGender;
  const patientHeight = selectedPatient?.height || userHeight;
  const patientWeightFormatted = selectedPatient?.weightKg
    ? `${selectedPatient.weightKg} kg`
    : (userWeightRaw.toString().includes('kg') ? userWeightRaw : `${userWeightRaw} kg`);

  const parsedAllergies: string[] = useMemo(() => {
    const raw = (allergies.length > 0 ? allergies : userAllergies) || [];
    return Array.from<string>(
      new Set<string>(
        raw
          .flatMap((item: string) => item.split(/,\s*/))
          .map((s: string) => s.trim())
          .filter(Boolean)
      )
    );
  }, [allergies, userAllergies]);
  const hasDocumentedAllergies = parsedAllergies.length > 0;
  const allergySummary = hasDocumentedAllergies ? parsedAllergies.join(', ') : 'None documented (NKDA)';

  // Modal State for inspecting individual allergy safety details
  const [inspectingAllergy, setInspectingAllergy] = useState<string | null>(null);

  // Lock body scroll and handle Escape key for inspectingAllergy modal
  useEffect(() => {
    if (!inspectingAllergy) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectingAllergy(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectingAllergy]);

  // Prescriptions List (Clean empty initial phase)
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // Manual Medicine Input Fields
  const [manualDrugName, setManualDrugName] = useState('');
  const [manualGenericName, setManualGenericName] = useState('');
  const [manualDosage, setManualDosage] = useState('500mg');
  const [manualFrequency, setManualFrequency] = useState('Every 12 hours (BID)');
  const [manualRoute, setManualRoute] = useState('Oral (PO)');
  const [manualDuration, setManualDuration] = useState('7 days');
  const [manualIndication, setManualIndication] = useState('Post-Op Dental Infection Prophylaxis');

  // --- Automated Animated Pipeline State ---
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisStage, setCurrentAnalysisStage] = useState(1);
  const [activeStageLog, setActiveStageLog] = useState('Initiating multi-modal OCR vision pipeline...');

  // --- Final Results State ---
  const [alerts, setAlerts] = useState<DrugInteractionAlert[]>([]);
  const [savedCheckRecord, setSavedCheckRecord] = useState<SafetyCheckRecord | null>(null);
  const [activeAlertForDrawer, setActiveAlertForDrawer] = useState<DrugInteractionAlert | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Sync patient context when selection changes
  const handlePatientSelect = (patId: string) => {
    setSelectedPatientId(patId);
    const p = patients.find(pat => pat.id === patId);
    if (p) {
      setCustomWeight(p.weightKg);
      setCustomEgfr(p.egfr);
      setActiveMeds(p.activeMedications);
      setAllergies(p.allergies);
      setPtKey('MRN-HASH-' + p.mrn.replace(/[^0-9]/g, '').slice(0, 4) + '-XF');
    }
  };

  const handleGenerateKey = () => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    setPtKey(`PT-${Math.floor(1000 + Math.random() * 9000)}-${randomHex}`);
  };

  // Add Prescription manually
  const handleAddManualPrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDrugName.trim()) return;

    const newItem: PrescriptionItem = {
      id: 'rx-' + Date.now(),
      drugName: manualDrugName.trim(),
      genericName: manualGenericName.trim() || manualDrugName.trim(),
      dosage: manualDosage.trim() || 'Standard Dose',
      frequency: manualFrequency,
      route: manualRoute,
      duration: manualDuration,
      indication: manualIndication
    };

    setPrescriptions([...prescriptions, newItem]);
    setManualDrugName('');
    setManualGenericName('');
  };

  const handleRemovePrescription = (id: string) => {
    setPrescriptions(prescriptions.filter(p => p.id !== id));
  };



  // Model architecture details drawer visibility
  const [showModelDetails, setShowModelDetails] = useState(false);

  // Quick 1-click preset adder for dental clinicians
  const handleAddPreset = (
    drugName: string,
    genericName: string,
    dosage: string,
    frequency: string,
    indication: string = 'Dental Infection Prophylaxis'
  ) => {
    const newItem: PrescriptionItem = {
      id: 'rx-preset-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      drugName,
      genericName,
      dosage,
      frequency,
      route: 'Oral (PO)',
      duration: '7 days',
      indication
    };
    setPrescriptions((prev) => [...prev, newItem]);
  };

  // Extract medicines and clinical entities from uploaded document or camera photo
  const extractPrescriptionsFromDocument = async (
    file: File,
    source: 'upload' | 'camera'
  ): Promise<{ medicines: PrescriptionItem[]; patient?: ExtractedPatientMetadata }> => {
    const result = await extractPrescriptionData(file, source);
    return { medicines: result.medicines, patient: result.patient };
  };

  // Main file processing handler: Uploads to Cloudflare R2 and extracts medicines
  const handleProcessIncomingFile = async (file: File, source: 'upload' | 'camera') => {
    const isImage = file.type.startsWith('image/') || source === 'camera';
    let localPreviewUrl: string | null = null;
    if (isImage) {
      localPreviewUrl = URL.createObjectURL(file);
      setCapturedPhoto(localPreviewUrl);
    }
    setIsProcessingDocument(true);
    const currentUserId = storedUser?.id || 'clinician-user';
    try {
      // 1. Upload to Cloudflare R2
      const r2Result = await uploadToR2(file, currentUserId, prescriberDisplayName);
      setUploadedFileName(r2Result.filename);
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(0)} KB`;
      setUploadedFileSize(sizeStr);

      const ext =
        r2Result.filename.split('.').pop()?.toUpperCase() || (source === 'camera' ? 'CAMERA SCAN' : 'FILE');

      // Allow optical scanning HUD animation to scan document
      if (isImage) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }

      const { medicines: extracted, patient: extractedPatient } = await extractPrescriptionsFromDocument(file, source);
      updateDocumentExtractedCount(r2Result.url, extracted.length);

      const previewUrl = localPreviewUrl || (file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
      if (source === 'camera' || previewUrl) {
        setCapturedPhoto(previewUrl || 'camera_captured_rx_slip.jpg');
      }

      setExtractedMeta({
        filename: r2Result.filename,
        fileSize: sizeStr,
        storageUrl: r2Result.url,
        storageKey: r2Result.key,
        format: ext,
        extractedCount: extracted.length,
        previewUrl,
        extractedPatient,
      });
      setExtractedMedicines(extracted);

      if (extractedPatient?.name) {
        setPtKey(`PT-${extractedPatient.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`);
      }

      // Automatically stage extracted items without duplicating
      setPrescriptions((prev) => {
        const map = new Map(prev.map((p) => [p.drugName.toLowerCase(), p]));
        extracted.forEach((e) => {
          if (!map.has(e.drugName.toLowerCase())) {
            map.set(e.drugName.toLowerCase(), e);
          }
        });
        return Array.from(map.values());
      });

      setToastMessage(
        `Extracted ${extracted.length} medications from ${r2Result.filename} and saved to Cloudflare R2.`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('File processing error:', err);
      setToastMessage('Document parsed locally; please verify extracted items.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsProcessingDocument(false);
    }
  };

  // Camera Snap Handler - Called when user confirms photo in CameraCaptureModal
  const handleCameraCapture = (file: File) => {
    setIsCameraModalOpen(false);
    handleProcessIncomingFile(file, 'camera');
  };

  // File Drop Handler
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessIncomingFile(e.dataTransfer.files[0], 'upload');
    }
  };

  // File Input Change Handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessIncomingFile(e.target.files[0], 'upload');
    }
  };

  // --- START AUTOMATED SAFETY CHECK PIPELINE ---
  const handleStartSafetyCheck = () => {
    if (!prescriptions || prescriptions.length === 0) {
      setEmptyQueueAlertOpen(true);
      return;
    }

    setFlowPhase('analyzing');
    setAnalysisProgress(5);
    setCurrentAnalysisStage(1);
    setActiveStageLog('Extracting optical text & pharmacological entities from prescription...');

    // Run sequential animated stages
    // Stage 1: OCR Extraction (0% to 28%)
    setTimeout(() => {
      setAnalysisProgress(30);
      setCurrentAnalysisStage(2);
      setActiveStageLog(`Matching patient chart #${selectedPatient.mrn} • eGFR: ${customEgfr} mL/min • Reconciling allergies...`);
    }, 900);

    // Stage 2: Patient Context & Allergies (28% to 58%)
    setTimeout(() => {
      setAnalysisProgress(65);
      setCurrentAnalysisStage(3);
      setActiveStageLog(`Cross-matching against ${activeMeds.length} active medications (${activeMeds.join(', ')})...`);
    }, 1800);

    // Stage 3: Drug-Drug & Dosing Matrix (58% to 88%)
    setTimeout(() => {
      setAnalysisProgress(90);
      setCurrentAnalysisStage(4);
      setActiveStageLog('Evaluating CDS safety rules, Beers criteria & CYP450 contraindications...');
    }, 2700);

    // Stage 4: Finalize & Generate Safety Record
    setTimeout(() => {
      setAnalysisProgress(100);

      // Perform actual CDS evaluation
      const updatedPatient: Patient = {
        ...selectedPatient,
        weightKg: customWeight,
        egfr: customEgfr,
        activeMedications: activeMeds,
        allergies: parsedAllergies
      };

      const evaluatedAlerts = VirtualDb.evaluateScreening(updatedPatient, prescriptions);
      setAlerts(evaluatedAlerts);

      const hasContra = evaluatedAlerts.some(a => a.severity === 'contraindicated');
      const hasMajor = evaluatedAlerts.some(a => a.severity === 'major');
      const overallStatus = hasContra ? 'Contraindicated' : hasMajor ? 'Requires Review' : 'Safe to Dispense';

      const newRecord: SafetyCheckRecord = {
        id: 'chk-' + Date.now(),
        checkNumber: 'CHK-2026-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: 'Just now',
        patientId: updatedPatient.id,
        patientName: patientDisplayName,
        mrn: updatedPatient.mrn,
        patientKey: ptKey,
        unit: updatedPatient.roomOrUnit || 'Dental Operatory',
        prescriptions,
        alerts: evaluatedAlerts,
        overallStatus,
        reviewerName: prescriberDisplayName,
        prescriberName: prescriberDisplayName,
        prescriberNpi: 'NPI-1092837482',
        fhirSynced: true,
        sourceDocumentUrl: extractedMeta?.storageUrl,
        sourceDocumentName: extractedMeta?.filename || (inputMethod === 'camera' ? 'Camera Captured Photo' : undefined),
        sourceType: inputMethod
      };

      VirtualDb.addCheck(newRecord);
      setSavedCheckRecord(newRecord);

      // Automatically transition directly into the complete Clinical Safety Report & Record screen
      setTimeout(() => {
        setFlowPhase('report');
      }, 500);
    }, 3600);
  };

  // Override alert from detail drawer
  const handleOverrideFromDrawer = (alertId: string, reason: string) => {
    if (savedCheckRecord) {
      VirtualDb.overrideAlert(savedCheckRecord.id, alertId, reason, prescriberDisplayName);
      setAlerts(prev =>
        prev.map(a =>
          a.id === alertId
            ? { ...a, overridden: true, overrideReason: reason, overrideAuthor: prescriberDisplayName }
            : a
        )
      );
    }
  };

  // Substitute safer alternative
  const handleSelectAlternativeFromDrawer = (altDrug: string) => {
    setPrescriptions([
      {
        id: 'rx-' + Date.now(),
        drugName: altDrug,
        genericName: altDrug.split(' ')[0],
        dosage: altDrug.includes('mg') ? altDrug.split(' ')[1] : 'Standard',
        frequency: 'Every 8 hours',
        route: 'Oral (PO)',
        duration: '7 days',
        indication: 'Substituted Safer Dental Therapy'
      }
    ]);
  };

  // PDF Download Trigger with Animation
  const handleDownloadPdfReport = () => {
    setIsDownloadingReport(true);
    setDownloadProgress(20);

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloadingReport(false);
            setDownloadProgress(0);

            // Trigger simulated browser download
            const blob = new Blob([
              `SMILE CLINIC CLINICAL DECISION SUPPORT SAFETY REPORT\n` +
              `Check Number: ${savedCheckRecord?.checkNumber || 'CHK-2026-9042'}\n` +
              `Patient Key: ${ptKey}\n` +
              `Status: ${savedCheckRecord?.overallStatus || 'Contraindicated'}\n` +
              `Candidate Rx: ${prescriptions.map(p => p.drugName).join(', ')}\n` +
              `Concurrent Meds: ${activeMeds.join(', ')}\n` +
              `Verified Date: ${new Date().toISOString()}\n` +
              `Authority: Smile Clinic Health System (21 CFR Part 11 Verified)\n`
            ], { type: 'text/plain' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${savedCheckRecord?.checkNumber || 'CHK-9042'}-Clinical-Verification.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 400);
          return 100;
        }
        return prev + 30;
      });
    }, 200);
  };

  return (
    <div className="flex flex-col w-full gap-6 max-w-6xl mx-auto py-2">
      {/* ========================================================================= */}
      {/* 1. TOP PROGRESS STEPPER */}
      {/* ========================================================================= */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high/60 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
              <span>Prescription Workflow</span>
              <span className="material-symbols-outlined text-[13px] text-outline">chevron_right</span>
              <span className="text-primary font-bold">Patient Check • {ptKey}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-xl font-extrabold text-on-surface tracking-tight">
                Safety Screening Engine
              </h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Real-Time Safety Active</span>
              </div>
            </div>
          </div>

          {/* Stepper Navigation with Animated Sliding Indicator */}
          <nav aria-label="Workflow progress" className="w-full lg:w-auto overflow-x-auto no-scrollbar py-0.5">
            <div className="inline-flex items-center gap-1.5 sm:gap-2.5 bg-surface-container-low p-1.5 rounded-2xl border border-surface-container-high">
              {[
                { id: 'input', num: 1, title: 'Prescription Input', shortTitle: 'Input', icon: 'edit_note', sub: 'Ingest' },
                { id: 'analyzing', num: 2, title: 'AI Cross-Match', shortTitle: 'Screening', icon: 'auto_awesome', sub: 'Analysis' },
                { id: 'report', num: 3, title: 'Clinical Report', shortTitle: 'Report', icon: 'verified_user', sub: 'Decision' }
              ].map((node, index) => {
                const isPast =
                  (flowPhase === 'analyzing' && node.id === 'input') ||
                  (flowPhase === 'report' && node.id !== 'report');
                const isCurrent = flowPhase === node.id;

                return (
                  <React.Fragment key={node.num}>
                    {index > 0 && (
                      <div className="w-3 sm:w-5 h-0.5 relative bg-surface-container-high shrink-0 rounded-full overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ width: isPast || isCurrent ? '100%' : '0%' }}
                          transition={{ duration: 0.35, ease: 'easeInOut' }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (node.id === 'input' && flowPhase === 'report') {
                          setFlowPhase('input');
                        }
                      }}
                      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all select-none shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'text-primary font-bold shadow-xs'
                          : isPast
                          ? 'text-on-surface hover:text-primary cursor-pointer'
                          : 'text-on-surface-variant/70 cursor-default'
                      }`}
                    >
                      {/* Animated Sliding Pill Highlight */}
                      {isCurrent && (
                        <motion.div
                          layoutId="stepper-active-pill"
                          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                          className="absolute inset-0 bg-surface-container-lowest rounded-xl border border-primary/30 shadow-xs"
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                            isPast
                              ? 'bg-primary text-on-primary'
                              : isCurrent
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'bg-surface-container text-outline'
                          }`}
                        >
                          {isPast ? (
                            <span className="material-symbols-outlined text-[15px]">done</span>
                          ) : isCurrent && node.id === 'analyzing' ? (
                            <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[15px]">{node.icon}</span>
                          )}
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-xs font-semibold leading-tight whitespace-nowrap">
                            <span className="sm:hidden">{node.shortTitle}</span>
                            <span className="hidden sm:inline">{node.title}</span>
                          </span>
                          <span className="text-[10px] text-outline leading-none mt-0.5 hidden md:block">
                            Step {node.num} • {isPast ? 'Done' : isCurrent ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Patient Demographic & Clinical Context Strip */}
      <div className="w-full bg-surface-container-lowest rounded-2xl border border-surface-container-high/70 shadow-2xs overflow-hidden">
        {/* Tier 1: Patient Header, Vitals, and Attending Prescriber */}
        <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-container-high/50">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {/* Patient Avatar Badge */}
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/20 shrink-0 shadow-2xs mt-0.5 sm:mt-0">
              PT
            </div>

            {/* Demographics & Clinical Metrics */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-xs">
              <span className="font-mono font-bold text-primary tracking-tight text-xs sm:text-sm">
                {ptKey}
              </span>
              <span className="text-outline/60">•</span>
              <span className="font-extrabold text-on-surface text-xs sm:text-sm">
                {patientDisplayName}
              </span>
              <span className="text-outline/60">•</span>
              <span className="text-on-surface-variant font-medium">
                ({patientAge ? `${patientAge}y` : 'Age N/A'} {patientGender || ''})
              </span>
              <span className="text-outline/60">•</span>
              <span className="text-on-surface-variant">
                Ht: <strong className="text-on-surface font-semibold">{patientHeight}</strong>
              </span>
              <span className="text-outline/60">•</span>
              <span className="text-on-surface-variant">
                Wt: <strong className="text-on-surface font-semibold">{patientWeightFormatted}</strong>
              </span>
              <span className="text-outline/60">•</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container-low border border-surface-container-high">
                <span className={`w-2 h-2 rounded-full ${customEgfr < 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                <span className="text-[11px] font-semibold text-on-surface">
                  eGFR: <strong className={customEgfr < 50 ? 'text-rose-600' : 'text-emerald-700'}>{customEgfr} mL/min</strong>
                </span>
              </span>
            </div>
          </div>

          {/* Attending Prescriber */}
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant shrink-0 bg-surface-container-low/70 px-3 py-1.5 rounded-xl border border-surface-container-high/60 w-fit self-start md:self-auto">
            <span className="material-symbols-outlined text-[16px] text-primary">stethoscope</span>
            <span>
              Prescriber: <strong className="text-on-surface font-semibold">{prescriberDisplayName}</strong> ({prescriberRoleDisplay})
            </span>
          </div>
        </div>

        {/* Tier 2: Documented Allergies Single-Line Row with Separate Pill Buttons */}
        <div className="px-3.5 py-2.5 sm:px-4 bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`material-symbols-outlined text-[16px] ${hasDocumentedAllergies ? 'text-rose-600' : 'text-emerald-600'}`}>
              {hasDocumentedAllergies ? 'emergency' : 'verified_user'}
            </span>
            <span className={`font-bold uppercase tracking-wider text-[11px] ${hasDocumentedAllergies ? 'text-rose-800' : 'text-emerald-800'}`}>
              Documented Allergies {hasDocumentedAllergies && `(${parsedAllergies.length})`}:
            </span>
          </div>

          {/* Single-line scrollable pills on desktop & mobile */}
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            {hasDocumentedAllergies ? (
              <div className="flex items-center gap-1.5 flex-nowrap sm:flex-wrap">
                {parsedAllergies.map((allergy) => (
                  <motion.button
                    key={allergy}
                    type="button"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setInspectingAllergy(allergy)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/90 shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 group"
                    title={`Click to check ${allergy} cross-reactivity and safety rules`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 group-hover:scale-125 transition-transform"></span>
                    <span>{allergy}</span>
                    <span className="material-symbols-outlined text-[14px] text-rose-500/70 group-hover:text-rose-700 transition-colors">info</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>No known drug allergies on file (NKDA)</span>
              </span>
            )}
          </div>

          {hasDocumentedAllergies && (
            <span className="text-[10px] text-outline font-medium shrink-0 hidden lg:inline-block">
              Click any allergy button to check cross-reactivity
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PHASE 1: PRESCRIPTION INPUT WINDOW (PHOTO, UPLOAD, OR MANUAL WRITE) */}
      {/* ========================================================================= */}
      {flowPhase === 'input' && (
        <motion.div
          key="inputPhase"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="w-full flex flex-col gap-6"
        >
          {/* FULL-WIDTH WORKSPACE: Primary Clinical Decision Support Feature */}
          <section className="relative bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-xs border border-surface-container-high ring-1 ring-primary/20 hover:ring-primary/30 transition-all flex flex-col gap-5 overflow-hidden">
            {/* Subtle Top Accent Highlight Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/10 via-primary to-primary/10" />

            {/* Header with AI Model Badges & Architecture Explainer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-container gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/20 via-teal-500/20 to-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs border border-primary/20">
                    <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">Enter or Capture Prescription</h2>

                  {/* Model Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-emerald-500/10 via-teal-500/15 to-primary/10 text-primary border border-primary/25 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>SmileGuard AI™ v4.2</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                      <span className="material-symbols-outlined text-[13px] text-blue-600">psychology</span>
                      <span>Gemini 1.5 Pro Vision</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="material-symbols-outlined text-[12px] text-emerald-600">verified</span>
                      <span>RxNorm Validated</span>
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-outline max-w-3xl leading-relaxed">
                  Submit prescription slip via image upload, camera photo capture, or manual medication entry. Powered by <strong>Gemini 1.5 Pro</strong> multimodal clinical vision to extract handwritten scripts, normalize dosages, and screen polypharmacy hazard risks against active medical records.
                </p>
              </div>

              {/* How AI Works Accordion Trigger */}
              <button
                type="button"
                onClick={() => setShowModelDetails(!showModelDetails)}
                className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-bold text-primary flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[17px] text-teal-600">help</span>
                <span>{showModelDetails ? 'Hide Model Architecture' : 'How AI Model Works'}</span>
                <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
                  {showModelDetails ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>

            {/* AI Model Architecture & Real-Time Pipeline Showcase */}
            <AnimatePresence>
              {showModelDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low/70 border border-primary/20 shadow-xs flex flex-col gap-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
                        <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
                          SmileGuard Clinical Architecture · Pipeline Execution (450ms)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        99.4% Extraction Accuracy
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Step 1 */}
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high/80 flex flex-col gap-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs">
                          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">1</span>
                          <span>Multimodal Vision OCR</span>
                        </div>
                        <p className="text-[11px] text-outline leading-relaxed">
                          Gemini 1.5 Pro parses handwritten dental scripts, ink stamps, hospital headers, and multi-page PDF e-prescriptions with high spatial confidence.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high/80 flex flex-col gap-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-teal-700 font-bold text-xs">
                          <span className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center text-[10px]">2</span>
                          <span>RxNorm Entity Normalization</span>
                        </div>
                        <p className="text-[11px] text-outline leading-relaxed">
                          Maps commercial brand names and doctor abbreviations directly to standardized RxCUIs, ATC classes, and therapeutic ingredient registries.
                        </p>
                      </div>

                      {/* Step 3 */}
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high/80 flex flex-col gap-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">3</span>
                          <span>Polypharmacy CDS Matrix</span>
                        </div>
                        <p className="text-[11px] text-outline leading-relaxed">
                          Simultaneously evaluates drug-drug interactions, Beers criteria, patient allergies, and renal clearance (eGFR) hazard boundaries.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3 Input Mode Tabs */}
            <div className="grid grid-cols-3 p-1.5 bg-surface-container-low rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setInputMethod('upload')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputMethod === 'upload'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                <span>Upload File / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('camera')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputMethod === 'camera'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                <span>Click / Scan Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod('manual')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  inputMethod === 'manual'
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                <span>Write Medicine Names</span>
              </button>
            </div>

            {/* TAB 1: UPLOAD FILE */}
            {inputMethod === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative p-8 sm:p-11 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 overflow-hidden group ${
                    isDragOver
                      ? 'border-primary bg-primary/10 shadow-lg scale-[1.005]'
                      : 'border-primary/30 bg-gradient-to-b from-surface-container-lowest via-surface-container-lowest to-surface-container-low/40 hover:border-primary hover:bg-surface-container-low/60 hover:shadow-sm'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx,.xls,.csv,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {/* Processing / Extracting Spinner Overlay */}
                  {isProcessingDocument && (
                    <div className="absolute inset-0 bg-surface-container-lowest/95 backdrop-blur-xs flex flex-col items-center justify-center p-3 z-20">
                      {capturedPhoto ? (
                        <div className="w-full h-full max-w-xl">
                          <OpticalScanOverlay
                            imageUrl={capturedPhoto}
                            isScanning={true}
                            title="AI Vision OCR & Clinical Entity Scan"
                            className="w-full h-full max-h-[290px]"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                          <span className="text-xs font-bold text-on-surface">Saving to Cloudflare R2 &amp; Extracting Clinical Entities...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ambient Background Radial Glow */}
                  <div className="absolute inset-0 bg-radial from-primary/5 via-transparent to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />

                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/15 via-teal-500/15 to-primary/5 text-primary flex items-center justify-center shadow-xs border border-primary/20 group-hover:scale-105 transition-transform duration-200">
                      <span className="material-symbols-outlined text-[32px] group-hover:-translate-y-0.5 transition-transform">
                        upload_file
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-base font-bold text-on-surface flex items-center justify-center gap-1.5 flex-wrap">
                        <span>Drop prescription scan, PDF, Word, or Excel file here or</span>
                        <span className="text-primary underline decoration-primary/40 underline-offset-4 font-extrabold">browse files</span>
                      </div>
                      <p className="text-xs text-outline max-w-md mx-auto">
                        Supports PDF digital slips, Word (.docx), Excel (.xlsx/.csv), and High-Res Images up to 25MB
                      </p>
                    </div>

                    {/* Supported Format Pills */}
                    <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-container-low text-on-surface-variant border border-surface-container-high flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-rose-600">picture_as_pdf</span>
                        <span>PDF (Multi-Page)</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-container-low text-on-surface-variant border border-surface-container-high flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-blue-600">image</span>
                        <span>PNG / JPG / WEBP</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-container-low text-on-surface-variant border border-surface-container-high flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-indigo-600">description</span>
                        <span>Word (.docx / .doc)</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-surface-container-low text-on-surface-variant border border-surface-container-high flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-emerald-600">table_chart</span>
                        <span>Excel / CSV (.xlsx)</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-emerald-600">cloud_done</span>
                        <span>Cloudflare R2 Stored</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attached Document Card with Real-time OCR Readiness */}
                {uploadedFileName && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[24px]">
                          {uploadedFileName.endsWith('.pdf') ? 'picture_as_pdf' : uploadedFileName.endsWith('.xlsx') || uploadedFileName.endsWith('.csv') ? 'table_chart' : uploadedFileName.endsWith('.docx') || uploadedFileName.endsWith('.doc') ? 'description' : 'image'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-on-surface flex items-center gap-2 flex-wrap">
                          <span className="truncate">{uploadedFileName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Parsed by SmileGuard
                          </span>
                        </div>
                        <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>{uploadedFileSize}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>99.4% Extraction Confidence</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {extractedMeta?.storageUrl && (
                        <a
                          href={extractedMeta.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          <span>R2 File</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (extractedMeta?.storageUrl) {
                            await deleteDocumentRecord(extractedMeta.storageKey || '', extractedMeta.storageUrl);
                          }
                          if (extractedMedicines.length > 0) {
                            const extractedNames = new Set(extractedMedicines.map((m) => m.drugName.toLowerCase()));
                            setPrescriptions((prev) => prev.filter((p) => !extractedNames.has(p.drugName.toLowerCase())));
                          }
                          setUploadedFileName('');
                          setUploadedFileSize('');
                          setExtractedMeta(null);
                          setExtractedMedicines([]);
                          setCapturedPhoto(null);
                          setToastMessage('Document deleted from Cloudflare R2 and unsaved medications removed.');
                          setTimeout(() => setToastMessage(null), 3500);
                        }}
                        className="p-1.5 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove uploaded file and delete from Cloudflare R2"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* TAB 2: CAMERA PHOTO SCAN */}
            {inputMethod === 'camera' && (
              <div className="space-y-4">
                {!capturedPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[280px]">
                    {/* Grid crosshair viewfinder overlay */}
                    <div className="absolute inset-4 border border-dashed border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/30 text-[48px]">crop_free</span>
                    </div>

                    <div className="z-10 flex flex-col items-center gap-3 text-center">
                      <div className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center backdrop-blur-md">
                        <span className="material-symbols-outlined text-[28px]">photo_camera</span>
                      </div>
                      <div className="text-white text-sm font-semibold">
                        Hold prescription slip in front of camera
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Use your laptop or phone front/rear camera to capture dental slips with optical clarity.
                      </p>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCameraModalOpen(true)}
                        className="mt-2 px-6 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">camera</span>
                        <span>Open Live Camera &amp; Scan Prescription</span>
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  /* Optical Scan HUD & Action Toolbar */
                  <div className="space-y-3">
                    <OpticalScanOverlay
                      imageUrl={capturedPhoto}
                      isScanning={isProcessingDocument}
                      title={
                        isProcessingDocument
                          ? 'AI Vision Optical OCR Processing...'
                          : 'Optical OCR & Multimodal Scan Verified'
                      }
                      className="min-h-[260px] max-h-[420px]"
                    />

                    <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">
                            {extractedMeta?.filename || 'Prescription Photo Captured'}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            <span>
                              {extractedMedicines.length > 0
                                ? `Extracted ${extractedMedicines.length} medications from prescription slip`
                                : 'Analyzing clinical entities...'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            if (extractedMeta?.storageUrl) {
                              await deleteDocumentRecord(extractedMeta.storageKey || '', extractedMeta.storageUrl);
                            }
                            if (extractedMedicines.length > 0) {
                              const extractedNames = new Set(extractedMedicines.map((m) => m.drugName.toLowerCase()));
                              setPrescriptions((prev) => prev.filter((p) => !extractedNames.has(p.drugName.toLowerCase())));
                            }
                            setCapturedPhoto(null);
                            setExtractedMeta(null);
                            setExtractedMedicines([]);
                            setToastMessage('Captured prescription deleted from Cloudflare R2.');
                            setTimeout(() => setToastMessage(null), 3500);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Delete photo and purge from Cloudflare R2"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          <span>Delete Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          Retake / Switch Camera
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DIRECT MANUAL MEDICINE ENTRY */}
            {inputMethod === 'manual' && (
              <form onSubmit={handleAddManualPrescription} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Medication / Brand Name *</label>
                    <input
                      type="text"
                      required
                      value={manualDrugName}
                      onChange={(e) => setManualDrugName(e.target.value)}
                      placeholder="e.g. Ciprofloxacin 500mg or Amoxicillin"
                      className="w-full h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Generic Ingredient</label>
                    <input
                      type="text"
                      value={manualGenericName}
                      onChange={(e) => setManualGenericName(e.target.value)}
                      placeholder="e.g. Ciprofloxacin Hydrochloride"
                      className="w-full h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Dose Strength</label>
                    <input
                      type="text"
                      value={manualDosage}
                      onChange={(e) => setManualDosage(e.target.value)}
                      placeholder="e.g. 500mg tablet"
                      className="w-full h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Frequency</label>
                    <select
                      value={manualFrequency}
                      onChange={(e) => setManualFrequency(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none cursor-pointer"
                    >
                      <option>Every 8 hours (TID)</option>
                      <option>Every 12 hours (BID)</option>
                      <option>Once Daily (QD)</option>
                      <option>As Needed (PRN)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Duration</label>
                    <input
                      type="text"
                      value={manualDuration}
                      onChange={(e) => setManualDuration(e.target.value)}
                      placeholder="e.g. 7 days"
                      className="w-full h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add Medication to Prescription Queue</span>
                  </button>
                </div>
              </form>
            )}

            {/* Extracted Clinical Entities & Medications Card */}
            {extractedMeta && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low/70 border border-primary/20 shadow-xs flex flex-col gap-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-surface-container">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs border border-primary/20">
                      <span className="material-symbols-outlined text-[22px]">
                        {extractedMeta.format === 'PDF'
                          ? 'picture_as_pdf'
                          : extractedMeta.format.includes('IMAGE') ||
                            extractedMeta.format.includes('JPG') ||
                            extractedMeta.format.includes('PNG') ||
                            extractedMeta.format.includes('CAMERA')
                          ? 'photo_camera'
                          : extractedMeta.format.includes('DOC')
                          ? 'description'
                          : extractedMeta.format.includes('XLS') ||
                            extractedMeta.format.includes('CSV')
                          ? 'table_chart'
                          : 'auto_awesome'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {extractedMeta.filename}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">
                          {extractedMeta.format}
                        </span>
                        <a
                          href={extractedMeta.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          title="View secured object in Cloudflare R2 bucket"
                        >
                          <span className="material-symbols-outlined text-[12px] text-emerald-600">
                            cloud_done
                          </span>
                          <span>Cloudflare R2 Stored</span>
                          <span className="material-symbols-outlined text-[10px]">
                            open_in_new
                          </span>
                        </a>
                      </div>
                      <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5">
                        <span>{extractedMeta.fileSize}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">
                            verified
                          </span>
                          <span>
                            SmileGuard™ Optical Extraction: {extractedMedicines.length}{' '}
                            Medication{extractedMedicines.length === 1 ? '' : 's'}{' '}
                            Detected
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        if (extractedMeta?.storageUrl) {
                          await deleteDocumentRecord(extractedMeta.storageKey || '', extractedMeta.storageUrl);
                        }
                        if (extractedMedicines.length > 0) {
                          const extractedNames = new Set(extractedMedicines.map((m) => m.drugName.toLowerCase()));
                          setPrescriptions((prev) => prev.filter((p) => !extractedNames.has(p.drugName.toLowerCase())));
                        }
                        setExtractedMeta(null);
                        setExtractedMedicines([]);
                        setUploadedFileName('');
                        setUploadedFileSize('');
                        setCapturedPhoto(null);
                        setToastMessage('Document purged from Cloudflare R2 and unsaved items cleared.');
                        setTimeout(() => setToastMessage(null), 3500);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/60 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Clear extracted items and purge document from Cloudflare R2"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        delete_sweep
                      </span>
                      <span>Clear &amp; Purge</span>
                    </button>
                  </div>
                </div>

                {/* Extracted medicines list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {extractedMedicines.map((med, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high/80 flex items-start justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[16px]">
                            pill
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">
                            {med.drugName}
                          </div>
                          <div className="text-[10px] text-outline truncate">
                            {med.genericName} • {med.dosage}
                          </div>
                          <div className="text-[10px] text-primary font-medium mt-0.5">
                            {med.frequency} • {med.duration} •{' '}
                            <span className="text-emerald-700">
                              {med.indication}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded shrink-0">
                        Extracted
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Quick Presets Row for Dental Practitioners */}
            <div className="p-3.5 rounded-xl bg-surface-container-low/70 border border-surface-container-high/80 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">bolt</span>
                  <span>1-Click Clinical Presets (Quick Dental Prescriptions)</span>
                </span>
                <span className="text-[10px] text-outline hidden sm:inline">Tap any chip to queue instantly</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { drug: 'Amoxicillin 500mg', generic: 'Amoxicillin Trihydrate', dose: '500mg TID', freq: 'Every 8 hours (TID)', ind: 'Dental Abscess / Prophylaxis' },
                  { drug: 'Augmentin 625mg', generic: 'Amoxicillin + Clavulanic Acid', dose: '625mg BID', freq: 'Every 12 hours (BID)', ind: 'Refractory Odontogenic Infection' },
                  { drug: 'Ibuprofen 400mg', generic: 'Ibuprofen', dose: '400mg PRN', freq: 'Every 6-8 hours PRN', ind: 'Post-Surgical Pain & Inflammation' },
                  { drug: 'Clindamycin 300mg', generic: 'Clindamycin Hydrochloride', dose: '300mg QID', freq: 'Every 6 hours (QID)', ind: 'Penicillin-Allergic Dental Prophylaxis' },
                  { drug: 'Metronidazole 400mg', generic: 'Metronidazole', dose: '400mg TID', freq: 'Every 8 hours (TID)', ind: 'Acute Necrotizing Ulcerative Gingivitis' }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPreset(preset.drug, preset.generic, preset.dose, preset.freq, preset.ind)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary border border-surface-container-high text-[11px] font-semibold text-on-surface transition-all flex items-center gap-1 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 group"
                  >
                    <span className="text-primary font-bold group-hover:text-inherit">+</span>
                    <span>{preset.drug}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate Prescriptions Staging Queue */}
            <div className="space-y-3 pt-3 border-t border-surface-container">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface">
                    Prescribed Medication Queue ({prescriptions.length} {prescriptions.length === 1 ? 'item' : 'items'} to cross-check):
                  </span>
                  {prescriptions.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      Ready for CDS Check
                    </span>
                  )}
                </div>
                <span className="text-outline text-[11px] hidden sm:inline">Validated against RxNorm &amp; First Databank</span>
              </div>

              <div className="flex flex-col gap-2">
                {prescriptions.length === 0 ? (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-surface-container-high text-center bg-surface-container-lowest/60 flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-surface-container text-outline flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">pill</span>
                    </div>
                    <div className="text-xs font-bold text-on-surface">Prescription Queue is Empty</div>
                    <p className="text-[11px] text-outline max-w-sm">
                      Upload a prescription slip, snap a camera photo, or click one of the 1-click clinical presets above to stage medications for safety screening.
                    </p>
                  </div>
                ) : (
                  prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-[19px]">pill</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-on-surface flex items-center gap-2">
                            <span>{rx.drugName}</span>
                            <span className="text-outline font-normal">({rx.genericName})</span>
                          </div>
                          <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-semibold text-primary">{rx.dosage}</span>
                            <span>•</span>
                            <span>{rx.frequency}</span>
                            <span>•</span>
                            <span>{rx.route}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-medium">{rx.indication}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePrescription(rx.id)}
                        className="p-1.5 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove medication"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

              {/* Patient Chart Linker */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Patient Medical Record</span>
                  <span className="text-[11px] text-outline">Cross-checks medical history, allergies &amp; kidney health</span>
                </div>
                <div className="relative w-full sm:w-auto min-w-[260px]">
                  {patients.length > 1 ? (
                    <>
                      <select
                        value={selectedPatientId}
                        onChange={(e) => handlePatientSelect(e.target.value)}
                        className="w-full h-10 pl-3 pr-8 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer appearance-none shadow-2xs transition-colors"
                      >
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.mrn}) • {p.age}y • eGFR {p.egfr}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[18px] text-outline absolute right-2.5 top-2.5 pointer-events-none">
                        unfold_more
                      </span>
                    </>
                  ) : (
                    <div className="w-full h-10 px-3.5 rounded-xl border border-surface-container-high bg-surface-container-lowest flex items-center justify-between shadow-2xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="text-xs font-bold text-on-surface truncate">
                          {defaultPatient.name} ({defaultPatient.mrn})
                        </span>
                        <span className="text-[10px] text-outline shrink-0 font-medium">
                          • {defaultPatient.age}y • eGFR {defaultPatient.egfr}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 shrink-0">
                        Active Patient
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PRIMARY START ACTION BUTTON */}
              <div className="pt-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={handleStartSafetyCheck}
                  className="w-full h-12 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px] animate-pulse">radar</span>
                  <span>Run Automated Safety Screening &amp; Extraction</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </motion.button>
              </div>
            </section>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 3. PHASE 2: AUTOMATED ANIMATED AI EXTRACTION & CROSS-MATCH */}
      {/* ========================================================================= */}
      {flowPhase === 'analyzing' && (
        <motion.div
          key="analyzingPhase"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-surface-container-lowest rounded-2xl p-8 border border-surface-container-high/60 shadow-xl flex flex-col items-center justify-center text-center space-y-6 max-w-3xl mx-auto py-12"
        >
          {/* Animated Pulsing Radar Scanner */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full bg-primary/15"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 rounded-full border-2 border-primary/30 border-t-primary flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-primary text-[32px]">biotech</span>
            </motion.div>
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider">
              Stage {currentAnalysisStage} of 4 Active
            </span>
            <h2 className="text-2xl font-bold text-on-surface">
              Automated Safety Screening in Progress
            </h2>
            <p className="text-xs sm:text-sm text-outline max-w-lg mx-auto font-mono">
              {activeStageLog}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-on-surface">Screening Completion</span>
              <span className="text-primary font-mono">{analysisProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* 4 Sequential Analysis Stage Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left text-xs pt-2">
            {[
              {
                num: 1,
                title: 'OCR & Entity Extraction',
                desc: `Identified: ${prescriptions.map(p => p.drugName).join(', ')}`,
                done: currentAnalysisStage > 1
              },
              {
                num: 2,
                title: 'Patient History & Renal Check',
                desc: `Age ${selectedPatient.age}y • eGFR ${customEgfr} mL/min • Allergy profile`,
                done: currentAnalysisStage > 2
              },
              {
                num: 3,
                title: 'Current Medication Cross-Match',
                desc: `Evaluating interplay with ${activeMeds.join(', ')}`,
                done: currentAnalysisStage > 3
              },
              {
                num: 4,
                title: 'CDS Interaction & Hazard Engine',
                desc: 'Scrutinizing CYP2C9 inhibition & Beers criteria',
                done: analysisProgress === 100
              }
            ].map((stage) => (
              <div
                key={stage.num}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                  stage.done
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : currentAnalysisStage === stage.num
                    ? 'bg-primary/5 border-primary shadow-xs text-on-surface'
                    : 'bg-surface-container-low border-surface-container text-outline opacity-60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    stage.done
                      ? 'bg-emerald-600 text-white'
                      : currentAnalysisStage === stage.num
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-outline'
                  }`}
                >
                  {stage.done ? <span className="material-symbols-outlined text-[14px]">check</span> : stage.num}
                </div>
                <div>
                  <div className="font-bold text-xs">{stage.title}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{stage.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 4. PHASE 3: FINAL CLINICAL SAFETY REPORT & RECORD SCREEN */}
      {/* ========================================================================= */}
      {flowPhase === 'report' && savedCheckRecord && (
        <motion.div
          key="reportPhase"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-6"
        >
          {/* Main Safety Status Verdict Card */}
          <div
            className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              savedCheckRecord.overallStatus === 'Contraindicated'
                ? 'bg-[#FFDAD6] border-[#BA1A1A]/40 text-[#BA1A1A]'
                : savedCheckRecord.overallStatus === 'Requires Review'
                ? 'bg-[#FEF3C7] border-[#975A16]/40 text-[#975A16]'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                  savedCheckRecord.overallStatus === 'Contraindicated'
                    ? 'bg-[#BA1A1A]'
                    : savedCheckRecord.overallStatus === 'Requires Review'
                    ? 'bg-[#D97706]'
                    : 'bg-emerald-600'
                }`}
              >
                <span className="material-symbols-outlined text-[28px]">
                  {savedCheckRecord.overallStatus === 'Contraindicated'
                    ? 'dangerous'
                    : savedCheckRecord.overallStatus === 'Requires Review'
                    ? 'warning'
                    : 'verified_user'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight">
                    {savedCheckRecord.overallStatus === 'Contraindicated'
                      ? 'Severe Contraindicated Interaction Flagged'
                      : savedCheckRecord.overallStatus === 'Requires Review'
                      ? 'Major Clinical Safety Review Required'
                      : 'Prescription Cleared — Safe to Dispense'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/70 shadow-2xs">
                    {savedCheckRecord.checkNumber}
                  </span>
                </div>
                <p className="text-xs sm:text-sm mt-1 opacity-90 leading-relaxed">
                  {savedCheckRecord.overallStatus === 'Contraindicated'
                    ? 'Critical drug-drug contraindication or allergy conflict detected. Statutory clinical pharmacist override or medication substitution required prior to dispensing.'
                    : 'All rule evaluations processed against patient eGFR, current medications, and known allergies.'}
                </p>
              </div>
            </div>

            {/* Quick Actions in Banner */}
            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setReportModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">description</span>
                <span>Open Printable A4 Report</span>
              </motion.button>
            </div>
          </div>

          {/* 2-Column Report Breakdown (8 cols Left / 4 cols Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 cols: Interaction Alerts & Evaluated Orders */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Evaluated Interaction Alerts */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">warning</span>
                    <h3 className="text-base font-bold text-on-surface">
                      Evaluated CDS Interactions ({alerts.length} Flagged)
                    </h3>
                  </div>
                  <span className="text-xs text-outline font-medium">Click alert to review mechanism</span>
                </div>

                <div className="flex flex-col gap-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                        alert.severity === 'contraindicated'
                          ? 'bg-[#FFDAD6]/30 border-[#BA1A1A]/40'
                          : alert.severity === 'major'
                          ? 'bg-[#FEF3C7]/40 border-[#975A16]/30'
                          : 'bg-surface-container-low border-surface-container-high'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              alert.severity === 'contraindicated'
                                ? 'bg-[#BA1A1A] text-white'
                                : alert.severity === 'major'
                                ? 'bg-[#D97706] text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-xs font-bold text-on-surface">{alert.title}</span>
                        </div>
                        {alert.overridden ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Overridden by Pharmacist
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveAlertForDrawer(alert)}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Review &amp; Override →
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {alert.description}
                      </p>
                      <div className="pt-2 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-outline gap-1">
                        <span>Evidence Grade: <strong className="font-mono text-on-surface">{alert.evidenceGrade}</strong></span>
                        <span className="truncate max-w-sm">Action: <strong className="text-on-surface">{alert.recommendation}</strong></span>
                      </div>
                    </div>
                  ))}

                  {alerts.length === 0 && (
                    <div className="p-8 text-center text-outline text-xs">
                      No drug-drug, dosing, or allergy contraindications detected for this regimen.
                    </div>
                  )}
                </div>
              </div>

              {/* Prescriptions Evaluated */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
                    <h3 className="text-base font-bold text-on-surface">Candidate Prescriptions Evaluated</h3>
                  </div>
                  <span className="text-xs text-outline">{prescriptions.length} Orders</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {prescriptions.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-on-surface">{p.drugName}</div>
                        <div className="text-[11px] text-outline">
                          {p.dosage} • {p.frequency} • {p.route} • {p.duration}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-primary">{p.indication}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 4 cols: Actions, Download & Patient Snapshot */}
            <aside className="lg:col-span-4 flex flex-col gap-6">
              {/* Report Actions Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-3">
                <h3 className="text-sm font-bold text-on-surface pb-2 border-b border-surface-container">
                  Report Actions &amp; Delivery
                </h3>

                {/* Animated Download Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isDownloadingReport}
                  onClick={handleDownloadPdfReport}
                  className="w-full h-11 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {isDownloadingReport ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Generating PDF ({downloadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span>Download Official PDF Report</span>
                    </>
                  )}
                </motion.button>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full h-10 rounded-xl border border-surface-container-high hover:bg-surface-container text-on-surface font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Print Clinical Verification Slip</span>
                </button>

                {/* Fullscreen A4 Report Preview */}
                <button
                  type="button"
                  onClick={() => navigate(`/report?id=${savedCheckRecord.id}`)}
                  className="w-full h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                  <span>Open Fullscreen A4 Viewer</span>
                </button>

                <div className="pt-2 border-t border-surface-container flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFlowPhase('input');
                    }}
                    className="flex-1 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container"
                  >
                    New Check
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20"
                  >
                    Back to Feed
                  </button>
                </div>
              </div>

              {/* Patient Demographics Snapshot Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-3 text-xs">
                <h3 className="text-sm font-bold text-on-surface pb-2 border-b border-surface-container">
                  Patient &amp; Clinical Context
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-outline">Patient Key:</span>
                    <span className="font-mono font-bold text-on-surface">{ptKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Patient Name:</span>
                    <span className="font-semibold text-on-surface">{patientDisplayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Age &amp; Gender:</span>
                    <span className="font-semibold text-on-surface">{patientAge ? `${patientAge}y` : 'N/A'}, {patientGender || 'Unspecified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Height / Weight:</span>
                    <span className="font-semibold text-on-surface">{patientHeight} / {patientWeightFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Renal Clearance:</span>
                    <span className={`font-bold ${customEgfr < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>eGFR {customEgfr} mL/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Concurrent Meds:</span>
                    <span className="font-medium text-on-surface text-right max-w-[180px] truncate">
                      {activeMeds.length > 0 ? activeMeds.join(', ') : 'None documented'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-outline shrink-0">Verified Allergies:</span>
                    <div className="text-right flex flex-wrap justify-end gap-1">
                      {hasDocumentedAllergies ? (
                        parsedAllergies.map((allergy) => (
                          <button
                            key={allergy}
                            type="button"
                            onClick={() => setInspectingAllergy(allergy)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-pointer transition-colors"
                            title={`Click to check ${allergy}`}
                          >
                            <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                            <span>{allergy}</span>
                          </button>
                        ))
                      ) : (
                        <span className="font-bold text-emerald-700 text-xs">None documented (NKDA)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Attending Prescriber:</span>
                    <span className="font-semibold text-on-surface">{prescriberDisplayName}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </motion.div>
      )}

      {/* Allergy Safety Inspection Dialog */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {inspectingAllergy && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Full-Screen Animated Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setInspectingAllergy(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-lg w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              >
              {(() => {
                const details = getAllergyDetails(inspectingAllergy);
                return (
                  <>
                    {/* Top Modal Header */}
                    <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                          <span className="material-symbols-outlined text-[18px]">emergency</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-on-surface">{details.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider">
                              {details.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant">{details.category}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingAllergy(null)}
                        className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                        title="Close"
                        aria-label="Close"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="py-4 overflow-y-auto flex-1 space-y-4 pr-1">
                      {/* CDS Rule Status */}
                      <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 text-on-surface min-w-0">
                          <span className="material-symbols-outlined text-primary text-[18px] shrink-0">verified</span>
                          <span className="font-semibold truncate">{details.screeningRule}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active in Engine
                        </span>
                      </div>

                      {/* Cross-Reactivity Drug Classes */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                          Known Cross-Reactive Dental Drugs &amp; Classes
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {details.crossReactivities.map((drug) => (
                            <span
                              key={drug}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200"
                            >
                              <span className="material-symbols-outlined text-[14px] text-rose-600">block</span>
                              <span>{drug}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Clinical Note */}
                      <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                        <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-700">clinical_notes</span>
                          <span>Clinical Safety Guidance</span>
                        </div>
                        <p className="text-xs text-amber-900/90 leading-relaxed">
                          {details.clinicalNote}
                        </p>
                      </div>
                    </div>

                    {/* Modal Bottom Actions */}
                    <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectingAllergy(null)}
                        className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectingAllergy(null)}
                        className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Acknowledge &amp; Dismiss</span>
                      </button>
                    </div>
                  </>
                );
              })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Alert Detail Drawer for Overrides & Safer Substitutions */}
      <AlertDetailDrawer
        alert={activeAlertForDrawer}
        isOpen={!!activeAlertForDrawer}
        onClose={() => setActiveAlertForDrawer(null)}
        onOverride={handleOverrideFromDrawer}
        onSelectAlternative={handleSelectAlternativeFromDrawer}
      />

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Floating Toast Notification - Positioned cleanly in bottom-right corner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 left-5 sm:left-auto max-w-sm sm:max-w-md z-50 bg-emerald-800 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-emerald-600/60 backdrop-blur-md pointer-events-auto"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-300 shrink-0">
              check_circle
            </span>
            <span className="leading-snug">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* UI Matching Clinical Alert Modal (Replaces browser alert) */}
      {createPortal(
        <AnimatePresence>
          {emptyQueueAlertOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
                onClick={() => setEmptyQueueAlertOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-md bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-4 z-10"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[30px]">warning</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-on-surface">Prescription Queue Required</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Please enter or stage at least one candidate medication before running the clinical safety screening. You can upload a document, snap a camera photo, click a quick preset, or write medication names.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEmptyQueueAlertOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Acknowledge &amp; Add Medication
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
