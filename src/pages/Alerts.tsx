import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../data/virtualDb';
import { DrugInteractionAlert, SafetyCheckRecord } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import PrintableReportModal from '../components/PrintableReportModal';

export default function Alerts() {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState<'all' | 'contraindicated' | 'major' | 'overridden'>('all');
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => VirtualDb.getChecks());
  // Aggregate all alerts across checks
  const allAlerts: { checkId: string; patientName: string; mrn: string; alert: DrugInteractionAlert }[] = [];
  checks.forEach(c => {
    c.alerts.forEach(a => {
      allAlerts.push({
        checkId: c.id,
        patientName: c.patientName,
        mrn: c.mrn,
        alert: a
      });
    });
  });

  const filtered = allAlerts.filter(item => {
    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'overridden'
        ? item.alert.overridden
        : item.alert.severity === activeTab;

    const matchesSearch =
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.alert.interactingDrugs.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const handleOverride = (alertId: string, reason: string) => {
    const target = allAlerts.find(a => a.alert.id === alertId);
    if (target) {
      VirtualDb.overrideAlert(target.checkId, alertId, reason, 'Dr. Sarah Lin, PharmD');
      setChecks([...VirtualDb.getChecks()]);
      setActiveDrawerAlert(null);
      setToastMessage('Clinical decision signed & recorded into HIPAA audit trail');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">warning</span>
            <h1 className="text-2xl font-black text-on-surface">Prescription Safety Alerts Queue</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Review, investigate clinical monographs, or notarize overrides with legal audit justifications.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xs w-full">
          <div className="relative flex items-center bg-surface-container-lowest rounded-xl px-3 py-2 border border-surface-container-high shadow-xs">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search alert, drug, patient..."
              className="w-full text-xs text-on-surface bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-surface-container-high pb-3 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All Alerts', count: allAlerts.length },
          { key: 'contraindicated', label: 'Contraindicated (Urgent)', count: allAlerts.filter(a => a.alert.severity === 'contraindicated').length },
          { key: 'major', label: 'Major Interactions', count: allAlerts.filter(a => a.alert.severity === 'major').length },
          { key: 'overridden', label: 'Overridden History', count: allAlerts.filter(a => a.alert.overridden).length }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-surface-container-high'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Alerts Grid / Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-surface-container-high space-y-2">
            <span className="material-symbols-outlined text-emerald-600 text-[40px]">check_circle</span>
            <h3 className="font-bold text-sm text-on-surface">No alerts match this filter</h3>
            <p className="text-xs text-on-surface-variant">All current patient interactions in this category have been resolved or cleared.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isContra = item.alert.severity === 'contraindicated';
            const isMajor = item.alert.severity === 'major';

            return (
              <div
                key={item.alert.id}
                className="p-5 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs hover:border-primary/40 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      isContra
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : isMajor
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {item.alert.severity}
                    </span>
                    <span className="text-xs font-bold text-on-surface">{item.patientName}</span>
                    <span className="text-xs text-outline font-mono">({item.mrn})</span>
                    {item.alert.overridden && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        OVERRIDDEN
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCheck = checks.find(c => c.id === item.checkId);
                        if (targetCheck) setActiveReportCheck(targetCheck);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-surface-container text-secondary font-bold text-xs hover:bg-surface-container-high transition-all flex items-center gap-1.5 border border-surface-container-high shadow-2xs cursor-pointer"
                      title="View Clinical Report"
                    >
                      <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                      <span>Report</span>
                    </button>
                    <button
                      onClick={() => setActiveDrawerAlert(item.alert)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      Review Monograph & Override
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">{item.alert.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{item.alert.mechanism}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container-low text-xs">
                  <div className="flex items-center gap-2 text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined text-primary text-[16px]">medication</span>
                    <span>Interacting: <strong>{item.alert.interactingDrugs.join(' ↔ ')}</strong></span>
                  </div>

                  <span className="text-[11px] text-outline font-medium">
                    Evidence: <strong>{item.alert.evidenceGrade}</strong>
                  </span>
                </div>

                {item.alert.overridden && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <strong>Documented Justification:</strong> {item.alert.overrideReason} (Signed by {item.alert.overrideAuthor})
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Slide-over Drawer */}
      <AlertDetailDrawer
        alert={activeDrawerAlert}
        isOpen={!!activeDrawerAlert}
        onClose={() => setActiveDrawerAlert(null)}
        onOverride={handleOverride}
      />

      {/* Full Printable Clinical Report Modal */}
      <PrintableReportModal
        check={activeReportCheck}
        isOpen={!!activeReportCheck}
        onClose={() => setActiveReportCheck(null)}
      />

      {/* Floating Signed Protocol Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-emerald-500 backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-200">verified</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
