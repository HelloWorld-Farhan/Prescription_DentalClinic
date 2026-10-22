import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import LegalPageHeader from '../components/LegalPageHeader';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="bg-[#f7fafc] font-sans text-on-surface min-h-screen flex flex-col justify-between selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Top Header */}
      <LegalPageHeader title="HIPAA Notice of Privacy Practices" showPrintButton={true} />

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
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider">
                HIPAA Notice of Privacy Practices
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                256-Bit SSL Encrypted
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Prescription Privacy Policy & Medication Data Safeguards</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2">
              Effective Date: January 1, 2026 • Governing Practice: Smile Clinic RxGuard Clinical Decision System
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
              <span>Medication Data Privacy Commitment</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Smile Clinic and the RxGuard decision support platform protect sensitive prescription records, allergy history, and patient pharmacogenomic markers under the HIPAA Privacy and Security Rules (45 CFR §164.312).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
              <span>Prescription Lookup & Audit Trails</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Every medication safety scan, drug allergy match, renal clearance check, and prescriber override is cryptographically logged in an immutable audit ledger. Lookups are restricted exclusively to credentialed healthcare personnel involved in the patient direct dental care.
            </p>
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2 text-xs sm:text-sm text-on-surface-variant">
              <p>• <strong>SMART on FHIR v4:</strong> Medication queries employ OAuth 2.0 scoped authorization tokens.</p>
              <p>• <strong>State PDMP Coordination:</strong> Controlled substance queries comply with statutory state monitoring requirements.</p>
              <p>• <strong>Data Retention:</strong> Prescription safety audit logs are preserved for 7 years pursuant to federal healthcare standards.</p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
              <span>Security & Encryption Standards</span>
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              All electronic prescriptions transmitted to community pharmacies or hospital dispensaries are secured using TLS 1.3 in transit and AES-256 encryption at rest.
            </p>
          </section>

          {/* Contact Box */}
          <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 text-xs sm:text-sm text-teal-950 space-y-1">
            <div className="font-bold">Pharmacy Privacy Officer & Clinical Compliance</div>
            <div>Smile Clinic Healthcare Systems Inc. • 100 Smile Way, Suite 400</div>
            <div>Direct Line: (555) 234-5678 • Email: rx-privacy@smileclinic.com</div>
          </div>
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
            <span className="text-primary font-bold">Privacy Policy</span>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
            <Link to="/support" className="hover:text-primary transition-colors">Support Desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
