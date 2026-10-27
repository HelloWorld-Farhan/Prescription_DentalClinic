import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (version?: string, timestamp?: string) => void;
}

export default function SyncKnowledgeModal({
  isOpen,
  onClose
}: SyncKnowledgeModalProps) {
  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        {/* Modal Window Container matching Add Rule Popup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-2xl w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Top Modal Header */}
          <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">sync</span>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Synchronize Clinical Knowledge Bases
                </h3>
                <p className="text-[11px] text-on-surface-variant">
                  Update active clinical rules, verify AST decision trees, and re-compile in-memory knowledge cache.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
              title="Close"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Modal Body - Empty State */}
          <div className="py-14 overflow-y-auto flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-container text-outline flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-3xl">sync_disabled</span>
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-on-surface">No Data to Sync</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                There are currently no active external knowledge feeds or pending monograph deltas configured to synchronize. Add or configure clinical sources to enable synchronization.
              </p>
            </div>
          </div>

          {/* Modal Bottom Actions */}
          <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-outline/20 text-on-surface/40 cursor-not-allowed flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>No Data to Sync</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
