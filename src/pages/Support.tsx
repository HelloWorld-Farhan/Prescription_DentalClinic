import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LegalPageHeader from '../components/LegalPageHeader';

export default function Support() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const [formData, setFormData] = useState({
    name: 'Dr. Sarah Lin, PharmD',
    email: 'support.smileclinic@gmail.com',
    category: 'Drug Interaction & Safety Rules Engine',
    priority: 'Normal',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
    }, 500);
  };

  const faqs = [
    {
      q: 'How does the Smile Clinic drug-drug and allergy interaction engine validate orders?',
      a: 'The engine cross-checks the proposed medication against the patient active medication list, known drug classes (e.g. Beta-lactam / Penicillin anaphylaxis), and liver/kidney biomarkers (eGFR and AST/ALT) via SMART on FHIR v4.'
    },
    {
      q: 'What should clinical staff do in the event of an acute anaphylactoid adverse reaction?',
      a: 'Immediately activate the Dental Trauma & Anaphylaxis protocol. Call the emergency line (555) 234-5678, administer intramuscular epinephrine (0.3mg 1:1,000 for adults) from the emergency crash cart, and initiate supplemental oxygen.'
    },
    {
      q: 'How do I override a Level-2 moderate interaction with documented clinical justification?',
      a: 'During Step 6 (Safety Results), click "Override & Provide Clinical Rationale". Select an approved clinical reason (e.g., "Patient tolerates regimen; short 3-day course; monitoring hepatic panel") and confirm with your prescriber electronic PIN.'
    },
    {
      q: 'How are Schedule II controlled substance prescriptions audited under DEA rules?',
      a: 'All narcotics, sedatives, and Schedule II-IV orders are digitally signed with dual-factor tokens and permanently logged in the immutable FHIR AuditLog under 21 CFR Part 1311 EPCS regulations.'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#f7fafc] font-sans text-on-surface min-h-screen flex flex-col justify-between selection:bg-secondary-fixed selection:text-on-secondary-fixed"
    >
      {/* Top Header */}
      <LegalPageHeader title="Support & Helpdesk" showPrintButton={false} />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        {/* Emergency Hotline Notice Banner */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-50 to-orange-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[22px]">medical_services</span>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-rose-950 flex items-center gap-2">
                <span>Immediate Dental Emergency Hotline</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-semibold uppercase tracking-wider">
                  24/7 Available
                </span>
              </h3>
              <p className="text-xs text-rose-800/90 mt-0.5">
                Experiencing severe swelling, acute continuous pain, dental trauma, or a knocked-out tooth? Do not wait. Call our emergency triage doctor directly.
              </p>
            </div>
          </div>
          <a
            href="tel:5552345678"
            className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shrink-0 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            <span>Call (555) 234-5678</span>
          </a>
        </div>

        {/* Quick Help Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-white rounded-2xl border border-surface-container-high shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">prescriptions</span>
            </div>
            <h4 className="text-xs font-bold text-on-surface">Rx Formulary IT</h4>
            <p className="text-[11px] text-on-surface-variant mt-1">Dental formulary updates, NDC codes & drug lookup</p>
            <div className="mt-2 text-[10px] font-semibold text-primary">Ext. 501 • formulary@smileclinic.com</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-surface-container-high shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <h4 className="text-xs font-bold text-on-surface">Pharmacovigilance</h4>
            <p className="text-[11px] text-on-surface-variant mt-1">Adverse drug event alerts & allergy severity sync</p>
            <div className="mt-2 text-[10px] font-semibold text-amber-600">Ext. 509 • safety@smileclinic.com</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-surface-container-high shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <h4 className="text-xs font-bold text-on-surface">SMART on FHIR</h4>
            <p className="text-[11px] text-on-surface-variant mt-1">Epic / Cerner integration & EHR API gateway</p>
            <div className="mt-2 text-[10px] font-semibold text-emerald-600">Ext. 104 • fhir-api@smileclinic.com</div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-surface-container-high shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
            <h4 className="text-xs font-bold text-on-surface">EPCS / DEA Compliance</h4>
            <p className="text-[11px] text-on-surface-variant mt-1">Schedule II token credentials & state PDMP sync</p>
            <div className="mt-2 text-[10px] font-semibold text-sky-600">Ext. 512 • epcs@smileclinic.com</div>
          </div>
        </div>

        {/* Form & FAQs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inquiry Form */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-surface-container-high shadow-xs">
            <div className="border-b border-surface-container-high pb-4 mb-6">
              <h3 className="text-base sm:text-lg font-bold text-on-surface">Prescription Safety Support Ticket</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Direct communication to clinical pharmacology, database specialists, and integration engineers.
              </p>
            </div>

            {formSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-xl space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[24px]">done</span>
                </div>
                <h4 className="font-bold text-emerald-900 text-base">Support Ticket Logged</h4>
                <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                  Ticket <strong>#RX-{Math.floor(100000 + Math.random() * 900000)}</strong> registered. A clinical pharmacologist will respond within 15 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => setFormSubmitted(false)}
                  className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Submit Another Inquiry
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Prescriber / Pharmacist Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Institutional Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Inquiry Department
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option>Drug Interaction & Safety Rules Engine</option>
                      <option>SMART on FHIR v4 Gateway</option>
                      <option>Formulary & NDC Drug Catalog</option>
                      <option>Controlled Substances & DEA EPCS</option>
                      <option>Urgent Clinical Consultation</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option>Normal (Routine question)</option>
                      <option>Urgent (Active prescription pending)</option>
                      <option>Critical (System interaction anomaly)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Brief summary of question or medication concern"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Message / Clinical Details
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide medication name, dose, patient MRN, or interaction code..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-xs text-on-surface outline-none focus:border-primary"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      <span>Send Support Inquiry</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Prescription Safety FAQs */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-surface-container-high shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-container-high">
                <span className="material-symbols-outlined text-[20px] text-primary">help</span>
                <h4 className="font-bold text-sm text-on-surface">Prescription Safety FAQs</h4>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-surface-container-high rounded-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full p-3.5 bg-surface-container-lowest hover:bg-surface-container-low text-left text-xs font-bold text-on-surface flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <span className={`material-symbols-outlined text-[18px] text-outline transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`}>
                          expand_more
                        </span>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="p-3.5 bg-surface-container-low/40 text-[11px] text-on-surface-variant leading-relaxed border-t border-surface-container-high"
                          >
                            {faq.a}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
            <span className="text-primary font-bold">Support Desk</span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
