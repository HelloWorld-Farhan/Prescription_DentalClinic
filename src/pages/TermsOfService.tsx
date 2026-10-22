import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import LegalPageHeader from '../components/LegalPageHeader';

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="bg-[#f7fafc] font-sans text-on-surface min-h-screen flex flex-col justify-between selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Top Header */}
      <LegalPageHeader title="Terms of Service & Clinical Decision Guidelines" showPrintButton={true} />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm border border-surface-container-high space-y-8"
        >
          {/* Document Header */}
          <div className="border-b border-surface-container-high pb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold text-xs uppercase tracking-wider">
                Clinical Agreement
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold">
                RxGuard Clinical Decision Terms
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Prescription Safety Checker Terms of Service</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2">
              Effective Date: January 1, 2026 • Governing System: Smile Clinic Healthcare Corporation
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
              <span>Clinical Decision Support System (CDSS) Scope</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              RxGuard is an intelligent clinical decision support system designed to assist licensed prescribers in evaluating drug-drug interactions, contraindications, and organ clearance warnings. RxGuard alerts do not replace the independent medical judgment of the attending dentist or clinical pharmacist.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
              <span>Mandatory Clinical Attestations</span>
            </h2>
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2 text-xs sm:text-sm text-on-surface-variant">
              <p className="leading-relaxed">
                Prior to accessing prescription safety data, every prescriber must affirm that they hold an active state DEA/NPI license, are acting under lawful patient care authorization, and will thoroughly evaluate patient clinical context before overriding safety warnings.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
              <span>Automated Inactivity Session Lock</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              To prevent unauthorized operatory access, clinical sessions automatically lock after 15 minutes of inactivity. Terminals left unattended must be immediately locked manually using the "Lock Session" control.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
              <span>Prescription Audit & Compliance</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              All interactions, drug orders, and clinical rationales are timestamped and permanently archived. Misuse of the prescription portal is subject to credential revocation and regulatory reporting.
            </p>
          </section>
        </motion.div>
      </main>

      {/* Standard Legal Footer */}
      <footer className="w-full bg-surface-container-low py-4 border-t border-surface-container-high mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-tertiary">shield_with_heart</span>
            <span>© 2026 Smile Clinic Health System. All health records encrypted.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6 text-[11px] font-medium">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <span className="text-primary font-bold">Terms of Service</span>
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
            <Link to="/support" className="hover:text-primary transition-colors">Support Desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
