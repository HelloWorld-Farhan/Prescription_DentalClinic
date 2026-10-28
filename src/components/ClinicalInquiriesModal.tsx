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
  subtitle: string;
  category: string;
  icon: string;
  recommended?: boolean;
}

const DEFAULT_QUESTIONS: DefaultQuestionOption[] = [
  {
    id: 'q1',
    text: 'Is this medicine completely safe for me to take?',
    subtitle: 'Checks all ingredients against your allergies and medical history',
    category: 'Safety & Allergies',
    icon: 'verified_user',
    recommended: true,
  },
  {
    id: 'q2',
    text: 'When should I take it (before or after food)?',
    subtitle: 'Clear meal timing, daily dosing, and empty stomach guidance',
    category: 'Food & Timing',
    icon: 'restaurant',
    recommended: true,
  },
  {
    id: 'q3',
    text: 'Can I safely take this with my other medicines?',
    subtitle: 'Detects dangerous drug-drug interactions or conflicts',
    category: 'Drug Interactions',
    icon: 'medication',
    recommended: true,
  },
  {
    id: 'q4',
    text: 'What side effects or warning signs should I watch for?',
    subtitle: 'Common side reactions and urgent symptoms to report',
    category: 'Side Effects',
    icon: 'warning',
    recommended: false,
  },
  {
    id: 'q5',
    text: 'Is this safe with dental anesthesia & dental procedures?',
    subtitle: 'Bleeding risks, epinephrine safety, and sedation compatibility',
    category: 'Dental Operatory',
    icon: 'dentistry',
    recommended: true,
  },
  {
    id: 'q6',
    text: 'Is this safe for my kidneys and liver (dosage check)?',
    subtitle: 'Evaluates eGFR filtration rate and organ clearance safety',
    category: 'Kidney & Liver',
    icon: 'vital_signs',
    recommended: false,
  },
];

export default function ClinicalInquiriesModal({
  isOpen,
  onClose,
  onConfirm,
  patientName = 'Patient',
  patientMrn = 'PT-CURRENT',
  candidateMedicationsCount = 0,
}: ClinicalInquiriesModalProps) {
  // Pre-select recommended default questions initially
  const [selectedDefaultIds, setSelectedDefaultIds] = useState<Set<string>>(() => {
    return new Set(DEFAULT_QUESTIONS.filter((q) => q.recommended).map((q) => q.id));
  });

  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Lock body scroll and listen for escape key
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
    setSelectedDefaultIds((prev) => {
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
    setCustomQuestions((prev) => [...prev, trimmed]);
    setCustomInput('');
    setValidationError('');
  };

  const handleRemoveCustomQuestion = (indexToRemove: number) => {
    setCustomQuestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectAll = () => {
    setSelectedDefaultIds(new Set(DEFAULT_QUESTIONS.map((q) => q.id)));
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
    DEFAULT_QUESTIONS.forEach((q) => {
      if (selectedDefaultIds.has(q.id)) {
        finalQuestions.push(q.text);
      }
    });

    // Collect custom questions
    customQuestions.forEach((q) => {
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
      <div className="fixed inset-0 z-[115] overflow-y-auto flex items-center justify-center p-3 sm:p-5 print:hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Wide Landscape Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-4xl lg:max-w-5xl bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">contact_support</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Patient &amp; Clinical Safety Inquiries
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#005c65] border border-teal-200">
                    Pre-Screening Verification
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select questions for AI clinical evaluation • <strong className="text-slate-800">{patientName}</strong> ({patientMrn}) • {candidateMedicationsCount} candidate medications
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Quick Helper Actions & Count Bar */}
          <div className="flex items-center justify-between pt-3 pb-1 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Select Questions to Answer:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-[#005c65] font-bold text-[11px] border border-teal-200">
                {selectedDefaultIds.size + customQuestions.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-teal-700 hover:text-teal-900 text-xs font-bold underline underline-offset-2 cursor-pointer transition-colors"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Horizontal 2-Column Grid (No Scrollbars) */}
          <div className="py-2.5 flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-0.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEFAULT_QUESTIONS.map((q) => {
                const isSelected = selectedDefaultIds.has(q.id);
                return (
                  <motion.div
                    key={q.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => toggleDefaultQuestion(q.id)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-600/70 shadow-xs ring-1 ring-teal-600/30'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {/* Checkbox Icon */}
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? 'bg-[#007782] text-white shadow-2xs'
                          : 'border-2 border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                      )}
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-teal-700">{q.icon}</span>
                          <span>{q.category}</span>
                        </span>
                        {q.recommended && (
                          <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            Recommended
                          </span>
                        )}
                      </div>
                      <h4
                        className={`text-xs sm:text-sm font-bold leading-snug ${
                          isSelected ? 'text-slate-900' : 'text-slate-800'
                        }`}
                      >
                        {q.text}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {q.subtitle}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Custom Question Entry Section */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-700">edit_note</span>
                <span>Ask your own specific question (e.g. pregnancy, kidney health, or food timing):</span>
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
                  placeholder="Type a custom question and press Enter..."
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
                  <span>Add Question</span>
                </button>
              </div>

              {/* Custom Questions Tags List */}
              {customQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 py-1.5 px-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-slate-800 shadow-2xs"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#007782] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold">{q}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomQuestion(idx)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="Remove question"
                      >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Validation Error Banner */}
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
          <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {totalQuestionsCount === 0 ? (
                <span className="text-rose-600 font-semibold">Please select at least 1 question to screen</span>
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
