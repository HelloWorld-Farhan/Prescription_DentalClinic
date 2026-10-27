import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // Prevent background scrolling when popup is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalTouchAction = document.body.style.touchAction;

    // Prevent background scrolling and compensate scrollbar width to prevent page shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

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
      setFormError('Please add at least one allergic drug/substance or select "No (NKDA)".');
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
  const greetingSubtitle = isGenericUser
    ? 'Please configure your clinical vitals and allergy safety parameters before proceeding.'
    : `Welcome ${displayName}! Please complete your clinical vitals and allergy safety parameters before proceeding.`;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 md:p-6 overflow-hidden overscroll-contain h-[100dvh]"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Subtle Backdrop - Closes off background interaction */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Unified Minimal Modal Container Matching App UI */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl bg-surface-container-lowest border-0 sm:border sm:border-surface-container-high rounded-none sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 bg-surface-container-low border-b border-surface-container-high shrink-0 space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[18px] sm:text-[22px]">clinical_notes</span>
                  </div>
                  <h3 className="text-sm sm:text-base md:text-lg font-bold text-on-surface truncate">
                    Complete Clinical Profile
                  </h3>
                </div>

                {/* Red Action Required Pill */}
                <div className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-2xs">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>Action Required</span>
                </div>
              </div>

              {/* Subtitle spans full width cleanly across all devices */}
              <p className="text-[11px] sm:text-xs text-on-surface-variant leading-snug">
                {greetingSubtitle}
              </p>
            </div>

            {/* Modal Scrollable Body */}
            <div 
              className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
              {/* Prominent Red Banner: Action Required Notice */}
              <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-900 flex items-start gap-2.5 sm:gap-3 shadow-xs">
                <span className="material-symbols-outlined text-rose-600 text-[18px] sm:text-[20px] shrink-0 mt-0.5">
                  error
                </span>
                <div className="text-[11px] sm:text-xs leading-relaxed">
                  <strong className="font-bold block text-rose-950 mb-0.5">
                    Profile Completion Required to Move Forward
                  </strong>
                  Please fill all mandatory fields marked with an asterisk (<span className="text-rose-600 font-black">*</span>) in red. Your details calibrate dosage algorithms, renal clearance (eGFR), and drug-allergy contraindication checks.
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">warning</span>
                  <span>{formError}</span>
                </div>
              )}

              <form id="onboardingForm" onSubmit={handleSubmit} className="space-y-4">
                {/* Row 1: Full Name & Read-Only Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                      <span>Full Name</span>
                      <span className="text-rose-600 font-extrabold text-sm">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dr. Farhan Khalid"
                      className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                      <span>Registered Email</span>
                      <span className="text-[10px] text-outline font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                        Verified
                      </span>
                    </label>
                    <div className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container text-on-surface-variant font-mono flex items-center justify-between">
                      <span className="truncate">{user?.email}</span>
                      <span className="material-symbols-outlined text-outline text-[16px]">lock</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Phone with Country Code Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                    <span>Direct Mobile Phone</span>
                    <span className="text-rose-600 font-extrabold text-sm">*</span>
                    <span className="text-[11px] text-outline font-normal ml-1">(for 2FA & Critical Safety Alerts)</span>
                  </label>
                  <div className="relative flex h-10 rounded-xl border border-surface-container-high bg-surface-container-low focus-within:bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex items-center gap-1 px-3 border-r border-surface-container-high text-on-surface hover:bg-surface-container text-xs font-bold cursor-pointer rounded-l-xl shrink-0 transition-colors"
                    >
                      <span className="text-sm">{selectedCountry.flag}</span>
                      <span>{selectedCountry.dial}</span>
                      <span className="material-symbols-outlined text-[14px] text-outline">arrow_drop_down</span>
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
                      className="flex-1 px-3 text-xs sm:text-sm bg-transparent focus:outline-none font-medium text-on-surface"
                    />

                    {showCountryPicker && (
                      <div className="absolute left-0 top-full mt-1 w-64 max-w-[calc(100vw-3.5rem)] max-h-48 overflow-y-auto bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high z-50 divide-y divide-surface-container py-1 overscroll-contain">
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
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-surface-container transition-colors ${
                              selectedCountry.code === c.code ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                            </span>
                            <span className="font-mono text-outline">{c.dial}</span>
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
                    <label className="text-xs font-bold text-on-surface flex items-center gap-1">
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
                      className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                      <span>Gender</span>
                      <span className="text-rose-600 font-extrabold text-sm">*</span>
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium cursor-pointer transition-all"
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
                    <label className="text-xs font-bold text-on-surface">Height (Optional)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="e.g. 175 cm or 5'9&quot;"
                        className="w-full h-10 px-3.5 pr-9 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-outline material-symbols-outlined text-[18px]">height</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Weight (Optional)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 70 kg or 154 lbs"
                        className="w-full h-10 px-3.5 pr-9 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-outline material-symbols-outlined text-[18px]">fitness_center</span>
                    </div>
                  </div>
                </div>

                {/* Row 5: Allergies Section (Multi-Allergy Tag Additions) */}
                <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                      <span className="text-xs font-bold text-on-surface">
                        Known Drug Allergies?
                      </span>
                      <span className="text-rose-600 font-extrabold text-sm">*</span>
                    </div>

                    <div className="flex items-center rounded-xl bg-surface-container-high p-0.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setHasAllergies(false);
                          setAllergiesList([]);
                          setNewAllergyInput('');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !hasAllergies ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        No (NKDA)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasAllergies(true)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          hasAllergies ? 'bg-amber-600 text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {hasAllergies ? (
                    <div className="space-y-2.5 pt-1">
                      {/* Input & Add Button */}
                      <div className="flex items-center gap-2">
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
                          placeholder="Allergen (e.g. Penicillin) and click Add..."
                          className="flex-1 h-9 px-3 text-xs rounded-xl border border-amber-300 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-on-surface"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddAllergy()}
                          className="h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Add</span>
                        </button>
                      </div>

                      {/* List of Added Allergy Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] p-2.5 rounded-xl bg-surface-container-lowest border border-amber-200">
                        {allergiesList.length === 0 ? (
                          <span className="text-[11px] text-amber-700/80 italic flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            <span>No allergy tags added yet. Type an allergen above or pick quick presets below.</span>
                          </span>
                        ) : (
                          allergiesList.map((alg, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
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
                        <span className="text-outline font-semibold text-[10px] uppercase mr-1">Quick Add:</span>
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
                                  ? 'bg-surface-container text-outline border-surface-container-high cursor-not-allowed opacity-50'
                                  : 'bg-surface-container-lowest text-on-surface border-surface-container-high hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900'
                              }`}
                            >
                              + {preset}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-primary font-medium flex items-center gap-1.5 pt-0.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">verified</span>
                      No Known Drug Allergies (NKDA) confirmed for this profile.
                    </p>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer - Docked & Always Visible */}
            <div className="p-3 sm:p-4 bg-surface-container-low border-t border-surface-container-high flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-lg sm:shadow-none z-20">
              <span className="text-[11px] sm:text-xs text-on-surface-variant flex items-center justify-center sm:justify-start gap-1.5 text-center">
                <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-primary">shield</span>
                <span>Encrypted &amp; HIPAA Safe Harbor Protected</span>
              </span>

              <button
                type="submit"
                form="onboardingForm"
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 px-5 sm:px-6 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
