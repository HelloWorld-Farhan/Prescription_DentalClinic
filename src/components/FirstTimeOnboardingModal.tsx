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

export const COMMON_ALLERGIES_PRESETS = [
  'Penicillin',
  'Amoxicillin',
  'Latex',
  'Sulfa Drugs',
  'NSAIDs / Aspirin',
  'Codeine',
  'Lidocaine (Local Anesthetic)',
  'Tetracycline'
];

interface FirstTimeOnboardingModalProps {
  user: UserProfile;
  isOpen: boolean;
  onComplete: (updatedUser: UserProfile) => void;
}

export default function FirstTimeOnboardingModal({ user, isOpen, onComplete }: FirstTimeOnboardingModalProps) {
  // Resolve phone number from user object or signup session cache
  const getInitialPhoneString = (u?: UserProfile) => {
    if (u?.phone && u.phone.trim()) return u.phone.trim();
    if (typeof window !== 'undefined') {
      const stored =
        sessionStorage.getItem('rxguard_prescriber_phone') ||
        localStorage.getItem('rxguard_prescriber_phone') ||
        '';
      if (stored.trim()) return stored.trim();
    }
    return '';
  };

  const parsePhone = (raw?: string) => {
    if (!raw) return { country: COUNTRIES[0], digits: '' };
    const trimmed = raw.trim();
    for (const c of COUNTRIES) {
      if (trimmed.startsWith(c.dial)) {
        return { country: c, digits: trimmed.replace(c.dial, '').trim().replace(/\D/g, '') };
      }
    }
    const cleanDigits = trimmed.replace(/\D/g, '');
    return { country: COUNTRIES[0], digits: cleanDigits };
  };

  const initialPhone = parsePhone(getInitialPhoneString(user));

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
  
  // Multiple allergies tags state
  const initialAllergiesList = user?.allergiesDescription
    ? user.allergiesDescription.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const [allergiesList, setAllergiesList] = useState<string[]>(initialAllergiesList);
  const [newAllergyInput, setNewAllergyInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      const phoneResolved = getInitialPhoneString(user);
      const parsed = parsePhone(phoneResolved);
      setSelectedCountry(parsed.country);
      setPhoneDigits(parsed.digits);
      if (user.age) setAge(String(user.age));
      if (user.gender) setGender(user.gender);
      if (user.height) setHeight(user.height);
      if (user.weight) setWeight(user.weight);
      if (user.hasAllergies !== undefined) setHasAllergies(Boolean(user.hasAllergies));
      if (user.allergiesDescription) {
        setAllergiesList(user.allergiesDescription.split(',').map((s) => s.trim()).filter(Boolean));
      }
    }
  }, [user]);

  // Add multiple allergy item
  const handleAddAllergy = (itemToAdd?: string) => {
    const raw = (itemToAdd || newAllergyInput).trim();
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    setAllergiesList(prev => {
      const merged = [...prev];
      for (const p of parts) {
        if (!merged.some(existing => existing.toLowerCase() === p.toLowerCase())) {
          merged.push(p);
        }
      }
      return merged;
    });
    setNewAllergyInput('');
    if (formError) setFormError(null);
  };

  const handleRemoveAllergy = (idx: number) => {
    setAllergiesList(prev => prev.filter((_, i) => i !== idx));
  };

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

    // Merge pending allergy input if user forgot to click "+ Add"
    let finalAllergies = [...allergiesList];
    if (newAllergyInput.trim()) {
      const pendingParts = newAllergyInput.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of pendingParts) {
        if (!finalAllergies.some(existing => existing.toLowerCase() === p.toLowerCase())) {
          finalAllergies.push(p);
        }
      }
    }

    if (hasAllergies && finalAllergies.length === 0) {
      setFormError('Please add at least one allergic drug/substance or choose No (NKDA).');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullPhone = `${selectedCountry.dial} ${cleanDigits}`;
      sessionStorage.setItem('rxguard_prescriber_phone', fullPhone);
      localStorage.setItem('rxguard_prescriber_phone', fullPhone);

      const res = await authApi.updateProfile({
        email: user.email,
        full_name: fullName.trim() || user.fullName,
        phone: fullPhone,
        age: age ? parseInt(age, 10) : undefined,
        gender,
        height: height.trim(),
        weight: weight.trim(),
        has_allergies: hasAllergies,
        allergies_description: hasAllergies ? finalAllergies.join(', ') : '',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="w-full max-w-4xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto grid grid-cols-1 md:grid-cols-12"
          >
            {/* LEFT COLUMN: Clean Minimal Clinical Branding & Required Notice (5 Cols) */}
            <div className="md:col-span-5 bg-gradient-to-br from-[#061e1b] via-[#092b27] to-[#041413] text-white p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                {/* Brand & Setup Badge */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-300 shadow-md">
                    <span className="material-symbols-outlined text-[22px]">clinical_notes</span>
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-wider uppercase text-teal-400 block leading-tight">Smile Clinic</span>
                    <span className="text-[10px] text-slate-400">Clinical Decision Support Portal</span>
                  </div>
                </div>

                {/* Greeting & Subtitle */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-snug">
                    {greeting}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Please take a moment to configure your clinical health profile. This data directly governs safety cross-checks and rule calibrations.
                  </p>
                </div>

                {/* PROMINENT MANDATORY RED WARNING BADGE */}
                <div className="p-3 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-rose-100 shadow-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-400 text-[20px] animate-pulse">error</span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Action Required to Move Forward
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100/90 leading-relaxed pl-7">
                    You must complete all required profile fields marked with <strong className="text-rose-400 font-extrabold text-xs">(*) in red</strong> to enter the prescription portal.
                  </p>
                </div>

                {/* Checklist of why this is needed */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Calibrates renal eGFR &amp; safe dosage limits</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Cross-checks multi-allergen contraindications</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                    <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                    <span>Secures 2FA verification for clinical sessions</span>
                  </div>
                </div>
              </div>

              {/* Bottom Security Note */}
              <div className="relative z-10 pt-4 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-teal-400">lock</span>
                  <span>256-Bit Encrypted</span>
                </span>
                <span>HIPAA Safe Harbor</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Clean Minimal Input Form (7 Cols) */}
            <div className="md:col-span-7 bg-white p-5 sm:p-6 lg:p-7 flex flex-col justify-between">
              <div>
                {/* Form Header */}
                <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Complete Clinical Profile
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      Fields marked with <span className="text-rose-600 font-black text-xs">*</span> are required to unlock the portal
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                    Required
                  </span>
                </div>

                <form id="onboardingForm" onSubmit={handleSubmit} className="space-y-3 pt-3">
                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                      <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Row 1: Full Name & Read-Only Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-0.5">
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
                        className="w-full h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Registered Email</span>
                        <span className="text-[10px] text-slate-400 font-medium">Read-Only</span>
                      </label>
                      <div className="w-full h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono flex items-center justify-between">
                        <span className="truncate">{user?.email}</span>
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">lock</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Phone with Country Code */}
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>Direct Mobile Phone (for 2FA &amp; Alerts)</span>
                      <span className="text-rose-600 font-extrabold text-sm">*</span>
                    </label>
                    <div className="relative flex h-9 rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-600 transition-all">
                      <button
                        type="button"
                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="flex items-center gap-1 px-2.5 border-r border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer rounded-l-xl shrink-0"
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
                        className="flex-1 px-3 text-xs sm:text-sm bg-transparent focus:outline-none font-medium text-slate-800"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-0.5">
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
                        className="w-full h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>Gender</span>
                        <span className="text-rose-600 font-extrabold text-sm">*</span>
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800 cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-Binary">Non-Binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Height & Weight */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-800">Height (Optional)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          placeholder="e.g. 175 cm or 5'9&quot;"
                          className="w-full h-9 px-3 pr-8 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                        />
                        <span className="absolute right-2.5 top-2 text-slate-400 material-symbols-outlined text-[18px]">height</span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-800">Weight (Optional)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="e.g. 70 kg or 154 lbs"
                          className="w-full h-9 px-3 pr-8 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
                        />
                        <span className="absolute right-2.5 top-2 text-slate-400 material-symbols-outlined text-[18px]">fitness_center</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Allergies Section (Multi-Allergy Tag Additions) */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
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
                            setAllergiesList([]);
                            setNewAllergyInput('');
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
                      <div className="space-y-2 pt-1">
                        {/* Input & Add Button */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newAllergyInput}
                            onChange={(e) => setNewAllergyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAllergy();
                              }
                            }}
                            placeholder="Type allergen (e.g. Penicillin) and press Enter or Add..."
                            className="flex-1 h-8 px-2.5 text-xs rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddAllergy()}
                            className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            <span>Add</span>
                          </button>
                        </div>

                        {/* List of Added Allergy Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 min-h-[30px] p-2 rounded-xl bg-white border border-amber-200">
                          {allergiesList.length === 0 ? (
                            <span className="text-[11px] text-amber-700/80 italic flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">info</span>
                              <span>No allergy tags added yet. Type above or pick quick suggestions below.</span>
                            </span>
                          ) : (
                            allergiesList.map((alg, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-fadeIn"
                              >
                                <span className="material-symbols-outlined text-[13px] text-amber-700">emergency</span>
                                <span>{alg}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAllergy(idx)}
                                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-amber-200 text-amber-800 transition-colors ml-0.5 cursor-pointer font-bold"
                                  title="Remove allergy"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1 text-[11px] pt-0.5">
                          <span className="text-slate-400 font-semibold text-[10px] uppercase mr-1">Quick Add:</span>
                          {COMMON_ALLERGIES_PRESETS.map((preset) => {
                            const isAdded = allergiesList.some(a => a.toLowerCase() === preset.toLowerCase());
                            return (
                              <button
                                key={preset}
                                type="button"
                                disabled={isAdded}
                                onClick={() => handleAddAllergy(preset)}
                                className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                                  isAdded
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900'
                                }`}
                              >
                                + {preset}
                              </button>
                            );
                          })}
                        </div>
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
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-3">
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
