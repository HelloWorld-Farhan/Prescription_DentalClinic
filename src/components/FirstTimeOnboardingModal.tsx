import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi, UserProfile } from '../services/authApi';

export const COUNTRIES = [
  { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India',          min: 10, max: 10 },
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States',  min: 10, max: 10 },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom', min: 10, max: 11 },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia',      min: 9,  max: 10 },
  { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada',         min: 10, max: 10 },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE',            min: 9,  max: 9  },
  { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore',      min: 8,  max: 8  },
  { code: 'PK', dial: '+92',  flag: '🇵🇰', name: 'Pakistan',       min: 10, max: 10 },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh',     min: 10, max: 10 },
  { code: 'LK', dial: '+94',  flag: '🇱🇰', name: 'Sri Lanka',      min: 9,  max: 9  },
  { code: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia',       min: 9,  max: 10 },
  { code: 'NP', dial: '+977', flag: '🇳🇵', name: 'Nepal',          min: 10, max: 10 },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany',        min: 10, max: 11 },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France',         min: 9,  max: 9  },
  { code: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand',    min: 9,  max: 10 },
];

interface FirstTimeOnboardingModalProps {
  user: UserProfile;
  isOpen: boolean;
  onComplete: (updatedUser: UserProfile) => void;
}

export default function FirstTimeOnboardingModal({ user, isOpen, onComplete }: FirstTimeOnboardingModalProps) {
  const parsePhone = (raw?: string) => {
    if (!raw) return { country: COUNTRIES[0], digits: '' };
    for (const c of COUNTRIES) {
      if (raw.startsWith(c.dial)) {
        return { country: c, digits: raw.replace(c.dial, '').trim() };
      }
    }
    return { country: COUNTRIES[0], digits: raw.replace(/^\+\d+\s*/, '').trim() };
  };

  const initialPhone = parsePhone(user?.phone);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [selectedCountry, setSelectedCountry] = useState(initialPhone.country);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone.digits);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [age, setAge] = useState<string>(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState<string>(user?.gender || 'Prefer not to say');
  const [height, setHeight] = useState<string>(user?.height || '');
  const [weight, setWeight] = useState<string>(user?.weight || '');

  const [hasAllergies, setHasAllergies] = useState<boolean>(Boolean(user?.hasAllergies));
  const [allergiesDescription, setAllergiesDescription] = useState<string>(user?.allergiesDescription || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      const parsed = parsePhone(user.phone);
      setSelectedCountry(parsed.country);
      setPhoneDigits(parsed.digits);
      if (user.age) setAge(String(user.age));
      if (user.gender) setGender(user.gender);
      if (user.height) setHeight(user.height);
      if (user.weight) setWeight(user.weight);
      if (user.hasAllergies !== undefined) setHasAllergies(Boolean(user.hasAllergies));
      if (user.allergiesDescription) setAllergiesDescription(user.allergiesDescription);
    }
  }, [user]);

  const validatePhone = (digits: string, country: typeof COUNTRIES[0]) => {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return 'Mobile phone number is required.';
    if (clean.length < country.min || clean.length > country.max) {
      return country.min === country.max
        ? `Phone number must be exactly ${country.min} digits for ${country.name}.`
        : `Phone number must be between ${country.min} and ${country.max} digits for ${country.name}.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDigits = phoneDigits.replace(/\D/g, '');
    const pErr = validatePhone(cleanDigits, selectedCountry);
    if (pErr) {
      setPhoneError(pErr);
      return;
    }
    setPhoneError(null);

    if (hasAllergies && !allergiesDescription.trim()) {
      setFormError('Please specify your known drug or medical allergies.');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullPhone = `${selectedCountry.dial} ${cleanDigits}`;
      const res = await authApi.updateProfile({
        email: user.email,
        full_name: fullName.trim() || user.fullName,
        phone: fullPhone,
        age: age ? parseInt(age, 10) : undefined,
        gender,
        height: height.trim(),
        weight: weight.trim(),
        has_allergies: hasAllergies,
        allergies_description: hasAllergies ? allergiesDescription.trim() : '',
        profile_completed: true
      });

      if (res.user) {
        onComplete(res.user);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save health profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = fullName.trim() || user?.fullName || '';
  const isGenericUser = !displayName || displayName.toLowerCase() === 'user' || displayName.toLowerCase() === 'clinician';
  const greeting = isGenericUser ? 'Welcome to Smile Clinic!' : `Welcome, ${displayName}!`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="w-full max-w-4xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto grid grid-cols-1 md:grid-cols-12 min-h-[540px]"
          >
            {/* LEFT COLUMN: Clean Minimal Clinical Branding & Required Notice (5 Cols) */}
            <div className="md:col-span-5 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-5">
                {/* Brand & Setup Badge */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-300 shadow-md">
                    <span className="material-symbols-outlined text-[24px]">clinical_notes</span>
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-wider uppercase text-teal-400 block">Smile Clinic</span>
                    <span className="text-[11px] text-slate-400">Clinical Safety Portal</span>
                  </div>
                </div>

                {/* Greeting & Subtitle */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-snug">
                    {greeting}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Please take a moment to configure your clinical health profile. This data directly governs safety cross-checks and rule calibrations.
                  </p>
                </div>

                {/* PROMINENT MANDATORY RED WARNING BADGE */}
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 text-rose-100 shadow-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-400 text-[20px] animate-pulse">error</span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Action Required to Move Forward
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100/90 leading-relaxed pl-7">
                    You must complete all required profile fields marked with <strong className="text-rose-400 font-extrabold text-xs">(*) in red</strong> below to enter the prescription portal.
                  </p>
                </div>

                {/* Checklist of why this is needed */}
                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Calibrates renal eGFR &amp; safe dosage limits</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Checks contraindications against known allergies</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Secures 2FA verification for clinical sessions</span>
                  </div>
                </div>
              </div>

              {/* Bottom Security Note */}
              <div className="relative z-10 pt-6 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-teal-400">lock</span>
                  <span>256-Bit Encrypted</span>
                </span>
                <span>HIPAA Safe Harbor</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Clean Minimal Input Form (7 Cols) */}
            <div className="md:col-span-7 bg-white p-6 sm:p-8 flex flex-col justify-between max-h-[85vh] overflow-y-auto">
              <div>
                {/* Form Header */}
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Complete Clinical Profile
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fill required fields marked with <span className="text-rose-600 font-black text-xs">*</span> to unlock the dashboard
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                    Step 1 of 1
                  </span>
                </div>

                <form id="onboardingForm" onSubmit={handleSubmit} className="space-y-4 pt-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                      <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Row 1: Full Name & Read-Only Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>Full Name</span>
                        <span className="text-rose-600 font-extrabold text-sm">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Farhan Khalid"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Registered Email</span>
                        <span className="text-[10px] text-slate-400 font-medium">Read-Only</span>
                      </label>
                      <div className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono flex items-center justify-between">
                        <span className="truncate">{user?.email}</span>
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">lock</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Phone with Country Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>Direct Mobile Phone (for 2FA &amp; Alerts)</span>
                      <span className="text-rose-600 font-extrabold text-sm">*</span>
                    </label>
                    <div className="relative flex rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-600 focus-within:border-teal-600 transition-all">
                      <button
                        type="button"
                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="flex items-center gap-1 px-2.5 py-2 border-r border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer rounded-l-xl shrink-0"
                      >
                        <span className="text-sm">{selectedCountry.flag}</span>
                        <span>{selectedCountry.dial}</span>
                        <span className="material-symbols-outlined text-[14px] text-slate-400">arrow_drop_down</span>
                      </button>

                      <input
                        type="tel"
                        required
                        value={phoneDigits}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setPhoneDigits(digits);
                          if (phoneError) setPhoneError(null);
                        }}
                        placeholder={`e.g. ${selectedCountry.min === 10 ? '9876543210' : 'Mobile number'}`}
                        className="flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent focus:outline-none font-medium text-slate-800"
                      />

                      {showCountryPicker && (
                        <div className="absolute left-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50 divide-y divide-slate-100 py-1">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setShowCountryPicker(false);
                                if (phoneDigits) {
                                  setPhoneError(validatePhone(phoneDigits, c));
                                }
                              }}
                              className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-teal-50 transition-colors ${
                                selectedCountry.code === c.code ? 'bg-teal-50 font-bold text-teal-800' : 'text-slate-700'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.name}</span>
                              </span>
                              <span className="font-mono text-slate-400">{c.dial}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {phoneError && (
                      <p className="text-[11px] text-rose-600 font-semibold">{phoneError}</p>
                    )}
                  </div>

                  {/* Row 3: Age & Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>Age (Years)</span>
                        <span className="text-rose-600 font-extrabold text-sm">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="125"
                        required
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 32"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>Gender</span>
                        <span className="text-rose-600 font-extrabold text-sm">*</span>
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 font-medium text-slate-800 cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-Binary">Non-Binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Height & Weight */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Height (Optional)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          placeholder="e.g. 175 cm or 5'9&quot;"
                          className="w-full px-3 py-2 pr-8 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                        />
                        <span className="absolute right-2.5 top-2 text-slate-400 material-symbols-outlined text-[18px]">height</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Weight (Optional)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="e.g. 70 kg or 154 lbs"
                          className="w-full px-3 py-2 pr-8 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                        />
                        <span className="absolute right-2.5 top-2 text-slate-400 material-symbols-outlined text-[18px]">fitness_center</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Allergies Section */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                        <span className="text-xs font-bold text-slate-900">
                          Known Drug Allergies?
                        </span>
                        <span className="text-rose-600 font-extrabold text-sm">*</span>
                      </div>

                      <div className="flex items-center rounded-xl bg-slate-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setHasAllergies(false);
                            setAllergiesDescription('');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            !hasAllergies ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          No (NKDA)
                        </button>
                        <button
                          type="button"
                          onClick={() => setHasAllergies(true)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            hasAllergies ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Yes
                        </button>
                      </div>
                    </div>

                    {hasAllergies ? (
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                          <span>List Allergic Drugs (e.g. Penicillin, NSAIDs)</span>
                          <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={allergiesDescription}
                          onChange={(e) => setAllergiesDescription(e.target.value)}
                          placeholder="e.g. Penicillin, Amoxicillin, Latex"
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-teal-700 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-teal-600">verified</span>
                        No Known Drug Allergies (NKDA) confirmed for this profile.
                      </p>
                    )}
                  </div>
                </form>
              </div>

              {/* Form Actions Footer */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-rose-500">priority_high</span>
                  <span>Required to access portal</span>
                </span>

                <button
                  type="submit"
                  form="onboardingForm"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 hover:from-teal-600 hover:to-slate-800 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Profile &amp; Move Forward</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
