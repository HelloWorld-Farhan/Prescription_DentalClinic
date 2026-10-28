import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface ClinicalInquiriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (questions: string[]) => void;
  patientName?: string;
  patientMrn?: string;
  candidateMedicationsCount?: number;
}

interface DefaultQuestionOption {
  id: string;
  text: string;
  category: string;
  recommended?: boolean;
}

const DEFAULT_QUESTIONS: DefaultQuestionOption[] = [
  {
    id: 'q1',
    text: 'Is this medication regimen completely safe for me and my medical conditions?',
    category: 'Safety & Contraindications',
    recommended: true
  },
  {
    id: 'q2',
    text: 'When and how should I take this medication (e.g. before/after food, with meals, or empty stomach)?',
    category: 'Administration & Food Timing',
    recommended: true
  },
  {
    id: 'q3',
    text: 'Are there any dangerous drug-drug interactions with my current active medications?',
    category: 'Drug Interactions',
    recommended: true
  },
  {
    id: 'q4',
    text: 'What common or critical side effects and warning symptoms should be monitored?',
    category: 'Adverse Effects',
    recommended: false
  },
  {
    id: 'q5',
    text: 'Is this medication safe with dental anesthesia, epinephrine, and surgical bleeding procedures?',
    category: 'Dental Operatory Safety',
    recommended: true
  },
  {
    id: 'q6',
    text: 'Does this medication require special dosage adjustment for kidney (eGFR) or liver function?',
    category: 'Organ Clearance',
    recommended: false
  }
];

export default function ClinicalInquiriesModal({
  isOpen,
  onClose,
  onConfirm,
  patientName = 'Patient',
  patientMrn = 'PT-CURRENT',
  candidateMedicationsCount = 0
}: ClinicalInquiriesModalProps) {
  // Pre-select recommended default questions initially
  const [selectedDefaultIds, setSelectedDefaultIds] = useState<Set<string>>(() => {
    return new Set(DEFAULT_QUESTIONS.filter(q => q.recommended).map(q => q.id));
  });

  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reset or initialize state on modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setValidationError('');
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const toggleDefaultQuestion = (id: string) => {
    setValidationError('');
    setSelectedDefaultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddCustomQuestion = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (customQuestions.includes(trimmed)) {
      setCustomInput('');
      return;
    }
    setCustomQuestions(prev => [...prev, trimmed]);
    setCustomInput('');
    setValidationError('');
  };

  const handleRemoveCustomQuestion = (indexToRemove: number) => {
    setCustomQuestions(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectAll = () => {
    setSelectedDefaultIds(new Set(DEFAULT_QUESTIONS.map(q => q.id)));
    setValidationError('');
  };

  const handleClearAll = () => {
    setSelectedDefaultIds(new Set());
    setCustomQuestions([]);
    setCustomInput('');
  };

  const totalQuestionsCount = selectedDefaultIds.size + customQuestions.length + (customInput.trim() ? 1 : 0);

  const handleSubmit = () => {
    const finalQuestions: string[] = [];

    // Collect checked default questions
    DEFAULT_QUESTIONS.forEach(q => {
      if (selectedDefaultIds.has(q.id)) {
        finalQuestions.push(q.text);
      }
    });

    // Collect custom questions
    customQuestions.forEach(q => {
      finalQuestions.push(q);
    });

    // Auto-include pending text in input if user typed but forgot to click "+ Add"
    const pending = customInput.trim();
    if (pending && !finalQuestions.includes(pending)) {
      finalQuestions.push(pending);
    }

    // Validation: At least one question required
    if (finalQuestions.length === 0) {
      setValidationError('Please select or write at least one clinical question to proceed with safety screening.');
      return;
    }

    onConfirm(finalQuestions);
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4 print:hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-2xl bg-surface-container-lowest rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-surface-container-high shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-surface-container pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">contact_support</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-on-surface">
                    Patient & Clinical Safety Inquiries
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#005c65] border border-teal-200">
                    Pre-Screening Verification
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Select or write the specific clinical questions you want the AI engine to evaluate for <strong className="text-on-surface">{patientName}</strong> ({patientMrn}) • {candidateMedicationsCount} candidate meds
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors shrink-0"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="py-4 overflow-y-auto flex-1 space-y-5 pr-1">
            {/* Quick Helper Actions & Count Bar */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Choose Questions to Address:</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px]">
                  {selectedDefaultIds.size + customQuestions.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary hover:text-primary-container text-xs font-semibold underline underline-offset-2 cursor-pointer transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Default Question Cards */}
            <div className="space-y-2">
              {DEFAULT_QUESTIONS.map((q) => {
                const isSelected = selectedDefaultIds.has(q.id);
                return (
                  <motion.div
                    key={q.id}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => toggleDefaultQuestion(q.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500/80 shadow-xs ring-1 ring-teal-500/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {/* Checkbox Icon */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? 'bg-[#007782] text-white shadow-2xs'
                          : 'border-2 border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                      )}
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {q.category}
                        </span>
                        {q.recommended && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
                        isSelected ? 'text-slate-900 font-semibold' : 'text-slate-700'
                      }`}>
                        {q.text}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Custom Question Entry Section */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                Write Custom Inquiries or Patient Questions (Multiple Allowed):
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomQuestion();
                    }
                  }}
                  placeholder="e.g., Can patient take this while lactating? Or with antacid?"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#007782] focus:border-[#007782] text-slate-900 placeholder:text-slate-400 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomQuestion}
                  disabled={!customInput.trim()}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                    customInput.trim()
                      ? 'bg-[#007782] hover:bg-[#005c65] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add</span>
                </button>
              </div>

              {/* Custom Questions Tags List */}
              {customQuestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Custom Added Inquiries ({customQuestions.length}):
                  </span>
                  <div className="space-y-2">
                    {customQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-teal-50/60 border border-teal-200 text-xs sm:text-sm text-slate-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[#007782] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium break-words">{q}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomQuestion(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                          title="Remove question"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Strict Validation Error Banner */}
            {validationError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-600">error</span>
                <span className="font-semibold">{validationError}</span>
              </motion.div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {totalQuestionsCount === 0 ? (
                <span className="text-rose-600 font-semibold">At least 1 question is required to run safety check</span>
              ) : (
                <span>
                  <strong>{totalQuestionsCount} question{totalQuestionsCount > 1 ? 's' : ''}</strong> will be analyzed by Gemini AI
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={totalQuestionsCount === 0}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  totalQuestionsCount > 0
                    ? 'bg-[#007782] hover:bg-[#005c65] text-white shadow-md hover:shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Confirm &amp; Run Safety Screening</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

