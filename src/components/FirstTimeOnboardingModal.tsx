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
  // Parsing existing phone
  const parsePhone = (raw?: string) => {
    if (!raw) return { country: COUNTRIES[0], digits: '' };
    for (const c of COUNTRIES) {
      if (raw.startsWith(c.dial)) {
        return { country: c, digits: raw.replace(c.dial, '').trim() };
      }
    }
    return { country: COUNTRIES[0], digits: raw.replace(/^\+\d+\s*/, '').trim() };
  };

  const initialPhone = parsePhone(user.phone);

  const [fullName, setFullName] = useState(user.fullName || '');
  const [selectedCountry, setSelectedCountry] = useState(initialPhone.country);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone.digits);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [age, setAge] = useState<string>(user.age ? String(user.age) : '');
  const [gender, setGender] = useState<string>(user.gender || 'Prefer not to say');
  const [height, setHeight] = useState<string>(user.height || '');
  const [weight, setWeight] = useState<string>(user.weight || '');

  const [hasAllergies, setHasAllergies] = useState<boolean>(Boolean(user.hasAllergies));
  const [allergiesDescription, setAllergiesDescription] = useState<string>(user.allergiesDescription || '');

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

  // Validation
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

  // Determine greeting name
  const displayName = fullName.trim() || user.fullName || '';
  const isGenericUser = !displayName || displayName.toLowerCase() === 'user' || displayName.toLowerCase() === 'clinician';
  const greeting = isGenericUser ? 'Hello, User!' : `Welcome, ${displayName}!`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
          >
            {/* Modal Header */}
            <div className="relative bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-6 sm:p-8 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl transform translate-x-20 -translate-y-20 pointer-events-none"></div>
              
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <span className="material-symbols-outlined text-[28px]">health_and_safety</span>
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-emerald-100 text-[11px] font-bold uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                    First-Time Account Setup
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">{greeting}</h2>
                  <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 leading-relaxed">
                    Please take a moment to complete your clinical health profile. This information directly customizes cross-checks and clinical safety screenings.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Name & Read-Only Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Full Name / Clinical Prescriber *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Farhan Khalid"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                  />
                  <p className="text-[11px] text-slate-500">Edit or confirm how your name displays on prescriptions</p>
                </div>

                {/* Read-Only Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Registered Clinical Email</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">Read-Only</span>
                  </label>
                  <div className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono flex items-center justify-between">
                    <span className="truncate">{user.email}</span>
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">lock</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Account login address cannot be changed</p>
                </div>
              </div>

              {/* Phone with Country Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Direct Mobile Phone (for 2FA &amp; Alerts) *</span>
                </label>
                <div className="relative flex rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
                  {/* Country Picker Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1.5 px-3 py-2.5 border-r border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs font-bold cursor-pointer rounded-l-xl shrink-0"
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span>{selectedCountry.dial}</span>
                    <span className="material-symbols-outlined text-[16px] text-slate-400">arrow_drop_down</span>
                  </button>

                  {/* Phone Input */}
                  <input
                    type="tel"
                    required
                    value={phoneDigits}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setPhoneDigits(digits);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder={`e.g. ${selectedCountry.min === 10 ? '9876543210' : 'Digits only'}`}
                    className="flex-1 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none font-medium text-slate-800"
                  />

                  {/* Country Picker Dropdown */}
                  {showCountryPicker && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 max-h-56 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50 divide-y divide-slate-100 py-1">
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
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-emerald-50 transition-colors ${
                            selectedCountry.code === c.code ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-base">{c.flag}</span>
                            <span>{c.name}</span>
                          </span>
                          <span className="font-mono text-slate-400">{c.dial}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {phoneError ? (
                  <p className="text-[11px] text-rose-600 font-medium">{phoneError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">Formatted for instant OTP and security alerts</p>
                )}
              </div>

              {/* Age & Gender Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Age */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Age (Years) *</label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 32"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Height & Weight Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Height */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Height</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 175 cm or 5 ft 9 in"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                    />
                    <span className="absolute right-3.5 top-2.5 text-slate-400 material-symbols-outlined text-[18px]">height</span>
                  </div>
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Weight</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 70 kg or 154 lbs"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                    />
                    <span className="absolute right-3.5 top-2.5 text-slate-400 material-symbols-outlined text-[18px]">fitness_center</span>
                  </div>
                </div>
              </div>

              {/* Allergies Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">warning</span>
                    <span className="text-xs font-bold text-slate-900">Any Known Drug / Medical Allergies? *</span>
                  </div>

                  <div className="flex items-center rounded-xl bg-slate-200/80 p-0.5 border border-slate-300">
                    <button
                      type="button"
                      onClick={() => {
                        setHasAllergies(false);
                        setAllergiesDescription('');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        !hasAllergies ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      No (NKDA)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasAllergies(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        hasAllergies ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {hasAllergies ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 pt-1"
                  >
                    <label className="text-[11px] font-bold text-amber-900">
                      Specify Allergens (e.g. Penicillin, Amoxicillin, Latex, NSAIDs) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={allergiesDescription}
                      onChange={(e) => setAllergiesDescription(e.target.value)}
                      placeholder="Enter drug or substance allergy details..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                    />
                  </motion.div>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                    No Known Drug Allergies (NKDA) recorded for this profile.
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white font-bold text-sm shadow-lg shadow-teal-700/20 hover:shadow-xl hover:from-emerald-500 hover:to-cyan-600 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Saving Clinical Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Clinical Profile &amp; Enter Portal</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
