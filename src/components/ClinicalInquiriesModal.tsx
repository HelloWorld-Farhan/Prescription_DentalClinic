import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCachedCustomQuestions,
  fetchCustomQuestionsFromCloud,
  saveCustomQuestionToCloud,
  deleteCustomQuestionFromCloud,
} from '../services/cloudSyncService';

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
}

// Exactly 4 Top Dental-Pharmacology Suggested Questions
const DEFAULT_QUESTIONS: DefaultQuestionOption[] = [
  {
    id: 'q1',
    text: 'Is this medicine completely safe for me to take?',
    subtitle: 'Checks all ingredients against your allergies and medical history',
    category: 'Safety & Allergies',
    icon: 'verified_user',
  },
  {
    id: 'q2',
    text: 'When should I take it (before or after food)?',
    subtitle: 'Clear meal timing, daily dosing, and empty stomach guidance',
    category: 'Food & Timing',
    icon: 'restaurant',
  },
  {
    id: 'q3',
    text: 'Can I safely take this with my other medicines?',
    subtitle: 'Detects dangerous drug-drug interactions or conflicts',
    category: 'Drug Interactions',
    icon: 'medication',
  },
  {
    id: 'q4',
    text: 'Is this safe with dental anesthesia & dental procedures?',
    subtitle: 'Bleeding risks, epinephrine safety, and sedation compatibility',
    category: 'Dental Operatory',
    icon: 'dentistry',
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
  // 1. By default, NOTHING is selected (user must manually select)
  const [selectedDefaultIds, setSelectedDefaultIds] = useState<Set<string>>(() => new Set());
  
  // 2. Recent Questions from Cloud DB
  const [recentQuestions, setRecentQuestions] = useState<Array<{ id: string; text: string }>>(() => {
    return getCachedCustomQuestions();
  });
  const [selectedRecentIds, setSelectedRecentIds] = useState<Set<string>>(() => new Set());

  // 3. Staged Custom Questions for current check
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Lock body scroll and listen for escape key & fetch cloud questions
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setValidationError('');
      
      // Pull latest custom questions from cloud DB
      fetchCustomQuestionsFromCloud().then((qs) => {
        if (Array.isArray(qs)) {
          setRecentQuestions(qs);
        }
      });

      const handleQuestionsSync = (e: any) => {
        if (Array.isArray(e.detail)) {
          setRecentQuestions(e.detail);
        }
      };
      window.addEventListener('smileclinic_questions_updated', handleQuestionsSync);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('smileclinic_questions_updated', handleQuestionsSync);
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

  const toggleRecentQuestion = (id: string) => {
    setValidationError('');
    setSelectedRecentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteRecentQuestion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedRecentIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    deleteCustomQuestionFromCloud(id);
    setRecentQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddCustomQuestion = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    if (!customQuestions.includes(trimmed)) {
      setCustomQuestions((prev) => [...prev, trimmed]);
    }
    // Optimistically save to cloud DB
    saveCustomQuestionToCloud(trimmed);
    setCustomInput('');
    setValidationError('');
  };

  const handleRemoveCustomQuestion = (indexToRemove: number) => {
    setCustomQuestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectAll = () => {
    setSelectedDefaultIds(new Set(DEFAULT_QUESTIONS.map((q) => q.id)));
    setSelectedRecentIds(new Set(recentQuestions.map((q) => q.id)));
    setValidationError('');
  };

  const handleClearAll = () => {
    setSelectedDefaultIds(new Set());
    setSelectedRecentIds(new Set());
    setCustomQuestions([]);
    setCustomInput('');
  };

  const totalQuestionsCount =
    selectedDefaultIds.size +
    selectedRecentIds.size +
    customQuestions.length +
    (customInput.trim() ? 1 : 0);

  const handleSubmit = () => {
    const finalQuestions: string[] = [];

    // 1. Collect checked default questions
    DEFAULT_QUESTIONS.forEach((q) => {
      if (selectedDefaultIds.has(q.id)) {
        finalQuestions.push(q.text);
      }
    });

    // 2. Collect checked recent questions
    recentQuestions.forEach((q) => {
      if (selectedRecentIds.has(q.id) && !finalQuestions.includes(q.text)) {
        finalQuestions.push(q.text);
      }
    });

    // 3. Collect staged custom questions
    customQuestions.forEach((q) => {
      if (!finalQuestions.includes(q)) {
        finalQuestions.push(q);
      }
    });

    // 4. Auto-include pending text in input if user typed but forgot to click "+ Add"
    const pending = customInput.trim();
    if (pending && !finalQuestions.includes(pending)) {
      finalQuestions.push(pending);
      saveCustomQuestionToCloud(pending);
    }

    // Also persist all staged custom questions to the cloud DB
    customQuestions.forEach((q) => {
      saveCustomQuestionToCloud(q);
    });

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
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                totalQuestionsCount > 0
                  ? 'bg-teal-50 text-[#005c65] border-teal-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {totalQuestionsCount} selected
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

          {/* Scrollable Questions Container */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* SECTION 1: Top 4 Suggested Questions (2-Column Grid) */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 block">
                Suggested Clinical Questions (4)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {DEFAULT_QUESTIONS.map((q) => {
                  const isSelected = selectedDefaultIds.has(q.id);

                  return (
                    <motion.div
                      key={q.id}
                      whileHover={{ scale: 1.008 }}
                      whileTap={{ scale: 0.992 }}
                      onClick={() => toggleDefaultQuestion(q.id)}
                      className={`relative flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-teal-50/70 border-teal-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <div className="pt-0.5 shrink-0">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors border ${
                            isSelected
                              ? 'bg-[#007782] border-[#007782] text-white shadow-2xs'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                        </div>
                      </div>

                      {/* Question Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700">
                            <span className="material-symbols-outlined text-[11px] text-teal-700">{q.icon}</span>
                            <span>{q.category}</span>
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                          {q.text}
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {q.subtitle}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: Recent Custom Questions (Saved in DB for this user across all devices) */}
            {recentQuestions.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-teal-700">history</span>
                    <span>Recent Inquiries (Saved in Cloud)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Synced across your devices</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recentQuestions.map((q) => {
                    const isSelected = selectedRecentIds.has(q.id);

                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleRecentQuestion(q.id)}
                        className={`relative flex items-center justify-between gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none group ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-500 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200 hover:border-teal-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors border shrink-0 ${
                              isSelected
                                ? 'bg-[#007782] border-[#007782] text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-800 truncate" title={q.text}>
                            {q.text}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecentQuestion(e, q.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer shrink-0"
                          title="Delete from saved questions"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: Custom Question Entry Section */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-700">edit_note</span>
                <span>Ask your own specific question (e.g. pregnancy, kidney health, or food timing):</span>
              </label>

              {/* Input container with px-1 py-1 so focus outline / ring is NEVER cut off on left edge */}
              <div className="p-1">
                <div className="flex gap-2 items-center">
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
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all focus:outline-none focus:border-[#007782] focus:ring-2 focus:ring-[#007782]/30"
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
              </div>

              {/* Staged Custom Questions Tags List */}
              {customQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 px-1">
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
