import { motion, AnimatePresence } from 'framer-motion';
import { SafetyCheckRecord } from '../types';

interface PrintableReportModalProps {
  check: SafetyCheckRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableReportModal({ check, isOpen, onClose }: PrintableReportModalProps) {
  if (!check) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none"
          >
            {/* Action Bar (Hidden on print) */}
            <div className="p-4 bg-surface-container-high/60 border-b border-surface-container-high flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">print</span>
                <span className="font-bold text-sm text-on-surface">Printable Clinical Review Report</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                  {check.checkNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print Report / Save PDF
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 sm:p-12 space-y-8 bg-white text-[#181c1e] text-xs font-sans print:p-6" id="printable-report">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-primary/20 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-[28px]">shield_with_heart</span>
                    <h1 className="text-2xl font-black tracking-tight text-primary">Smile Clinic</h1>
                  </div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    RxGuard Clinical Decision Support & Interaction Screening Service
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    100 Dental Plaza Blvd, Suite 400 • Medical Records Hotline: (555) 019-8234
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block p-2 border border-gray-300 rounded-lg bg-gray-50 mb-2">
                    <div className="w-16 h-16 bg-white flex flex-col items-center justify-center border border-dashed border-gray-300 font-mono text-[9px] text-gray-500 text-center leading-tight">
                      <span>[ QR VERIFY ]</span>
                      <span className="font-bold text-[8px] text-primary">{check.checkNumber}</span>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-gray-500">Report Ref: {check.checkNumber}</div>
                  <div className="text-[10px] text-gray-500">Generated: {check.timestamp}</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                check.overallStatus === 'Contraindicated'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : check.overallStatus === 'Overridden'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px]">
                    {check.overallStatus === 'Contraindicated' ? 'dangerous' : check.overallStatus === 'Overridden' ? 'warning' : 'verified'}
                  </span>
                  <div>
                    <span className="font-bold text-sm block">Screening Outcome: {check.overallStatus}</span>
                    <span className="text-[11px] opacity-90">Reconciled against SMART on FHIR R4 clinical database</span>
                  </div>
                </div>
                <span className="font-mono text-xs uppercase tracking-wider font-bold">
                  {check.unit}
                </span>
              </div>

              {/* Patient & Prescriber Grid */}
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[10px] mb-2">Patient Demographics</h3>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-900">{check.patientName}</p>
                    <p className="text-gray-600">MRN: <strong className="font-mono">{check.mrn}</strong></p>
                    <p className="text-gray-600">Location: {check.unit}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[10px] mb-2">Prescribing Clinician</h3>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-900">{check.prescriberName}</p>
                    <p className="text-gray-600">Credential ID: <strong className="font-mono">{check.prescriberNpi}</strong></p>
                    <p className="text-emerald-700 font-semibold">Authorized Prescriber</p>
                  </div>
                </div>
              </div>

              {/* Prescriptions Screened */}
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider text-gray-700 text-[11px]">
                  Prescriptions Evaluated ({check.prescriptions.length})
                </h3>
                <table className="w-full text-left border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 uppercase text-[9px] tracking-wider font-semibold">
                      <th className="p-2.5 border border-gray-200">Drug / Generic</th>
                      <th className="p-2.5 border border-gray-200">Dosage</th>
                      <th className="p-2.5 border border-gray-200">Frequency & Route</th>
                      <th className="p-2.5 border border-gray-200">Indication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.prescriptions.map((rx) => (
                      <tr key={rx.id} className="border-b border-gray-200">
                        <td className="p-2.5 border border-gray-200 font-bold">{rx.drugName} ({rx.genericName})</td>
                        <td className="p-2.5 border border-gray-200">{rx.dosage}</td>
                        <td className="p-2.5 border border-gray-200">{rx.frequency} • {rx.route}</td>
                        <td className="p-2.5 border border-gray-200 text-gray-600">{rx.indication}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interaction Findings */}
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider text-gray-700 text-[11px]">
                  Interaction Findings & Evidence Analysis ({check.alerts.length})
                </h3>
                {check.alerts.length === 0 ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-center font-semibold">
                    No contraindicated or major drug interactions identified. Approved for dispensing.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {check.alerts.map((alert) => (
                      <div key={alert.id} className="p-4 rounded-xl border border-gray-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                            alert.severity === 'contraindicated'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`}>
                            {alert.severity} • {alert.evidenceGrade}
                          </span>
                          {alert.overridden && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              OVERRIDDEN BY CLINICIAN
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-xs">{alert.title}</h4>
                        <p className="text-gray-600 text-[11px] leading-relaxed">
                          <strong>Mechanism:</strong> {alert.mechanism}
                        </p>
                        <p className="text-gray-600 text-[11px] leading-relaxed">
                          <strong>Clinical Recommendation:</strong> {alert.recommendation}
                        </p>
                        {alert.overridden && (
                          <div className="p-2 bg-amber-50/80 rounded border border-amber-200 text-[10px] text-amber-900">
                            <strong>Recorded Justification:</strong> {alert.overrideReason} (Signed by {alert.overrideAuthor})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescriber Signature & Legal Disclaimer */}
              <div className="pt-8 border-t-2 border-gray-200 grid grid-cols-2 gap-8 items-end">
                <div className="space-y-1 text-[10px] text-gray-500">
                  <p className="font-bold text-gray-700">Legal Clinical Disclaimer</p>
                  <p>
                    RxGuard provides computer-assisted clinical decision support based on national pharmacopeia rules and patient context. It does not replace independent professional judgment of licensed clinicians.
                  </p>
                </div>

                <div className="text-right space-y-6">
                  <div className="border-b border-gray-400 pb-1 inline-block min-w-[200px] text-left">
                    <span className="font-serif italic text-sm text-gray-800">{check.prescriberName}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{check.prescriberName}</p>
                    <p className="text-gray-500 text-[10px]">Attesting Prescriber • {check.prescriberNpi}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
