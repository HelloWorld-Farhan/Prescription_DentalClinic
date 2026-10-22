import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import LegalPageHeader from '../components/LegalPageHeader';

export default function PatientRights() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="bg-[#f7fafc] font-sans text-on-surface min-h-screen flex flex-col justify-between selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Top Header */}
      <LegalPageHeader title="Patient Medication Rights & Safety Charter" showPrintButton={true} />

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
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                Patient Bill of Rights
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
                Medication Safety & Pharmacovigilance
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Patient Prescription Rights & Medication Safety Charter</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2">
              Smile Clinic is dedicated to protecting every patient against preventable adverse drug interactions. These patient medication rights guide every prescription dispensed within our system.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">verified</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">1. Right to Medication Counseling & Drug Information</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mt-1">
                  Patients have the right to receive comprehensive, understandable counseling regarding every dental medication prescribed, including indications, dosing frequency, expected therapeutic benefits, and potential side effects.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">security</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">2. Right to Allergy & Interaction Protection</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mt-1">
                  Every patient is protected by multi-tier automated checks for drug-drug interactions, cross-sensitivities (such as Cephalosporin risks in Penicillin-allergic individuals), and organ clearance contraindications before an order can be transmitted.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">health_and_safety</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">3. Conservative Analgesic Stewardship</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mt-1">
                  In line with ADA dental pain guidelines, non-opioid multimodal analgesics (such as combination Ibuprofen and Acetaminophen) are prioritized as first-line therapy, minimizing opioid exposure while ensuring maximum post-operative comfort.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">emergency</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface">4. Immediate Adverse Event Triage</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mt-1">
                  Patients experiencing unexpected rash, respiratory constriction, or swelling after taking any prescribed dental medication have 24/7 access to our emergency clinical hotline at (555) 234-5678.
                </p>
              </div>
            </div>
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
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
            <span className="text-primary font-bold">Patient Rights</span>
            <Link to="/support" className="hover:text-primary transition-colors">Support Desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
