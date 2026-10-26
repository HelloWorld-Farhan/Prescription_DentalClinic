import { motion, AnimatePresence, EASE } from '../lib/motion';

interface Props {
  password: string;
  confirmPassword?: string; // optional – renders match row if provided
}

const CRITERIA = [
  { key: 'len',     label: '8+ Characters',     icon: 'password',        test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: '1 Uppercase',        icon: 'text_fields',     test: (p: string) => /[A-Z]/.test(p) },
  { key: 'nums',    label: '2 Numbers',          icon: 'pin',             test: (p: string) => (p.match(/\d/g) || []).length >= 2 },
  { key: 'special', label: '1 Special Symbol',   icon: 'token',           test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function getStrength(password: string) {
  const score = CRITERIA.filter((c) => c.test(password)).length;
  if (password.length === 0) return { score: 0, label: '',       color: 'bg-outline/20' };
  if (score <= 1)            return { score: 1, label: 'Weak',   color: 'bg-rose-500'  };
  if (score === 2)           return { score: 2, label: 'Fair',   color: 'bg-amber-500' };
  if (score === 3)           return { score: 3, label: 'Good',   color: 'bg-primary'   };
  return                            { score: 4, label: 'Strong', color: 'bg-emerald-500' };
}

const segColors: Record<number, string[]> = {
  0: ['bg-outline/15', 'bg-outline/15', 'bg-outline/15', 'bg-outline/15'],
  1: ['bg-rose-500',   'bg-outline/15', 'bg-outline/15', 'bg-outline/15'],
  2: ['bg-amber-500',  'bg-amber-500',  'bg-outline/15', 'bg-outline/15'],
  3: ['bg-primary',    'bg-primary',    'bg-primary',    'bg-outline/15'],
  4: ['bg-emerald-500','bg-emerald-500','bg-emerald-500','bg-emerald-500'],
};

const labelColors: Record<number, string> = {
  0: 'text-outline',
  1: 'text-rose-500',
  2: 'text-amber-500',
  3: 'text-primary',
  4: 'text-emerald-600',
};

export default function PasswordStrengthMeter({ password, confirmPassword }: Props) {
  const { score, label } = getStrength(password);
  const segs = segColors[score];

  const passwordsMatch =
    confirmPassword !== undefined &&
    confirmPassword.length > 0 &&
    password === confirmPassword;
  const passwordsMismatch =
    confirmPassword !== undefined &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  return (
    <div className="space-y-3">
      {/* Strength bar + label */}
      {password.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Password Strength
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                initial={{ opacity: 0, y: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className={`text-[11px] font-extrabold uppercase tracking-widest ${labelColors[score]}`}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* 4-segment bar */}
          <div className="grid grid-cols-4 gap-1">
            {segs.map((cls, i) => (
              <motion.div
                key={i}
                layout
                animate={{ opacity: 1 }}
                className={`h-1.5 rounded-full transition-colors duration-400 ${cls}`}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Criteria pills */}
      <div className="grid grid-cols-2 gap-2">
        {CRITERIA.map((c, i) => {
          const met = c.test(password);
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: i * 0.05 }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all duration-300 ${
                met
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-surface-container-low border-surface-container-high/60'
              }`}
            >
              {/* Animated icon morph */}
              <div className="relative w-4 h-4 shrink-0">
                <AnimatePresence mode="wait">
                  {met ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.15, ease: EASE }}
                      className="material-symbols-outlined text-[16px] text-emerald-600 absolute inset-0"
                    >
                      check_circle
                    </motion.span>
                  ) : (
                    <motion.span
                      key="empty"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.15, ease: EASE }}
                      className="material-symbols-outlined text-[16px] text-outline absolute inset-0"
                    >
                      radio_button_unchecked
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <span
                className={`text-[11px] font-semibold leading-tight transition-colors duration-300 ${
                  met ? 'text-emerald-700' : 'text-on-surface-variant'
                }`}
              >
                {c.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Confirm password match row — only shown when confirmPassword prop is passed */}
      {confirmPassword !== undefined && confirmPassword.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
            passwordsMatch
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="relative w-5 h-5 shrink-0">
            <AnimatePresence mode="wait">
              {passwordsMatch ? (
                <motion.span
                  key="match"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="material-symbols-outlined text-[20px] text-emerald-600 absolute inset-0"
                >
                  verified
                </motion.span>
              ) : (
                <motion.span
                  key="mismatch"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="material-symbols-outlined text-[20px] text-rose-500 absolute inset-0"
                >
                  cancel
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <span
            className={`text-xs font-semibold transition-colors duration-300 ${
              passwordsMatch ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {passwordsMatch ? 'Passwords match ✓' : 'Passwords do not match'}
          </span>

          {/* Subtle status indicator dot on match */}
          {passwordsMatch && (
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </motion.div>
      )}
    </div>
  );
}
