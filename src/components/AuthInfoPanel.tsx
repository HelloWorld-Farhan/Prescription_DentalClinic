import { motion } from 'framer-motion';

/**
 * Shared animated info panel for Login (variant='login') and Signup (variant='signup').
 * Replaces the old video-background panels. Pure CSS + Framer Motion, no external video.
 */
export default function AuthInfoPanel({ variant }: { variant: 'login' | 'signup' }) {
  const isLogin = variant === 'login';

  const features = isLogin
    ? [
        { icon: 'medication',        label: 'Drug Interaction Screener', sub: 'Instant drug-to-drug safety screening',      color: 'teal',    badge: 'Active'    },
        { icon: 'verified_user',     label: 'Patient Allergy Alerts',   sub: 'Penicillin & cross-class allergy protection', color: 'emerald', badge: 'Protected' },
        { icon: 'health_and_safety', label: 'Safe Dosage Guidance',     sub: 'Clinical guidance for dental prescriptions',  color: 'cyan',    badge: 'Verified'  },
      ]
    : [
        { icon: 'dentistry',         label: 'Dental Clinic Care Team',  sub: 'For verified dentists, doctors & staff',       color: 'teal',    badge: 'Authorized'},
        { icon: 'lock',              label: 'Secure Account Access',    sub: 'Fast sign-in & private credential protection',color: 'emerald', badge: 'Encrypted' },
        { icon: 'clinical_notes',    label: 'Safety Screening Tools',   sub: 'Automatic safety checks during patient visits',color: 'cyan',    badge: 'Ready'     },
      ];

  type ColorKey = 'rose' | 'amber' | 'teal' | 'emerald' | 'cyan';
  const colorMap: Record<ColorKey, { dot: string; badge: string; glow: string; icon: string }> = {
    rose:    { dot: 'bg-rose-500 animate-pulse', badge: 'bg-rose-50 text-rose-700 border-rose-200', glow: 'from-rose-100/80', icon: 'text-rose-600' },
    amber:   { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', glow: 'from-amber-100/80', icon: 'text-amber-600' },
    teal:    { dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border-teal-200', glow: 'from-teal-100/80', icon: 'text-teal-600' },
    emerald: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', glow: 'from-emerald-100/80', icon: 'text-emerald-600' },
    cyan:    { dot: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', glow: 'from-cyan-100/80', icon: 'text-cyan-600' },
  };

  const accent     = isLogin ? 'teal'  : 'cyan';
  const mainIcon   = isLogin ? 'health_and_safety' : 'dentistry';
  const titleText  = isLogin ? 'Smile Clinic Prescription Portal' : 'Clinician Account Portal';
  const subText    = isLogin ? 'Smart Clinical Safety & Care System' : 'Prescriber & Team Registration';
  const streamLabel= isLogin ? 'Clinical Safety Active' : 'Clinician Registration';
  const versionTag = 'Smile Clinic';
  const bottomLeft = isLogin
    ? { label: 'System Status', value: 'Smile Clinic Verified' }
    : { label: 'Portal Access', value: 'Smile Clinic Team' };
  const bottomRight = isLogin
    ? { label: 'Data Security', value: 'Encrypted & Protected' }
    : { label: 'Patient Privacy', value: 'Protected Records' };

  // Deterministic floating particles (no Math.random)
  const particles = [
    { left: '15%', top: '18%', size: 4, delay: 0,   dur: 6   },
    { left: '78%', top: '11%', size: 3, delay: 1.2, dur: 8   },
    { left: '88%', top: '54%', size: 4, delay: 0.5, dur: 7   },
    { left: '10%', top: '70%', size: 3, delay: 2,   dur: 9   },
    { left: '55%', top: '84%', size: 4, delay: 1.5, dur: 6.5 },
    { left: '42%', top: '32%', size: 3, delay: 0.8, dur: 7.5 },
  ];

  const accentTextClass  = accent === 'teal' ? 'text-teal-700' : 'text-cyan-700';
  const accentBadgeClass = accent === 'teal'
    ? 'text-teal-700 bg-teal-50 border-teal-200'
    : 'text-cyan-700 bg-cyan-50 border-cyan-200';
  const tierBadgeClass   = accent === 'teal'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-cyan-50 text-cyan-700 border-cyan-200';
  const heroGradient     = accent === 'teal'
    ? 'from-teal-50 via-teal-100/60 to-emerald-50'
    : 'from-cyan-50 via-cyan-100/60 to-teal-50';
  const cardHeaderGrad   = accent === 'teal'
    ? 'from-teal-100/80 to-emerald-100/80'
    : 'from-cyan-100/80 to-teal-100/80';

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-xl border border-surface-container-high h-full min-h-0 lg:min-h-[580px] w-full bg-gradient-to-br from-white via-slate-50 to-[#F0FDFA]/30 flex flex-col justify-between p-5 sm:p-8 text-on-surface">

      {/* Ambient orbs with 60fps GPU acceleration */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute -top-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none gpu-layer ${
          accent === 'teal' ? 'bg-teal-200/40' : 'bg-cyan-200/40'
        }`}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-emerald-200/35 gpu-layer"
      />

      {/* Floating micro-particles with GPU compositing */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -12, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, position: 'absolute' }}
          className={`rounded-full pointer-events-none gpu-layer ${accent === 'teal' ? 'bg-teal-400/50' : 'bg-cyan-400/50'}`}
        />
      ))}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.5) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      {/* TOP: Live badge + version tag */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative z-10 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low/90 backdrop-blur-md border border-surface-container-high shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-bold text-on-surface tracking-widest uppercase">{streamLabel}</span>
        </div>
        <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${accentBadgeClass}`}>
          {versionTag}
        </span>
      </motion.div>

      {/* CENTER: Hero icon + glassmorphic card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 my-auto py-4 space-y-5"
      >
        {/* Hero glowing icon */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            animate={{
              boxShadow: [
                '0 0 16px 2px rgba(20,184,166,0.15)',
                '0 0 32px 8px rgba(20,184,166,0.3)',
                '0 0 16px 2px rgba(20,184,166,0.15)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-teal-200/70 bg-gradient-to-br ${heroGradient} shadow-md`}
          >
            <span className={`material-symbols-outlined text-[34px] ${accentTextClass}`}>{mainIcon}</span>
          </motion.div>
          <div className="text-center mt-1">
            <h2 className="text-sm font-extrabold text-on-surface tracking-tight">{titleText}</h2>
            <p className={`text-[11px] mt-0.5 font-semibold ${accentTextClass}`}>{subText}</p>
          </div>
        </div>

        {/* Crisp feature card */}
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-surface-container-high shadow-lg space-y-3">
          {/* Card header row */}
          <div className="flex items-center justify-between border-b border-surface-container-high/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${cardHeaderGrad} border border-teal-200/60 flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-[17px] ${accentTextClass}`}>{mainIcon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface leading-tight">{titleText}</p>
                <p className="text-[10px] text-on-surface-variant leading-tight">{subText}</p>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${tierBadgeClass}`}>
              {isLogin ? 'Active System' : 'Verified Team'}
            </span>
          </div>

          {/* Feature rows */}
          {features.map((f, i) => {
            const c = colorMap[f.color as ColorKey];
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38, delay: 0.45 + i * 0.1 }}
                whileHover={{ x: 4, scale: 1.015 }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low border border-surface-container-high/80 transition-all cursor-default shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.glow} to-transparent border border-slate-200/60 flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[15px] ${c.icon}`}>{f.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-on-surface leading-tight">{f.label}</p>
                    <p className="text-[10px] text-on-surface-variant leading-tight">{f.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${c.badge}`}>{f.badge}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* BOTTOM: Telemetry strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="relative z-10 pt-4 border-t border-surface-container-high flex items-center justify-between text-xs"
      >
        <div>
          <span className="text-[10px] uppercase tracking-widest text-outline block font-semibold">{bottomLeft.label}</span>
          <span className={`text-xs font-bold flex items-center gap-1.5 mt-0.5 ${accentTextClass}`}>
            <span className="material-symbols-outlined text-[13px]">{isLogin ? 'verified' : 'lock'}</span>
            <span>{bottomLeft.value}</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-outline block font-semibold">{bottomRight.label}</span>
          <span className={`text-xs font-bold ${accent === 'teal' ? 'text-emerald-700' : 'text-cyan-700'}`}>{bottomRight.value}</span>
        </div>
      </motion.div>
    </div>
  );
}
