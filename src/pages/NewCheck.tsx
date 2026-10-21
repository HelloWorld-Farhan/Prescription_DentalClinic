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

  // Selected Patient & Context State
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0].id);
  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  const [customWeight, setCustomWeight] = useState<number>(selectedPatient.weightKg);
  const [customEgfr, setCustomEgfr] = useState<number>(selectedPatient.egfr);
  const [customPregnancy, setCustomPregnancy] = useState(selectedPatient.pregnancyStatus);

  // Step 2: Meds & Allergies
  const [activeMeds, setActiveMeds] = useState<string[]>(selectedPatient.activeMedications);
  const [newMedInput, setNewMedInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>(selectedPatient.allergies);
  const [newAllergyInput, setNewAllergyInput] = useState('');

  // Step 3: New Proposed Prescriptions
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([
    {
      id: 'rx-p1',
      drugName: 'Ibuprofen 600mg Tablets',
      genericName: 'Ibuprofen',
      dosage: '600mg',
      frequency: 'Every 6 hours PRN',
      route: 'Oral',
      duration: '5 days',
      indication: 'Post-Extraction Dental Pain'
    }
  ]);

  const [drugName, setDrugName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Every 8 hours');
  const [route, setRoute] = useState('Oral');
  const [duration, setDuration] = useState('7 days');
  const [indication, setIndication] = useState('Odontogenic Infection');

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
    }
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
        route: 'Oral',
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
      checkNumber: 'RXG-2026-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: 'Just now',
      patientId: updatedPatient.id,
      patientName: updatedPatient.name,
      mrn: updatedPatient.mrn,
      unit: updatedPatient.roomOrUnit || 'Dental Surgery',
      prescriptions,
      alerts: screenAlerts,
      overallStatus: status,
      prescriberName: 'Dr. Sarah Lin, PharmD',
      prescriberNpi: 'NPI-9834210',
      fhirSynced: true
    };

    VirtualDb.addCheck(newRecord);
    setSavedCheckRecord(newRecord);
    setCurrentStep(5);
  };

  const handleOverrideFromDrawer = (alertId: string, reason: string) => {
    if (savedCheckRecord) {
      VirtualDb.overrideAlert(savedCheckRecord.id, alertId, reason, 'Dr. Sarah Lin, PharmD');
      // Update local alerts
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, overridden: true, overrideReason: reason, overrideAuthor: 'Dr. Sarah Lin, PharmD' } : a));
    }
  };

  const handleSelectAlternativeFromDrawer = (altDrug: string) => {
    // Replace problematic item with recommended alternative
    setPrescriptions(prev => [
      ...prev.slice(1),
      {
        id: 'rx-' + Date.now(),
        drugName: altDrug,
        genericName: altDrug.split(' ')[0],
        dosage: altDrug.includes('mg') ? altDrug.split(' ')[1] : 'Standard',
        frequency: 'Every 8 hours',
        route: 'Oral',
        duration: '5 days',
        indication: 'Substituted Safer Dental Therapy'
      }
    ]);
  };

  const stepTitles = [
    { num: 1, label: 'Patient Context' },
    { num: 2, label: 'Meds & Allergies' },
    { num: 3, label: 'New Prescriptions' },
    { num: 4, label: 'Confirm & Extract' },
    { num: 5, label: 'Safety Results' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. PROGRESS STEPPER */}
      <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Interactive Screening Wizard</span>
            <h1 className="text-xl font-black text-on-surface">New Prescription Safety Check</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-on-surface-variant hover:text-on-surface font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Exit
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="mt-5 grid grid-cols-5 gap-2">
          {stepTitles.map((step) => {
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;

            return (
              <div key={step.num} className="flex flex-col gap-1.5">
                <div className={`h-2 rounded-full transition-all ${
                  isCompleted ? 'bg-primary' : isCurrent ? 'bg-primary animate-pulse' : 'bg-surface-container-high'
                }`} />
                <span className={`text-[10px] sm:text-xs font-bold truncate ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-on-surface' : 'text-outline'
                }`}>
                  {step.num}. {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PROGRESSIVE STEP CONTENT */}
      <AnimatePresence mode="wait">
        {/* STEP 1: PATIENT CONTEXT */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-6"
          >
            <div>
              <h2 className="text-lg font-extrabold text-on-surface">Step 1: Patient Context & Clinical Parameters</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Select the dental patient and verify renal clearance (eGFR), weight, and pregnancy status.
              </p>
            </div>

            {/* Patient Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface block">Select Clinic Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                className="w-full text-xs font-semibold bg-surface-container-low border border-surface-container-high p-3 rounded-xl text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn}) — {p.age} yrs • {p.gender} • {p.roomOrUnit}
                  </option>
                ))}
              </select>
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block uppercase">Weight (kg)</label>
                <input
                  type="number"
                  value={customWeight}
                  onChange={(e) => setCustomWeight(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm font-bold bg-surface-container-lowest border border-surface-container-high p-2 rounded-lg text-on-surface outline-none"
                />
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-on-surface-variant block uppercase">eGFR (mL/min/1.73m²)</label>
                  {customEgfr < 50 && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Renal Alert</span>
                  )}
                </div>
                <input
                  type="number"
                  value={customEgfr}
                  onChange={(e) => setCustomEgfr(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm font-bold bg-surface-container-lowest border border-surface-container-high p-2 rounded-lg text-on-surface outline-none"
                />
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block uppercase">Pregnancy Status</label>
                <select
                  value={customPregnancy}
                  onChange={(e) => setCustomPregnancy(e.target.value as any)}
                  className="w-full text-xs font-bold bg-surface-container-lowest border border-surface-container-high p-2.5 rounded-lg text-on-surface outline-none"
                >
                  <option value="No">No / Not Applicable</option>
                  <option value="First Trimester">First Trimester</option>
                  <option value="Second Trimester">Second Trimester</option>
                  <option value="Third Trimester">Third Trimester</option>
                  <option value="Lactating">Lactating</option>
                </select>
              </div>
            </div>

            {/* Documented Conditions */}
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Documented Medical & Dental Conditions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedPatient.conditions.map((cond, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-primary">
                    {cond}
                  </span>
                ))}
              </div>
            </div>

            {/* Next Step Action */}
            <div className="flex justify-end pt-4 border-t border-surface-container-high">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm"
              >
                Proceed to Step 2: Meds & Allergies
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
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
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-6"
          >
            <div>
              <h2 className="text-lg font-extrabold text-on-surface">Step 2: Current Active Medications & Allergies</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Cross-referenced from patient health history and recent pharmacy dispensation.
              </p>
            </div>

            {/* Active Medications List */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">medication</span>
                Current Active Medications ({activeMeds.length})
              </label>

              <div className="flex flex-wrap gap-2">
                {activeMeds.map((med, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface">
                    <span>{med}</span>
                    <button onClick={() => handleRemoveMed(index)} className="text-outline hover:text-rose-600">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMed} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newMedInput}
                  onChange={(e) => setNewMedInput(e.target.value)}
                  placeholder="Add active medication (e.g., Warfarin 5mg QD)..."
                  className="flex-1 text-xs bg-surface-container-low border border-surface-container-high p-2.5 rounded-xl text-on-surface outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface rounded-xl">
                  Add Med
                </button>
              </form>
            </div>

            {/* Documented Allergies */}
            <div className="space-y-3 pt-3 border-t border-surface-container-low">
              <label className="text-xs font-bold text-rose-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Documented Drug Allergies ({allergies.length})
              </label>

              <div className="flex flex-wrap gap-2">
                {allergies.map((allergy, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold">
                    <span>{allergy}</span>
                    <button onClick={() => handleRemoveAllergy(index)} className="text-rose-400 hover:text-rose-700">
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
                  placeholder="Add allergy (e.g., Penicillin Anaphylaxis)..."
                  className="flex-1 text-xs bg-surface-container-low border border-surface-container-high p-2.5 rounded-xl text-on-surface outline-none"
                />
                <button type="submit" className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-xs font-bold text-rose-900 rounded-xl">
                  Add Allergy
                </button>
              </form>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface transition-colors"
              >
                ← Back to Step 1
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm"
              >
                Proceed to Step 3: Prescriptions
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: NEW PRESCRIPTION ENTRY */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-6"
          >
            <div>
              <h2 className="text-lg font-extrabold text-on-surface">Step 3: Proposed Dental Prescriptions</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Add proposed medications or choose from common clinical dental regimens.
              </p>
            </div>

            {/* Quick Dental Protocol Buttons */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Quick Dental Regimen Templates
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAddDental('Amoxicillin 500mg', 'Amoxicillin', '500mg', 'Every 8 hours', '7 days', 'Odontogenic Infection')}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface border border-surface-container-high flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                  Amoxicillin 500mg (Antibiotic)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddDental('Ibuprofen 600mg', 'Ibuprofen', '600mg', 'Every 6 hours PRN', '5 days', 'Post-Op Pain')}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface border border-surface-container-high flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                  Ibuprofen 600mg (NSAID)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddDental('Clindamycin 300mg', 'Clindamycin HCl', '300mg', 'Every 8 hours', '7 days', 'Penicillin-Allergic Infection')}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface border border-surface-container-high flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                  Clindamycin 300mg (Alternative)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddDental('Tramadol 50mg', 'Tramadol', '50mg', 'Every 6 hours PRN', '3 days', 'Severe Impaction Pain')}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface border border-surface-container-high flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">add</span>
                  Tramadol 50mg (Analgesic)
                </button>
              </div>
            </div>

            {/* Prescriptions Added Table */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-on-surface block">
                Prescriptions Under Evaluation ({prescriptions.length})
              </label>

              {prescriptions.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl border border-dashed border-surface-container-high">
                  No proposed prescriptions added yet. Add one below or click a quick dental template above.
                </div>
              ) : (
                <div className="divide-y divide-surface-container-low border border-surface-container-high rounded-xl overflow-hidden">
                  {prescriptions.map((p) => (
                    <div key={p.id} className="p-3.5 bg-surface-container-lowest flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-on-surface">{p.drugName} ({p.genericName})</div>
                        <div className="text-[11px] text-on-surface-variant">
                          {p.dosage} • {p.frequency} • {p.route} • {p.duration} — <span className="font-semibold text-primary">{p.indication}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePrescription(p.id)}
                        className="text-outline hover:text-rose-600 p-1"
                        title="Remove"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Form */}
            <form onSubmit={handleAddPrescription} className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high space-y-3">
              <div className="font-bold text-xs text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Add Custom Prescription Item
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Drug / Brand Name (e.g., Augmentin 875mg)"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="text-xs bg-surface-container-lowest border border-surface-container-high p-2.5 rounded-lg outline-none"
                />
                <input
                  type="text"
                  placeholder="Generic Name (e.g., Amoxicillin/Clavulanate)"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="text-xs bg-surface-container-lowest border border-surface-container-high p-2.5 rounded-lg outline-none"
                />
                <input
                  type="text"
                  placeholder="Dosage (e.g., 875mg/125mg)"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="text-xs bg-surface-container-lowest border border-surface-container-high p-2.5 rounded-lg outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!drugName.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary-container disabled:opacity-40"
                >
                  + Add to Prescription List
                </button>
              </div>
            </form>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface"
              >
                ← Back to Step 2
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                disabled={prescriptions.length === 0}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                Proceed to Step 4: Review Data
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: REVIEW & CONFIRM EXTRACTED DATA */}
        {currentStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-6"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">verified</span>
                <h2 className="text-lg font-extrabold text-on-surface">Step 4: AI Extraction & Clinical Reconciliation Review</h2>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Confirm all patient parameters and active drug interactions before running the final pharmacopeia rules engine.
              </p>
            </div>

            {/* Reconciliation Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2">
                <span className="text-[10px] font-bold uppercase text-outline tracking-wider">Patient Summary</span>
                <div className="font-bold text-sm text-on-surface">{selectedPatient.name}</div>
                <div className="text-xs text-on-surface-variant font-mono">MRN: {selectedPatient.mrn}</div>
                <div className="text-xs text-on-surface-variant">
                  Weight: <strong>{customWeight} kg</strong> • eGFR: <strong>{customEgfr} mL/min</strong> • Pregnancy: <strong>{customPregnancy}</strong>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2">
                <span className="text-[10px] font-bold uppercase text-outline tracking-wider">Safety Screening Scope</span>
                <div className="text-xs text-on-surface space-y-1">
                  <div>Active Meds Screened: <strong>{activeMeds.length} items</strong></div>
                  <div>Documented Allergies: <strong>{allergies.length} items</strong></div>
                  <div>Proposed Prescriptions: <strong>{prescriptions.length} items</strong></div>
                </div>
              </div>
            </div>

            {/* Prescriptions to Screen */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">Items Ready for Clinical Screening:</span>
              <div className="space-y-2">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-on-surface">{rx.drugName}</span>
                      <span className="text-[11px] text-on-surface-variant block">{rx.dosage} • {rx.frequency} • {rx.duration}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-bold font-mono">
                      READY TO SCREEN
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Run Safety Screen Action */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-xs font-bold text-on-surface"
              >
                ← Edit Prescriptions
              </button>
              <button
                onClick={runSafetyScreen}
                className="px-8 py-3.5 rounded-xl bg-primary text-white font-black text-sm hover:bg-primary-container transition-all flex items-center gap-2 shadow-lg hover:shadow-primary/20"
              >
                <span className="material-symbols-outlined text-[20px]">shield_with_heart</span>
                Execute Safety Screening & Interaction Check
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 5: SAFETY CHECK RESULTS & ACTIONS */}
        {currentStep === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Banner Status */}
            <div className={`p-6 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              alerts.some(a => a.severity === 'contraindicated' && !a.overridden)
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : alerts.some(a => a.severity === 'major' && !a.overridden)
                ? 'bg-orange-50 border-orange-300 text-orange-900'
                : alerts.some(a => a.overridden)
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  alerts.some(a => a.severity === 'contraindicated')
                    ? 'bg-rose-600 text-white'
                    : alerts.some(a => a.severity === 'major')
                    ? 'bg-orange-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}>
                  <span className="material-symbols-outlined text-[28px]">
                    {alerts.some(a => a.severity === 'contraindicated') ? 'dangerous' : alerts.length > 0 ? 'warning' : 'verified'}
                  </span>
                </div>
                <div>
                  <div className="text-xl font-black">
                    {alerts.some(a => a.severity === 'contraindicated' && !a.overridden)
                      ? 'Contraindicated Interactions Detected'
                      : alerts.some(a => a.overridden)
                      ? 'Screening Overridden by Clinician'
                      : alerts.length > 0
                      ? 'Clinical Interaction Warnings Identified'
                      : 'All Clear: Safe to Dispense'}
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">
                    {alerts.length} interactions evaluated across {prescriptions.length} proposed drugs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white text-on-surface border border-surface-container-high font-bold text-xs hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print Safety Report
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all shadow-sm"
                >
                  Done / Return to Dashboard
                </button>
              </div>
            </div>

            {/* Interaction Alert Cards */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">warning</span>
                Detailed Drug Interaction Findings ({alerts.length})
              </h3>

              {alerts.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs space-y-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[48px]">check_circle</span>
                  <h4 className="font-extrabold text-base text-on-surface">No High-Risk Interactions Identified</h4>
                  <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                    The proposed prescription items have no documented major interactions with {selectedPatient.name}'s active medications or allergy profile.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-5 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs hover:border-primary/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          alert.severity === 'contraindicated'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : alert.severity === 'major'
                            ? 'bg-orange-100 text-orange-800 border-orange-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-outline font-semibold">{alert.evidenceGrade}</span>
                        {alert.overridden && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            OVERRIDDEN
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveAlertForDrawer(alert)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary font-bold text-xs transition-colors flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">menu_book</span>
                        View Monograph & Overrides
                      </button>
                    </div>

                    <h4 className="text-sm font-extrabold text-on-surface">{alert.title}</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      <strong>Mechanism:</strong> {alert.mechanism}
                    </p>
                    <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface leading-relaxed">
                      <strong className="text-primary">Clinical Guidance:</strong> {alert.recommendation}
                    </div>

                    {alert.overridden && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                        <strong>Clinician Rationale:</strong> {alert.overrideReason} (Signed by {alert.overrideAuthor})
                      </div>
                    )}
                  </div>
                ))
              )}
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
