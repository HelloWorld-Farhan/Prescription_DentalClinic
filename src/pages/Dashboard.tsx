import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VirtualDb } from '../data/virtualDb';
import { SafetyCheckRecord } from '../types';
import PrintableReportModal from '../components/PrintableReportModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState('All Units');
  const [timeRange, setTimeRange] = useState('Today');
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);

  const checks = VirtualDb.getChecks();
  const highSeverityCount = checks.filter(c => c.alerts.some(a => a.severity === 'contraindicated' && !a.overridden)).length;
  const inQueueCount = checks.filter(c => c.overallStatus === 'Requires Review' || c.overallStatus === 'Contraindicated').length;

  const filteredChecks = selectedUnit === 'All Units'
    ? checks
    : checks.filter(c => c.unit.toLowerCase().includes(selectedUnit.toLowerCase()));

  const units = ['All Units', 'Dental Surgery', 'Operatory 01', 'Periodontal Bay 1', 'General Hygiene'];

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTEXT & FILTER BAR */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-on-surface">
              Prescription Safety Dashboard
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-primary font-bold text-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>FHIR R4 Synced: Just now</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Real-time clinical drug-drug, dosing, renal clearance, and interaction screening feed.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-surface-container-high rounded-xl text-xs font-semibold">
            {units.map((unit) => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedUnit === unit
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-xs bg-surface-container-lowest border border-surface-container-high px-3 py-2 rounded-xl text-on-surface font-semibold outline-none cursor-pointer shadow-xs"
          >
            <option>Today</option>
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
          </select>
        </div>
      </section>

      {/* 2. STATS OVERVIEW CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Checks Today */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-outline">Screened Today</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-on-surface">1,284</span>
                <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  +12.4%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">fact_check</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>1,095 prescriber checked</span>
            <span className="font-semibold text-primary">189 auto-verified</span>
          </div>
        </motion.div>

        {/* Card 2: Alerts In Queue */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-outline">Alerts In Queue</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-on-surface">{inQueueCount}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  Action Req.
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Median queue wait: <strong>3.8 mins</strong></span>
            <span className="material-symbols-outlined text-outline text-[16px]">schedule</span>
          </div>
        </motion.div>

        {/* Card 3: High-Severity Open */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-container-lowest rounded-2xl p-5 border border-rose-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-outline">High-Severity Open</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-700">{highSeverityCount}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">dangerous</span>
                  Urgent
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-900 font-semibold">
            <span>Contraindicated pairings detected</span>
            <button onClick={() => navigate('/alerts')} className="hover:underline text-rose-700">View All →</button>
          </div>
        </motion.div>

        {/* Card 4: Clinician Override Rate */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-outline">Clinician Override Rate</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-on-surface">4.2%</span>
                <span className="text-xs font-semibold text-on-surface-variant">Target &lt; 5%</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container-low flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>100% justified with clinical rationales</span>
            <span className="material-symbols-outlined text-emerald-600 text-[16px]">verified</span>
          </div>
        </motion.div>
      </section>

      {/* 3. ACTIVE SCREENING FEED & URGENT QUEUE */}
      <section className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
        <div className="p-5 border-b border-surface-container-low flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
            <h2 className="font-extrabold text-base text-on-surface">Recent Safety Screenings Feed</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {filteredChecks.length}
            </span>
          </div>

          <button
            onClick={() => navigate('/check')}
            className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Perform New Safety Check
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider font-bold border-b border-surface-container-high">
                <th className="py-3 px-4">Check #</th>
                <th className="py-3 px-4">Patient / Context</th>
                <th className="py-3 px-4">Drugs Screened</th>
                <th className="py-3 px-4">Screening Result</th>
                <th className="py-3 px-4">Prescriber</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {filteredChecks.map((item) => {
                const isContra = item.overallStatus === 'Contraindicated';
                const isOverridden = item.overallStatus === 'Overridden';
                const isSafe = item.overallStatus === 'Safe to Dispense';

                return (
                  <tr key={item.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {item.checkNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-on-surface text-sm">{item.patientName}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono">{item.mrn} • {item.unit}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {item.prescriptions.map((p, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-surface-container-high rounded-md text-[10px] font-semibold text-on-surface truncate">
                            {p.drugName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        isContra
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : isOverridden
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : isSafe
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-orange-100 text-orange-800 border-orange-300'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {isContra ? 'dangerous' : isOverridden ? 'gavel' : isSafe ? 'check_circle' : 'warning'}
                        </span>
                        {item.overallStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-on-surface">
                      {item.prescriberName}
                    </td>
                    <td className="py-3.5 px-4 text-outline font-medium">
                      {item.timestamp}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveReportCheck(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-semibold text-[11px] transition-colors flex items-center gap-1"
                          title="Print Review Report"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                          Report
                        </button>
                        <button
                          onClick={() => navigate('/alerts')}
                          className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary font-bold text-[11px] transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. CLINICAL SAFETY REMINDER FOOTER */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-primary">
          <span className="material-symbols-outlined text-[20px]">verified_user</span>
          <span className="font-semibold">
            All screening events are digitally notarized under HIPAA audit standards and automatically synced with St. Jude EMR.
          </span>
        </div>
        <button
          onClick={() => navigate('/audit-log')}
          className="text-primary font-bold hover:underline shrink-0"
        >
          View Full Audit Trail →
        </button>
      </div>

      {/* Printable Report Modal */}
      <PrintableReportModal
        check={activeReportCheck}
        isOpen={!!activeReportCheck}
        onClose={() => setActiveReportCheck(null)}
      />
    </div>
  );
}
