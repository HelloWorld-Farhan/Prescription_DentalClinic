import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../data/virtualDb';
import { Patient, PrescriptionItem, DrugInteractionAlert, SafetyCheckRecord } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import PrintableReportModal from '../components/PrintableReportModal';

export default function NewCheck() {
  const navigate = useNavigate();
  const patients = VirtualDb.getPatients();

  // Multi-step Wizard State (1 to 5)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Patient Context State
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0].id);
  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  const [ptKey, setPtKey] = useState<string>('MRN-HASH-9042-XF');
  const [customWeight, setCustomWeight] = useState<number>(selectedPatient.weightKg || 78.4);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [customEgfr, setCustomEgfr] = useState<number>(selectedPatient.egfr || 42);
  const [childPugh, setChildPugh] = useState<'Class A' | 'Class B' | 'Class C'>('Class A');
  const [customPregnancy, setCustomPregnancy] = useState(selectedPatient.pregnancyStatus || 'No');
  const [heightCm, setHeightCm] = useState<number>(176);

  // Step 2: Meds & Allergies
  const [activeMeds, setActiveMeds] = useState<string[]>(selectedPatient.activeMedications);
  const [newMedInput, setNewMedInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>(selectedPatient.allergies);
  const [newAllergyInput, setNewAllergyInput] = useState('');

  // Step 3: New Proposed Prescriptions
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([
    {
      id: 'rx-p1',
      drugName: 'Ciprofloxacin 500mg',
      genericName: 'Ciprofloxacin Hydrochloride',
      dosage: '500mg Film-Coated Tablet',
      frequency: 'Every 12 hours (BID)',
      route: 'Oral (PO)',
      duration: '7 days',
      indication: 'Severe Odontogenic / Maxillary Infection'
    }
  ]);

  const [drugName, setDrugName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Every 12 hours (BID)');
  const [route, setRoute] = useState('Oral (PO)');
  const [duration, setDuration] = useState('7 days');
  const [indication, setIndication] = useState('Acute Periapical Abscess');
  const [isPrn, setIsPrn] = useState(false);

  // Step 4: Extraction & Verification Flags
  const [confirmStrength, setConfirmStrength] = useState(true);
  const [confirmUnit, setConfirmUnit] = useState(true);

  // Step 5 Screening Results
  const [alerts, setAlerts] = useState<DrugInteractionAlert[]>([]);
  const [activeAlertForDrawer, setActiveAlertForDrawer] = useState<DrugInteractionAlert | null>(null);
  const [savedCheckRecord, setSavedCheckRecord] = useState<SafetyCheckRecord | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Update context when patient changes
  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId);
    const p = patients.find(pat => pat.id === patientId);
    if (p) {
      setCustomWeight(p.weightKg);
      setCustomEgfr(p.egfr);
      setCustomPregnancy(p.pregnancyStatus);
      setActiveMeds(p.activeMedications);
      setAllergies(p.allergies);
      setPtKey('MRN-HASH-' + p.mrn.replace(/[^0-9]/g, '').slice(0, 4) + '-XF');
    }
  };

  const handleAutoGenerateToken = () => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    setPtKey(`PT-${Math.floor(1000 + Math.random() * 9000)}-${randomHex}`);
  };

  const handleAddMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMedInput.trim()) {
      setActiveMeds([...activeMeds, newMedInput.trim()]);
      setNewMedInput('');
    }
  };

  const handleRemoveMed = (index: number) => {
    setActiveMeds(activeMeds.filter((_, i) => i !== index));
  };

  const handleAddAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAllergyInput.trim()) {
      setAllergies([...allergies, newAllergyInput.trim()]);
      setNewAllergyInput('');
    }
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const handleAddPrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugName.trim()) return;

    const newItem: PrescriptionItem = {
      id: 'rx-' + Date.now(),
      drugName: drugName.trim(),
      genericName: genericName.trim() || drugName.trim(),
      dosage: dosage.trim() || 'Standard Dose',
      frequency,
      route,
      duration,
      indication
    };

    setPrescriptions([...prescriptions, newItem]);
    setDrugName('');
    setGenericName('');
    setDosage('');
  };

  const handleRemovePrescription = (id: string) => {
    setPrescriptions(prescriptions.filter(p => p.id !== id));
  };

  const handleQuickAddDental = (name: string, gen: string, dose: string, freq: string, dur: string, ind: string) => {
    setPrescriptions([
      ...prescriptions,
      {
        id: 'rx-' + Date.now(),
        drugName: name,
        genericName: gen,
        dosage: dose,
        frequency: freq,
        route: 'Oral (PO)',
        duration: dur,
        indication: ind
      }
    ]);
  };

  // Run Real-Time Safety Screening
  const runSafetyScreen = () => {
    const updatedPatient: Patient = {
      ...selectedPatient,
      weightKg: customWeight,
      egfr: customEgfr,
      pregnancyStatus: customPregnancy,
      activeMedications: activeMeds,
      allergies: allergies
    };

    const screenAlerts = VirtualDb.evaluateScreening(updatedPatient, prescriptions);
    setAlerts(screenAlerts);

    const hasContra = screenAlerts.some(a => a.severity === 'contraindicated');
    const hasMajor = screenAlerts.some(a => a.severity === 'major');
    const status = hasContra ? 'Contraindicated' : hasMajor ? 'Requires Review' : 'Safe to Dispense';

    const newRecord: SafetyCheckRecord = {
      id: 'chk-' + Date.now(),
      checkNumber: 'CHK-2026-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: 'Just now',
      patientId: updatedPatient.id,
      patientName: updatedPatient.name,
      mrn: updatedPatient.mrn,
      patientKey: ptKey,
      unit: updatedPatient.roomOrUnit || 'Dental Surgery & Inpatient',
      prescriptions,
      alerts: screenAlerts,
      overallStatus: status,
      reviewerName: 'Dr. Sarah Lin, PharmD',
      prescriberName: 'Arthur Vance, MD',
      prescriberNpi: 'NPI-1092837482',
      fhirSynced: true
    };

    VirtualDb.addCheck(newRecord);
    setSavedCheckRecord(newRecord);
    setCurrentStep(5);
  };

  const handleOverrideFromDrawer = (alertId: string, reason: string) => {
    if (savedCheckRecord) {
      VirtualDb.overrideAlert(savedCheckRecord.id, alertId, reason, 'Dr. Sarah Lin, PharmD');
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, overridden: true, overrideReason: reason, overrideAuthor: 'Dr. Sarah Lin, PharmD' } : a));
    }
  };

  const handleSelectAlternativeFromDrawer = (altDrug: string) => {
    setPrescriptions(prev => [
      ...prev.slice(1),
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

  const bmi = (customWeight / Math.pow(heightCm / 100, 2)).toFixed(1);

  return (
    <div className="flex flex-col w-full gap-6 max-w-6xl mx-auto">
      {/* 1. Stepper Header Strip */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high/60 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
              <span>Clinical Workflow</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Rx-PreCheck Session: {ptKey}</span>
            </div>
            <div className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span>Safety Check Verification Engine</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                FHIR R4 Ingest
              </span>
            </div>
          </div>

          {/* Stepper Nodes */}
          <nav aria-label="Workflow progress" className="flex items-center gap-1 sm:gap-2">
            {[
              { num: 1, label: '1. Patient' },
              { num: 2, label: '2. Regimen' },
              { num: 3, label: '3. Order' },
              { num: 4, label: '4. Extraction' },
              { num: 5, label: '5. CDS Results' }
            ].map((node, index) => {
              const isPast = currentStep > node.num;
              const isCurrent = currentStep === node.num;

              return (
                <React.Fragment key={node.num}>
                  {index > 0 && (
                    <div className={`w-3 sm:w-4 h-0.5 ${isPast ? 'bg-primary-container' : 'bg-surface-container-high'}`} />
                  )}
                  <div
                    onClick={() => {
                      if (node.num < currentStep) setCurrentStep(node.num as any);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full cursor-pointer transition-all ${
                      isCurrent ? 'bg-primary/10 ring-2 ring-primary ring-offset-1' : ''
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isPast
                          ? 'bg-primary-container text-on-primary'
                          : isCurrent
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {isPast ? <span className="material-symbols-outlined text-[14px]">check</span> : node.num}
                    </div>
                    <span className={`hidden md:inline text-xs font-semibold ${
                      isCurrent ? 'text-primary font-bold' : isPast ? 'text-on-surface' : 'text-on-surface-variant'
                    }`}>
                      {node.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Patient Context Strip */}
      <div className="w-full bg-surface-container-low rounded-xl border border-surface-container px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-xs">
            PT
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-on-surface">{ptKey}</span>
            <span className="text-outline">•</span>
            <span className="text-on-surface-variant">{selectedPatient.name} (64y Male)</span>
            <span className="text-outline">•</span>
            <span className="inline-flex items-center gap-1 text-on-surface">
              <span className={`w-2 h-2 rounded-full ${customEgfr < 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
              eGFR: <strong className={customEgfr < 50 ? 'text-rose-600' : 'text-slate-900'}>{customEgfr} mL/min</strong>
            </span>
            <span className="text-outline">•</span>
            <span className="inline-flex items-center gap-1 font-bold text-rose-600">
              <span className="material-symbols-outlined text-[14px]">emergency</span>
              Allergy: {allergies[0] || 'Penicillin'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] text-primary">stethoscope</span>
          <span>Prescriber: <strong className="text-on-surface">Arthur Vance, MD</strong> (Inpatient & Surgery)</span>
        </div>
      </div>

      {/* STEP CONTENT SWITCHER */}
      <AnimatePresence mode="wait">
        {/* STEP 1: PATIENT CONTEXT */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left 8 cols: Form */}
            <div className="lg:col-span-8 space-y-6">
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-surface-container-high/60 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[24px]">badge</span>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-on-surface">Identification & Physical Metrics</h2>
                      <p className="text-xs text-on-surface-variant">Validated demographics for baseline clearances</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold">
                    Section 1A
                  </span>
                </div>

                {/* Pseudonymous Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block" htmlFor="pt-key">
                    Pseudonymous Patient Key <span className="text-error">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="pt-key"
                      type="text"
                      value={ptKey}
                      onChange={(e) => setPtKey(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGenerateToken}
                      className="h-10 px-4 rounded-xl bg-surface-container-high text-primary hover:bg-surface-container text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">key</span>
                      <span>Auto-generate</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Cryptographic collision-free pseudonym mapped within local EMR enclave under HIPAA safe harbor.
                  </p>
                </div>

                {/* Select Clinic Patient */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block">Associated Clinic Chart</label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handlePatientChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-semibold outline-none cursor-pointer"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mrn}) — {p.age}y • {p.gender} • {p.roomOrUnit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Physical Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {/* Weight */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface">Current Weight</label>
                      <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setWeightUnit('kg')}
                          className={`px-2 py-0.5 rounded-md font-bold ${weightUnit === 'kg' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                        >
                          kg
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeightUnit('lb')}
                          className={`px-2 py-0.5 rounded-md font-bold ${weightUnit === 'lb' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                        >
                          lb
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={customWeight}
                      onChange={(e) => setCustomWeight(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-emerald-700 block">Verified today by Nursing</span>
                  </div>

                  {/* Height */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface">Height (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(parseFloat(e.target.value) || 170)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-on-surface-variant block">Derived BMI: <strong>{bmi} kg/m²</strong></span>
                  </div>

                  {/* eGFR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface">Renal eGFR</label>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${customEgfr < 50 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {customEgfr < 30 ? 'Stage G4' : customEgfr < 60 ? 'Stage G3b' : 'Stage G1/G2'}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={customEgfr}
                      onChange={(e) => setCustomEgfr(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-outline block">mL/min/1.73m²</span>
                  </div>
                </div>

                {/* Organ Clearances & Special Populations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface">Hepatic Function (Child-Pugh)</label>
                    <select
                      value={childPugh}
                      onChange={(e) => setChildPugh(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-semibold outline-none"
                    >
                      <option value="Class A">Class A (Mild Impairment 5-6)</option>
                      <option value="Class B">Class B (Moderate Impairment 7-9)</option>
                      <option value="Class C">Class C (Severe Impairment 10-15)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface">Pregnancy & Lactation</label>
                    <select
                      value={customPregnancy}
                      onChange={(e) => setCustomPregnancy(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-semibold outline-none"
                    >
                      <option value="No">No / Not Applicable</option>
                      <option value="First Trimester">First Trimester</option>
                      <option value="Second Trimester">Second Trimester</option>
                      <option value="Third Trimester">Third Trimester</option>
                      <option value="Lactating">Lactating / Breastfeeding</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Proceed to Step 2: Meds & Allergies</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Right 4 cols: Info Cards */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high/60 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Safe Harbor Standards</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  No direct patient identifiers (full names, SSN, street addresses) should ever be entered into the CDS engine. All records are processed under de-identification safe harbor standards (45 CFR §164.514).
                </p>
                <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface">
                  <strong>Current Chart Token: </strong>
                  <span className="font-mono text-primary font-bold">{ptKey}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: MEDS & ALLERGIES */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-on-surface">Active Medications & Documented Allergies</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">
                      {activeMeds.length} Active Regimens
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Prioritize agents with narrow therapeutic indexes, active renal elimination, or CYP450 activity.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMeds([...activeMeds, 'Warfarin Sodium 5mg PO QD'])}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-bold text-xs border border-surface-container-high transition-colors"
                  >
                    + Add Warfarin (Coumadin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMeds([...activeMeds, 'Lisinopril 20mg PO QD'])}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-bold text-xs border border-surface-container-high transition-colors"
                  >
                    + Add Lisinopril
                  </button>
                </div>
              </div>

              {/* Active Meds Table */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">medication</span>
                  <span>Active Medication Regimens ({activeMeds.length})</span>
                </label>

                <div className="divide-y divide-surface-container border border-surface-container-high rounded-xl overflow-hidden text-xs">
                  {activeMeds.map((med, idx) => (
                    <div key={idx} className="p-3 bg-surface-container-lowest flex items-center justify-between gap-3 hover:bg-surface-container-low/50">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-on-surface block">{med}</span>
                          <span className="text-[11px] text-on-surface-variant font-mono">RxNorm Code #855332 • Ongoing Therapy</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMed(idx)}
                        className="text-outline hover:text-error p-1"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddMed} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newMedInput}
                    onChange={(e) => setNewMedInput(e.target.value)}
                    placeholder="Type medication name (e.g., Warfarin 5mg QD, Lisinopril 20mg)..."
                    className="flex-1 h-10 px-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs text-on-surface outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary-container cursor-pointer"
                  >
                    + Add Medication
                  </button>
                </form>
              </div>

              {/* Documented Allergies */}
              <div className="space-y-3 pt-3 border-t border-surface-container">
                <label className="text-xs font-bold text-rose-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">warning</span>
                  <span>Documented Drug Allergies & Hypersensitivities ({allergies.length})</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {allergies.map((allergy, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold">
                      <span>{allergy}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(idx)}
                        className="text-rose-400 hover:text-rose-700 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddAllergy} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newAllergyInput}
                    onChange={(e) => setNewAllergyInput(e.target.value)}
                    placeholder="Add drug allergy (e.g., Penicillin Anaphylaxis, Sulfa, Aspirin)..."
                    className="flex-1 h-10 px-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs text-on-surface outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    + Add Allergy
                  </button>
                </form>
              </div>

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer"
                >
                  ← Back to Step 1
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Proceed to Step 3: Prescriptions</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: PROPOSED PRESCRIPTIONS */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs space-y-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">Step 3: Candidate Medication Order</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Validated against National Drug Code & First Databank v2025.
                </p>
              </div>

              {/* Quick Regimen Templates */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Quick Clinical Prescribing Templates
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickAddDental('Ciprofloxacin 500mg', 'Ciprofloxacin HCl', '500mg Tablet', 'Every 12 hours (BID)', '7 days', 'Severe Maxillary Infection')}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface border border-surface-container-high flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                    Ciprofloxacin 500mg (Fluoroquinolone)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddDental('Amoxicillin 500mg', 'Amoxicillin', '500mg Capsule', 'Every 8 hours (TID)', '7 days', 'Odontogenic Infection')}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface border border-surface-container-high flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                    Amoxicillin 500mg (Antibiotic)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddDental('Ibuprofen 600mg', 'Ibuprofen', '600mg Tablet', 'Every 6 hours PRN', '5 days', 'Post-Extraction Dental Pain')}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface border border-surface-container-high flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                    Ibuprofen 600mg (NSAID)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddDental('Clindamycin 300mg', 'Clindamycin HCl', '300mg Capsule', 'Every 8 hours (TID)', '7 days', 'Penicillin-Allergic Alternative')}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface border border-surface-container-high flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                    Clindamycin 300mg (Alternative)
                  </button>
                </div>
              </div>

              {/* Prescriptions List */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-on-surface block">
                  Prescriptions Under Evaluation ({prescriptions.length})
                </label>
                <div className="divide-y divide-surface-container border border-surface-container-high rounded-xl overflow-hidden text-xs">
                  {prescriptions.map((p) => (
                    <div key={p.id} className="p-3.5 bg-surface-container-lowest flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-on-surface">{p.drugName} ({p.genericName})</div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
                          {p.dosage} • {p.frequency} • {p.route} • {p.duration} — <span className="font-semibold text-primary">{p.indication}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePrescription(p.id)}
                        className="text-outline hover:text-error p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form to Add Item */}
              <form onSubmit={handleAddPrescription} className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-3 text-xs">
                <span className="font-bold text-primary block">Add Candidate Order Form</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    placeholder="Brand Name (e.g., Cipro 500mg)"
                    className="h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-high text-on-surface outline-none"
                  />
                  <input
                    type="text"
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder="Generic Substance"
                    className="h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-high text-on-surface outline-none"
                  />
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="Dosage & Strength"
                    className="h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-high text-on-surface outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!drugName.trim()}
                    className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary-container disabled:opacity-40 cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>
              </form>

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer"
                >
                  ← Back to Step 2
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  disabled={prescriptions.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span>Proceed to Step 4: Extraction & Reconcile</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: EXTRACTION & VALIDATION REVIEW */}
        {currentStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Split View Workdesk */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* LEFT PANEL (5 cols): OCR Scan Overlay Canvas */}
              <div className="xl:col-span-5 bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">picture_as_pdf</span>
                    <span className="text-xs font-bold text-on-surface">prescription_order_scan.pdf</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    300 DPI OCR Synced
                  </span>
                </div>

                {/* Simulated Prescription Scan Sheet with Bounding Boxes */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-900 font-mono text-xs space-y-3">
                  <div className="text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-200">
                    Smile Clinic Inpatient Center • Prescriber: Dr. Arthur Vance
                  </div>

                  {/* BBox 1: Patient */}
                  <div className="p-2 rounded bg-emerald-500/10 border-2 border-emerald-500">
                    <div className="text-[10px] text-emerald-800 font-bold">MATCH 99% • PATIENT_ID</div>
                    <div className="font-bold">{ptKey} (64y Male)</div>
                  </div>

                  {/* BBox 2: Candidate Drug */}
                  <div className="p-2 rounded bg-emerald-500/10 border-2 border-emerald-500">
                    <div className="text-[10px] text-emerald-800 font-bold">MATCH 98% • CANDIDATE_RX</div>
                    <div className="font-bold">Rx: {prescriptions[0]?.drugName || 'Ciprofloxacin 500mg'}</div>
                  </div>

                  {/* BBox 3: Ambiguous Strength (Amber) */}
                  <div className="p-2 rounded bg-amber-500/15 border-2 border-amber-500">
                    <div className="text-[10px] text-amber-900 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">warning</span>
                      OCR CONFLICT (58%) • RESOLVED AS 500mg
                    </div>
                    <div className="text-slate-800 text-[11px]">
                      Strength: <span className="line-through text-red-500">0.5g</span> / 500 mg Film-Coated Tablet
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL (7 cols): Extraction Validation Pipeline */}
              <div className="xl:col-span-7 bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-high/60 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Extraction Validation Pipeline</h3>
                    <p className="text-xs text-on-surface-variant">6 data tokens parsed • Clinician verification confirmed</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                    100% Verified
                  </span>
                </div>

                {/* Flagged Verification Checks */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">Field: Strength & Formulation</span>
                      <span className="font-mono text-[10px] text-amber-800">RxNorm: 197507</span>
                    </div>
                    <p className="text-[11px] text-amber-900/90">
                      Standard adult fluoroquinolone oral dosage recommendation indicates 500mg BID. Confirmed metric units.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                      <input
                        type="checkbox"
                        checked={confirmStrength}
                        onChange={(e) => setConfirmStrength(e.target.checked)}
                        className="w-4 h-4 text-primary accent-primary"
                      />
                      <span>Confirmed strength as 500 mg Film-Coated Tablet</span>
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">Field: Administration Route & Frequency</span>
                      <span className="font-mono text-[10px] text-amber-800">SNOMED: 260548002</span>
                    </div>
                    <p className="text-[11px] text-amber-900/90">
                      Sig specifies oral Q12H interval. Mapped to calculate cumulative clearance.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                      <input
                        type="checkbox"
                        checked={confirmUnit}
                        onChange={(e) => setConfirmUnit(e.target.checked)}
                        className="w-4 h-4 text-primary accent-primary"
                      />
                      <span>Confirmed route as Oral (PO) every 12 hours</span>
                    </label>
                  </div>
                </div>

                {/* Step Navigation & Execution */}
                <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer"
                  >
                    ← Edit Order
                  </button>
                  <button
                    type="button"
                    onClick={runSafetyScreen}
                    className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">shield_with_heart</span>
                    <span>Execute Deterministic Safety Check</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 5: CDS SAFETY RESULTS (9 DETERMINISTIC BATTERY MATRIX) */}
        {currentStep === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Status Declaration Banner */}
            <div className="w-full rounded-2xl bg-surface-container-low border border-surface-container-high p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">verified_user</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-fixed text-on-secondary-fixed-variant">
                      Needs Professional Review
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      Clinical Decision Support Rule Engine v4.2
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    This is not a definitive declaration that the prescription is safe or unsafe. Pharmacist adjudication is required prior to dispense.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Export CDS Summary</span>
              </button>
            </div>

            {/* Severity Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-error/20 flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs text-on-surface-variant font-medium">High Severity</div>
                  <div className="text-2xl font-black text-error leading-tight">
                    {alerts.filter(a => a.severity === 'contraindicated').length || 1}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">dangerous</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs text-on-surface-variant font-medium">Moderate Severity</div>
                  <div className="text-2xl font-black text-[#B7791F] leading-tight">
                    {alerts.filter(a => a.severity === 'major').length || 2}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#FEFCBF] text-[#B7791F] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs text-on-surface-variant font-medium">Info / Caution</div>
                  <div className="text-2xl font-black text-secondary leading-tight">1</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-secondary-fixed text-on-secondary-fixed-variant flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs text-on-surface-variant font-medium">No Alert Found</div>
                  <div className="text-2xl font-black text-emerald-600 leading-tight">5</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
              </div>
            </div>

            {/* Systematic Deterministic Safety Battery (9 Modules Evaluated) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                  <span>Systematic Deterministic Safety Battery (9 Modules Evaluated)</span>
                </h3>
                <span className="text-xs text-outline font-mono">CDS Protocol v4.18.2-SaMD</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. DDI */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-error text-[18px]">sync_problem</span>
                        1. Drug–Drug Interaction
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold">
                        High Alert
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      Ciprofloxacin inhibits CYP1A2 & CYP3A4, potentiating Warfarin (Coumadin) anticoagulant effect; major bleeding hazard.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between text-xs">
                    <span className="text-error font-bold">Flagged: Potentiation</span>
                    <button
                      type="button"
                      onClick={() => {
                        const alertItem = alerts[0] || {
                          id: 'DDI-01',
                          severity: 'contraindicated',
                          title: 'Warfarin + Ciprofloxacin CYP1A2 Blockade',
                          description: 'Marked prolongation of INR and clinical hemorrhage danger.',
                          mechanism: 'CYP1A2 / CYP3A4 hepatic inhibition',
                          recommendation: 'Select non-interacting alternative antibiotic.'
                        };
                        setActiveAlertForDrawer(alertItem as any);
                      }}
                      className="text-primary font-bold hover:underline"
                    >
                      View details →
                    </button>
                  </div>
                </div>

                {/* 2. Dose & Frequency */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-error text-[18px]">speed</span>
                        2. Dose and Frequency
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold">
                        High Alert
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      Dose 500mg Q12H exceeds recommended renal threshold for eGFR {customEgfr} mL/min (recommend 250–500mg Q18–24H).
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between text-xs">
                    <span className="text-error font-bold">Renal Mismatch</span>
                    <button
                      type="button"
                      onClick={() => {
                        const alertItem = alerts.find(a => a.severity === 'major') || alerts[0];
                        setActiveAlertForDrawer(alertItem as any);
                      }}
                      className="text-primary font-bold hover:underline"
                    >
                      View details →
                    </button>
                  </div>
                </div>

                {/* 3. Allergy & Cross Reactivity */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">security</span>
                        3. Allergy & Cross-Reactivity
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-medium">
                        No alert found
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      No structural beta-lactam overlap between fluoroquinolones and documented Penicillin allergy.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container text-xs text-emerald-700 font-bold">
                    Safe: Non-reactive
                  </div>
                </div>

                {/* 4. Duplicate Therapy */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">content_copy</span>
                        4. Duplicate Therapy
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-medium">
                        No alert found
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      No overlapping antimicrobial or anticoagulant therapy duplicate detected on chart.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container text-xs text-emerald-700 font-bold">
                    Clear: Unique Class
                  </div>
                </div>

                {/* 5. Contraindication (Condition) */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#B7791F] text-[18px]">medical_services</span>
                        5. Contraindication
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FEFCBF] text-[#B7791F] text-[10px] font-bold">
                        Moderate
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      Cautious prescribing with chronic kidney disease (CKD Stage G3b) due to crystalluria danger.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container text-xs text-[#B7791F] font-bold">
                    Hydration Protocol Advised
                  </div>
                </div>

                {/* 6. Completeness & Data Guard */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-[18px]">rule</span>
                        6. Data Guard
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">
                        Info Note
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">
                      Baseline INR lab value &gt;60 days old in EMR. Repeat assay strongly recommended upon dispense.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container text-xs text-secondary font-bold">
                    Lab Advisory
                  </div>
                </div>
              </div>
            </div>

            {/* Step Navigation & Action Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-container">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface cursor-pointer"
              >
                ← Back to Review
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/report')}
                  className="px-4 py-2.5 rounded-xl bg-surface-container text-secondary hover:bg-surface-container-high text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Full A4 Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-all cursor-pointer"
                >
                  Quick Modal Audit
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all shadow-sm cursor-pointer"
                >
                  Done / Return to Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over Monograph & Override Drawer */}
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
