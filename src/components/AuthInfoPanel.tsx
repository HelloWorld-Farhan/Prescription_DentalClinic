import { motion } from 'framer-motion';

/**
 * Shared animated info panel for Login (variant='login') and Signup (variant='signup').
 * Replaces the old video-background panels. Pure CSS + Framer Motion, no external video.
 */
export default function AuthInfoPanel({ variant }: { variant: 'login' | 'signup' }) {
  const isLogin = variant === 'login';

  const features = isLogin
    ? [
        { icon: 'medication',      label: 'Drug Interaction Screener', sub: 'Deterministic cross-match engine',  color: 'rose',    badge: 'Live Screening' },
        { icon: 'science',         label: 'Renal Clearance Guard',     sub: 'eGFR auto-dose adjustment',         color: 'amber',   badge: 'Auto-Adjust'    },
        { icon: 'verified_user',   label: 'Allergy Cross-Class Check', sub: 'Penicillin / cephalosporin safe',   color: 'teal',    badge: 'Cross-Safe'     },
      ]
    : [
        { icon: 'badge',           label: 'HHS NPI National Registry', sub: 'Live prescriber credential sync',   color: 'emerald', badge: 'Verified Live'  },
        { icon: 'fingerprint',     label: 'DEA Schedule II-IV EPCS',   sub: 'Dual-factor biometric identity',    color: 'cyan',    badge: '2FA Ready'      },
        { icon: 'local_hospital',  label: 'Inpatient Dental Privileges',sub: 'Institutional clinical tier access',color: 'teal',    badge: 'Tier I Active'  },
      ];

  type ColorKey = 'rose' | 'amber' | 'teal' | 'emerald' | 'cyan';
  const colorMap: Record<ColorKey, { dot: string; badge: string; glow: string; icon: string }> = {
    rose:    { dot: 'bg-rose-400 animate-pulse',    badge: 'bg-rose-950/60 text-rose-300 border-rose-500/40',       glow: 'from-rose-500/20',    icon: 'text-rose-300'    },
    amber:   { dot: 'bg-amber-400',                 badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40',    glow: 'from-amber-500/20',   icon: 'text-amber-300'   },
    teal:    { dot: 'bg-teal-400',                  badge: 'bg-teal-950/60 text-teal-300 border-teal-500/40',       glow: 'from-teal-500/20',    icon: 'text-teal-300'    },
    emerald: { dot: 'bg-emerald-400',               badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40', glow: 'from-emerald-500/20', icon: 'text-emerald-300' },
    cyan:    { dot: 'bg-cyan-400',                  badge: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',       glow: 'from-cyan-500/20',    icon: 'text-cyan-300'    },
  };

  const accent     = isLogin ? 'teal'  : 'cyan';
  const mainIcon   = isLogin ? 'medication' : 'badge';
  const titleText  = isLogin ? 'Clinical Interaction Screener' : 'Prescriber Privileges Gateway';
  const subText    = isLogin ? 'Deterministic Cross-Match Engine' : 'Dual-Factor Notarized Identity';
  const streamLabel= isLogin ? 'Prescription Safety Stream' : 'Prescriber Credential Stream';
  const versionTag = isLogin ? 'FHIR R4 v4.0.1' : 'NPI Registry v4.1';
  const bottomLeft = isLogin
    ? { label: 'Engine Verification',   value: 'Real-Time Interlock · Zero Fault' }
    : { label: 'Security Architecture', value: '256-Bit TLS AES · Zero-Knowledge' };
  const bottomRight = { label: 'Compliance Matrix', value: '21 CFR §1311 EPCS' };

  // Deterministic floating particles (no Math.random)
  const particles = [
    { left: '15%', top: '18%', size: 3, delay: 0,   dur: 6   },
    { left: '78%', top: '11%', size: 2, delay: 1.2, dur: 8   },
    { left: '88%', top: '54%', size: 4, delay: 0.5, dur: 7   },
    { left: '10%', top: '70%', size: 2, delay: 2,   dur: 9   },
    { left: '55%', top: '84%', size: 3, delay: 1.5, dur: 6.5 },
    { left: '42%', top: '32%', size: 2, delay: 0.8, dur: 7.5 },
  ];

  const accentTextClass  = accent === 'teal' ? 'text-teal-300'    : 'text-cyan-300';
  const accentBadgeClass = accent === 'teal'
    ? 'text-teal-300 bg-teal-950/80 border-teal-500/40'
    : 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40';
  const tierBadgeClass   = accent === 'teal'
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  const heroGradient     = accent === 'teal'
    ? 'from-teal-500/20 to-emerald-600/20'
    : 'from-cyan-500/20 to-teal-600/20';
  const cardHeaderGrad   = accent === 'teal'
    ? 'from-teal-500/25 to-emerald-500/25'
    : 'from-cyan-500/25 to-teal-500/25';

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 min-h-[580px] bg-gradient-to-br from-[#060f1a] via-[#091c2b] to-[#030c12] flex flex-col justify-between p-6 sm:p-8 text-white">

      {/* Ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute -top-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          accent === 'teal' ? 'bg-teal-500/20' : 'bg-cyan-500/20'
        }`}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-emerald-500/15"
      />

      {/* Floating micro-particles */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -14, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size, position: 'absolute' }}
          className={`rounded-full pointer-events-none ${accent === 'teal' ? 'bg-teal-300' : 'bg-cyan-300'}`}
        />
      ))}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">{streamLabel}</span>
        </div>
        <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${accentBadgeClass}`}>
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
                '0 0 18px 3px rgba(20,184,166,0.2)',
                '0 0 40px 12px rgba(20,184,166,0.45)',
                '0 0 18px 3px rgba(20,184,166,0.2)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-white/15 bg-gradient-to-br ${heroGradient} backdrop-blur-xl`}
          >
            <span className={`material-symbols-outlined text-[34px] ${accentTextClass}`}>{mainIcon}</span>
          </motion.div>
          <div className="text-center mt-1">
            <h2 className="text-sm font-extrabold text-white tracking-tight">{titleText}</h2>
            <p className={`text-[11px] mt-0.5 font-semibold ${accentTextClass} opacity-80`}>{subText}</p>
          </div>
        </div>

        {/* Glassmorphic feature card */}
        <div className="bg-white/[0.07] backdrop-blur-2xl p-4 rounded-2xl border border-white/12 shadow-2xl space-y-3">
          {/* Card header row */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${cardHeaderGrad} border border-white/10 flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-[17px] ${accentTextClass}`}>{mainIcon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{titleText}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{subText}</p>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${tierBadgeClass}`}>
              {isLogin ? 'Live Screening' : 'Tier II Ready'}
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
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] transition-all cursor-default"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.glow} to-transparent border border-white/10 flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[15px] ${c.icon}`}>{f.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 leading-tight">{f.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{f.sub}</p>
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
        className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs"
      >
        <div>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 block font-semibold">{bottomLeft.label}</span>
          <span className={`text-xs font-bold font-mono flex items-center gap-1.5 mt-0.5 ${accentTextClass}`}>
            <span className="material-symbols-outlined text-[13px]">{isLogin ? 'verified' : 'lock'}</span>
            <span>{bottomLeft.value}</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 block font-semibold">{bottomRight.label}</span>
          <span className={`text-xs font-bold ${accent === 'teal' ? 'text-emerald-300' : 'text-cyan-300'}`}>{bottomRight.value}</span>
        </div>
      </motion.div>
    </div>
  );
}
