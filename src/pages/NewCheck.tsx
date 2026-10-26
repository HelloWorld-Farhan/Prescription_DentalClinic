import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb, INITIAL_PATIENTS } from '../services/prescriptionService';
import { Patient, PrescriptionItem, DrugInteractionAlert, SafetyCheckRecord } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import PrintableReportModal from '../components/PrintableReportModal';

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
    ? [storedUser.allergiesDescription]
    : userHasAllergies
    ? ['Documented Allergy']
    : [];

  const prescriberDisplayName = storedUser?.fullName || 'Arthur Vance, MD';
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

  // Ensure patients list is never empty: current patient profile + clinical testing records
  const rawPatients = VirtualDb.getPatients();
  const availablePatients = rawPatients && rawPatients.length > 0 ? rawPatients : INITIAL_PATIENTS;
  const patients: Patient[] = [
    defaultPatient,
    ...availablePatients.filter(p => p.id !== defaultPatient.id && p.name !== userFullName)
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

  const allergyList = allergies.length > 0 ? allergies : userAllergies;
  const allergySummary = allergyList.length > 0 ? allergyList.join(', ') : 'None documented (NKDA)';
  const hasDocumentedAllergies = allergyList.length > 0;

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



  // Camera Snap Handler
  const handleTakePhoto = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      setIsCameraActive(false);
      setCapturedPhoto('captured_prescription_scan.jpg');
      setUploadedFileName('camera_captured_rx_slip.jpg');
      setUploadedFileSize('3.2 MB');
    }, 600);
  };

  // File Drop / Selection Handler
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFileName(file.name);
      setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    }
  };

  // --- START AUTOMATED SAFETY CHECK PIPELINE ---
  const handleStartSafetyCheck = () => {
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
        allergies: allergies
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
        fhirSynced: true
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
      VirtualDb.overrideAlert(savedCheckRecord.id, alertId, reason, 'Dr. Sarah Lin, PharmD');
      setAlerts(prev =>
        prev.map(a =>
          a.id === alertId
            ? { ...a, overridden: true, overrideReason: reason, overrideAuthor: 'Dr. Sarah Lin, PharmD' }
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
      <div className="w-full bg-surface-container-low rounded-xl border border-surface-container px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
            PT
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-bold text-on-surface">{ptKey}</span>
            <span className="text-outline">•</span>
            <span className="text-on-surface font-semibold">
              {patientDisplayName}
            </span>
            <span className="text-outline">•</span>
            <span className="text-on-surface-variant">
              ({patientAge ? `${patientAge}y` : 'Age N/A'} {patientGender || ''})
            </span>
            <span className="text-outline">•</span>
            <span className="text-on-surface-variant">
              Ht: <strong className="text-on-surface">{patientHeight}</strong>
            </span>
            <span className="text-outline">•</span>
            <span className="text-on-surface-variant">
              Wt: <strong className="text-on-surface">{patientWeightFormatted}</strong>
            </span>
            <span className="text-outline">•</span>
            <span className="inline-flex items-center gap-1 text-on-surface">
              <span className={`w-2 h-2 rounded-full ${customEgfr < 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
              eGFR: <strong className={customEgfr < 50 ? 'text-rose-600' : 'text-slate-900'}>{customEgfr} mL/min</strong>
            </span>
            <span className="text-outline">•</span>
            <span className={`inline-flex items-center gap-1 font-bold ${hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'text-rose-600' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-[14px]">
                {hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'emergency' : 'verified'}
              </span>
              Allergy: {allergySummary}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
          <span className="material-symbols-outlined text-[16px] text-primary">stethoscope</span>
          <span>Prescriber: <strong className="text-on-surface">{prescriberDisplayName}</strong> ({prescriberRoleDisplay})</span>
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
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* LEFT COLUMN: Input Forms (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-surface-container-high/60 flex flex-col gap-5">
              {/* Header with Quick Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-container gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[24px]">medication</span>
                    <h2 className="text-base sm:text-lg font-bold text-on-surface">Enter or Capture Prescription</h2>
                  </div>
                  <p className="text-xs text-outline mt-0.5">
                    Submit prescription slip via image upload, camera photo capture, or manual medication entry.
                  </p>
                </div>

              </div>

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
                    className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragOver
                        ? 'border-primary bg-primary/10'
                        : 'border-surface-container-high bg-surface-container-low/60 hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-surface-container text-primary flex items-center justify-center mb-3 shadow-xs">
                      <span className="material-symbols-outlined text-[32px]">upload_file</span>
                    </div>
                    <div className="text-sm font-bold text-on-surface">
                      Drop prescription scan here or click to browse
                    </div>
                    <p className="text-xs text-outline mt-1">
                      Supports PDF, JPG, PNG e-prescriptions up to 25MB (Multi-page enabled)
                    </p>
                  </div>

                  {/* Attached Document Card */}
                  {uploadedFileName && (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">
                            {uploadedFileName.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-on-surface">{uploadedFileName}</div>
                          <div className="text-[11px] text-outline flex items-center gap-2 mt-0.5">
                            <span>{uploadedFileSize}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              98% OCR Readiness
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                        Ready to Extract
                      </span>
                    </div>
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
                          Align handwritten Rx or hospital slip within grid guidelines for optimal text extraction.
                        </p>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleTakePhoto}
                          className="mt-2 px-6 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">camera</span>
                          <span>{isCapturing ? 'Snapping Photo...' : 'Click Photo / Scan Prescription'}</span>
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    /* Captured Photo Preview */
                    <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                          <span className="material-symbols-outlined text-[24px]">image</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-on-surface">Prescription Photo Captured</div>
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Clear illumination &amp; high-res orientation
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCapturedPhoto(null)}
                        className="px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container"
                      >
                        Retake Photo
                      </button>
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

              {/* Candidate Prescriptions Staging Queue */}
              <div className="space-y-2 pt-2 border-t border-surface-container">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-on-surface">
                    Prescribed Medication Queue ({prescriptions.length} items to cross-check):
                  </span>
                  <span className="text-outline text-[11px]">Validated against RxNorm &amp; First Databank</span>
                </div>

                <div className="flex flex-col gap-2">
                  {prescriptions.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-surface-container-high text-center text-xs text-outline bg-surface-container-lowest/50">
                      No medications in queue. Upload a prescription, scan a photo, or enter medicine details above.
                    </div>
                  ) : (
                    prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px]">pill</span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-on-surface">
                              {rx.drugName} <span className="text-outline font-normal">({rx.genericName})</span>
                            </div>
                            <div className="text-[11px] text-outline">
                              {rx.dosage} • {rx.route} • {rx.frequency} • {rx.duration}
                            </div>
                          </div>
                        </div>

                        {prescriptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePrescription(rx.id)}
                            className="p-1 rounded text-outline hover:text-rose-600"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
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
          </div>

          {/* RIGHT COLUMN: Pre-Screening Radar & Insights Preview (4 cols) */}
          <aside className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-surface-container-high/60 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">troubleshoot</span>
                  <h3 className="text-sm font-bold text-on-surface">Screening Readiness</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Engine Ready
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">medication</span>
                  <div>
                    <div className="font-bold text-on-surface">Current Medications</div>
                    <div className="text-[11px] text-outline mt-0.5">
                      Checking {activeMeds.length} active medications on file: <strong>{activeMeds.join(', ') || 'None documented'}</strong>.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-start gap-2.5">
                  <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'emergency' : 'verified'}
                  </span>
                  <div>
                    <div className="font-bold text-on-surface">Documented Allergies</div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {allergySummary}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">badge</span>
                  <div className="w-full">
                    <div className="font-bold text-on-surface">Patient Profile Vitals</div>
                    <div className="text-[11px] text-on-surface-variant mt-1 grid grid-cols-2 gap-y-1 gap-x-2">
                      <div>Name: <strong className="text-on-surface font-semibold truncate block">{patientDisplayName}</strong></div>
                      <div>Age / Gender: <strong className="text-on-surface font-semibold">{patientAge}y, {patientGender}</strong></div>
                      <div>Height: <strong className="text-on-surface font-semibold">{patientHeight}</strong></div>
                      <div>Weight: <strong className="text-on-surface font-semibold">{patientWeightFormatted}</strong></div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">health_and_safety</span>
                  <div>
                    <div className="font-bold text-on-surface">Renal Function Indicator</div>
                    <div className="text-[11px] text-outline mt-0.5">
                      eGFR {customEgfr} mL/min (Stage 3b). Renally cleared medications require dosage titration.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 text-emerald-900 text-[11px] font-medium flex items-center gap-2 border border-emerald-200 shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">lock</span>
                <span>Patient health data is securely encrypted &amp; confidential.</span>
              </div>
            </div>
          </aside>
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
                  onClick={() => navigate('/report')}
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
                  <div className="flex justify-between">
                    <span className="text-outline">Verified Allergies:</span>
                    <span className={`font-bold ${hasDocumentedAllergies && allergySummary !== 'None documented (NKDA)' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {allergySummary}
                    </span>
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

      {/* Alert Detail Drawer for Overrides & Safer Substitutions */}
      <AlertDetailDrawer
        alert={activeAlertForDrawer}
        isOpen={!!activeAlertForDrawer}
        onClose={() => setActiveAlertForDrawer(null)}
        onOverride={handleOverrideFromDrawer}
        onSelectAlternative={handleSelectAlternativeFromDrawer}
      />

      {/* Printable Report Modal */}
      <PrintableReportModal
        check={savedCheckRecord}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  );
}
