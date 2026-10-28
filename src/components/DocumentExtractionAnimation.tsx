import React, {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
} from 'react';

export interface DocumentExtractionRef {
  playExtraction: (optionalPromise?: Promise<any>) => Promise<void>;
  resetExtraction: () => void;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
}

interface MessageSlot {
  stepIdx: number;
  text: string;
  state: 'entering' | 'holding' | 'cutting' | 'exiting';
  cutActive: boolean;
  cutFinished: boolean;
  isCompletion?: boolean;
}

interface DocumentExtractionAnimationProps {
  onComplete?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const MESSAGES = [
  'Uploading file',
  'Reading pages',
  'Detecting medicines',
  'Normalizing dosages',
  'Screening interactions',
];

export const DocumentExtractionAnimation = forwardRef<
  DocumentExtractionRef,
  DocumentExtractionAnimationProps
>(({ onComplete, className = '', children }, ref) => {
  const [isActive, setIsActive] = useState(false);
  const [activeSlot, setActiveSlot] = useState<MessageSlot | null>(null);
  const [exitingSlot, setExitingSlot] = useState<MessageSlot | null>(null);
  const [activeStepCounter, setActiveStepCounter] = useState<number>(0);
  const [dotIsAqua, setDotIsAqua] = useState(false);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [sparkCenter, setSparkCenter] = useState<'right' | 'radial'>('right');
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

  const activePromiseRef = useRef<Promise<any> | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isPlayingRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const resetExtraction = useCallback(() => {
    clearAllTimers();
    isPlayingRef.current = false;
    setIsActive(false);
    setActiveSlot(null);
    setExitingSlot(null);
    setActiveStepCounter(0);
    setDotIsAqua(false);
    setSparks([]);
    setCompletedSteps([false, false, false, false, false]);
    activePromiseRef.current = null;
  }, [clearAllTimers]);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const spawnSparks = useCallback((count: number, isRadial = false) => {
    setSparkCenter(isRadial ? 'radial' : 'right');
    const newSparks: Spark[] = [];
    const timestamp = Date.now();
    for (let i = 0; i < count; i++) {
      let angle = 0;
      if (isRadial) {
        angle = (i / count) * 360 + (Math.random() * 16 - 8);
      } else {
        // Random right-facing arc: -50deg to +50deg
        angle = -50 + Math.random() * 100;
      }
      const distance = 32 + Math.random() * 46; // 32px to 78px
      newSparks.push({
        id: timestamp + i,
        x: 0,
        y: 0,
        angle,
        distance,
      });
    }
    setSparks(newSparks);
    const cleanupTimer = setTimeout(() => {
      setSparks([]);
    }, 920);
    timeoutsRef.current.push(cleanupTimer);
  }, []);

  const playExtraction = useCallback(
    (optionalPromise?: Promise<any>): Promise<void> => {
      return new Promise<void>((resolve) => {
        resetExtraction();
        setIsActive(true);
        isPlayingRef.current = true;
        if (optionalPromise) {
          activePromiseRef.current = optionalPromise;
        }

        const runStep = (stepIdx: number) => {
          if (!isPlayingRef.current) return;

          if (stepIdx < MESSAGES.length) {
            setActiveStepCounter(stepIdx);
            setDotIsAqua(false);

            const newSlot: MessageSlot = {
              stepIdx,
              text: MESSAGES[stepIdx],
              state: 'entering',
              cutActive: false,
              cutFinished: false,
            };
            setActiveSlot(newSlot);

            // 1. Entrance takes 1.1s -> then holds for ~1.2s
            const holdTimer = setTimeout(() => {
              if (!isPlayingRef.current) return;
              setActiveSlot((prev) => (prev ? { ...prev, state: 'holding' } : null));
            }, 1100);
            timeoutsRef.current.push(holdTimer);

            // 2. Cut line draws across text after holding (at 1100 + 1100 = 2200ms)
            const cutTimer = setTimeout(() => {
              if (!isPlayingRef.current) return;
              setActiveSlot((prev) => (prev ? { ...prev, state: 'cutting', cutActive: true } : null));

              // Cut line finishes in 0.6s (at 2200 + 580 = 2780ms)
              const sparkTimer = setTimeout(() => {
                if (!isPlayingRef.current) return;
                setDotIsAqua(true); // dot stops pulsing and turns aqua
                spawnSparks(12, false);
                setActiveSlot((prev) => (prev ? { ...prev, cutFinished: true } : null));
                setCompletedSteps((prev) => {
                  const updated = [...prev];
                  updated[stepIdx] = true;
                  return updated;
                });
              }, 580);
              timeoutsRef.current.push(sparkTimer);
            }, 2200);
            timeoutsRef.current.push(cutTimer);

            // 3. Word and cut line move up together and vanish (starts at 3000ms, duration 0.95s)
            const exitStartTimer = setTimeout(() => {
              if (!isPlayingRef.current) return;
              setActiveSlot((currentActive) => {
                if (currentActive) {
                  setExitingSlot({ ...currentActive, state: 'exiting' });
                }
                return null;
              });

              // Exiting element finishes in 0.95s (950ms)
              const exitDoneTimer = setTimeout(() => {
                setExitingSlot(null);
              }, 950);
              timeoutsRef.current.push(exitDoneTimer);
            }, 3000);
            timeoutsRef.current.push(exitStartTimer);

            // 4. Next message starts rising with ~450ms overlap before previous exits completely (at 3000 + 500 = 3500ms)
            const nextStepTimer = setTimeout(() => {
              if (!isPlayingRef.current) return;
              runStep(stepIdx + 1);
            }, 3500);
            timeoutsRef.current.push(nextStepTimer);
          } else {
            // STEP 6: Final check completion
            const proceedToCompletion = () => {
              if (!isPlayingRef.current) return;
              setActiveStepCounter(5);
              setDotIsAqua(true);

              const completionSlot: MessageSlot = {
                stepIdx: 5,
                text: 'Extraction completed',
                state: 'entering',
                cutActive: false,
                cutFinished: false,
                isCompletion: true,
              };
              setActiveSlot(completionSlot);

              // Radial 18-spark burst around animated check mark
              const sparkTimer = setTimeout(() => {
                if (!isPlayingRef.current) return;
                spawnSparks(18, true);
              }, 450);
              timeoutsRef.current.push(sparkTimer);

              // Holds ~1.5s, then vanishes upward
              const holdTimer = setTimeout(() => {
                if (!isPlayingRef.current) return;
                setActiveSlot((currentActive) => {
                  if (currentActive) {
                    setExitingSlot({ ...currentActive, state: 'exiting' });
                  }
                  return null;
                });

                // Vanishes upward over 0.95s, then blur lifts and returns to original dropzone smoothly
                const finishTimer = setTimeout(() => {
                  resetExtraction();
                  if (onComplete) onComplete();
                  resolve();
                }, 950);
                timeoutsRef.current.push(finishTimer);
              }, 1950);
              timeoutsRef.current.push(holdTimer);
            };

            if (activePromiseRef.current) {
              activePromiseRef.current
                .catch(() => {})
                .finally(() => {
                  proceedToCompletion();
                });
            } else {
              proceedToCompletion();
            }
          }
        };

        runStep(0);
      });
    },
    [resetExtraction, spawnSparks, onComplete]
  );

  useImperativeHandle(
    ref,
    () => ({
      playExtraction,
      resetExtraction,
    }),
    [playExtraction, resetExtraction]
  );

  // Helper to render a message slot
  const renderMessageContent = (slot: MessageSlot) => {
    const isExiting = slot.state === 'exiting';
    return (
      <div
        key={`${slot.stepIdx}-${slot.state}`}
        className="relative flex flex-col items-center justify-center text-center dea-animated pointer-events-none"
        style={{
          animation: isExiting
            ? 'deaMessageExit 0.95s cubic-bezier(.7,0,.84,0) forwards'
            : 'deaMessageEnter 1.1s cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {/* Animated Checkmark for Completion */}
        {slot.isCompletion && (
          <div className="mb-4 relative flex items-center justify-center">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              className="overflow-visible"
            >
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="#0f766e"
                strokeWidth="2.2"
                strokeDasharray="165"
                strokeDashoffset="165"
                strokeLinecap="round"
                style={{
                  animation: 'deaDrawCircle 0.8s cubic-bezier(.16,1,.3,1) forwards',
                }}
              />
              <path
                d="M20 33.5L28.5 42L44 24"
                stroke="#0f766e"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                strokeDashoffset="48"
                style={{
                  animation: 'deaDrawCheck 0.6s cubic-bezier(.16,1,.3,1) 0.3s forwards',
                }}
              />
            </svg>
          </div>
        )}

        {/* Message Word with Staggered Per-Letter Entrance */}
        <div
          className={`relative inline-block dea-font-sora select-none ${
            slot.isCompletion ? 'font-normal' : 'font-light'
          }`}
          style={{
            fontSize: 'clamp(28px, 5.4vw, 56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {slot.text.split('').map((char, charIdx) => (
            <span
              key={charIdx}
              className="dea-glass-letter"
              style={{
                animation:
                  !isExiting
                    ? `deaLetterReveal 1s cubic-bezier(.16,1,.3,1) ${charIdx * 24}ms backwards`
                    : undefined,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}

          {/* Glowing Cut Line */}
          {slot.cutActive && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: '58%',
                left: '-12px',
                right: '-12px',
                height: '3px',
                background: 'linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)',
                boxShadow: '0 0 12px rgba(45,212,191,0.95), 0 0 4px #0f766e',
                transformOrigin: 'left center',
                animation: 'deaCutDraw 0.6s cubic-bezier(.65,0,.35,1) forwards',
              }}
            >
              {/* Glowing 12px Tip Dot travelling along tip */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#2dd4bf]"
                style={{
                  boxShadow: '0 0 14px #2dd4bf, 0 0 6px #ffffff',
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Dynamic Keyframes and Motion Styles */}
      <style>{`
        @keyframes deaDriftA {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(80px, -46px) scale(1.25); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes deaDriftB {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-80px, 46px) scale(1.25); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes deaSweepBeam {
          0% { transform: translateX(-160%); }
          100% { transform: translateX(260%); }
        }
        @keyframes deaPulseRing {
          0% { transform: scale(0.4); opacity: 0.35; }
          80% { opacity: 0.15; }
          100% { transform: scale(2.3); opacity: 0; }
        }
        @keyframes deaDotPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        @keyframes deaCutDraw {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes deaDrawCheck {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes deaDrawCircle {
          0% { stroke-dashoffset: 165; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes deaSparkFly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes deaMessageEnter {
          0% { transform: translateY(170px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes deaMessageExit {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-170px); opacity: 0; }
        }
        @keyframes deaLetterReveal {
          0% { transform: translateY(50%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        .dea-font-sora {
          font-family: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .dea-font-mono {
          font-family: 'JetBrains Mono', monospace;
        }

        .dea-glass-letter {
          display: inline-block;
          background: linear-gradient(180deg, rgba(11,40,38,.95) 0%, rgba(15,118,110,.88) 52%, rgba(94,234,212,.78) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          filter: drop-shadow(0 1px 0 rgba(255,255,255,.95)) drop-shadow(0 8px 16px rgba(15,118,110,.22));
          transition: transform 1s cubic-bezier(.16,1,.3,1), opacity 1s cubic-bezier(.16,1,.3,1);
        }

        .dea-stage-mask {
          mask-image: linear-gradient(to bottom, transparent 0%, black 24%, black 76%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 24%, black 76%, transparent 100%);
        }

        @media (prefers-reduced-motion: reduce) {
          .dea-animated {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* 1. Underlying Dropzone Content with Smooth Blur Transition */}
      <div
        className={`w-full transition-all duration-1000 ease-out ${
          isActive ? 'pointer-events-none select-none' : ''
        }`}
        style={
          isActive
            ? {
                filter: 'blur(8px)',
                opacity: 0.85,
                transform: 'scale(1.015)',
                borderColor: '#cbd5d1',
              }
            : undefined
        }
      >
        {children}
      </div>

      {/* 2. Frosted White Glass Layer & Extraction Stage */}
      {isActive && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-30 flex flex-col items-center justify-between pointer-events-auto select-none rounded-2xl overflow-hidden transition-opacity duration-500 backdrop-blur-[2px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 70%, rgba(240, 253, 250, 0.6) 100%)',
          }}
        >
          {/* Ambient Motion Background Layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Drifting Blobs */}
            <div
              className="absolute -top-12 -left-12 w-[280px] h-[280px] rounded-full blur-3xl opacity-80"
              style={{
                background: 'radial-gradient(circle, rgba(15,118,110,.20) 0%, transparent 70%)',
                animation: 'deaDriftA 8s ease-in-out infinite alternate',
              }}
            />
            <div
              className="absolute -bottom-12 -right-12 w-[280px] h-[280px] rounded-full blur-3xl opacity-80"
              style={{
                background: 'radial-gradient(circle, rgba(45,212,191,.24) 0%, transparent 70%)',
                animation: 'deaDriftB 10s ease-in-out infinite alternate',
              }}
            />

            {/* Sweeping Light Beam */}
            <div
              className="absolute inset-y-0 w-[160px] pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(15,118,110,0.14) 50%, transparent 100%)',
                animation: 'deaSweepBeam 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />

            {/* Concentric Pulsing Rings */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border border-teal-600/35 pointer-events-none"
              style={{ animation: 'deaPulseRing 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border border-teal-600/35 pointer-events-none"
              style={{
                animation: 'deaPulseRing 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                animationDelay: '1.6s',
              }}
            />
          </div>

          {/* Top Step Counter Header */}
          <div className="pt-6 sm:pt-8 z-10 flex items-center justify-center">
            {activeStepCounter < MESSAGES.length && (
              <div className="dea-font-mono text-[12px] font-medium tracking-[0.18em] uppercase text-[#0f766e] flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50/85 border border-teal-600/15 backdrop-blur-xs shadow-2xs">
                <span
                  className="w-2 h-2 rounded-full inline-block transition-colors duration-300"
                  style={{
                    backgroundColor: dotIsAqua ? '#2dd4bf' : '#0f766e',
                    animation: dotIsAqua ? 'none' : 'deaDotPulse 1.4s ease-in-out infinite',
                    boxShadow: dotIsAqua
                      ? '0 0 8px rgba(45,212,191,0.85)'
                      : '0 0 6px rgba(15,118,110,0.5)',
                  }}
                />
                <span>
                  {String(activeStepCounter + 1).padStart(2, '0')} /{' '}
                  {String(MESSAGES.length).padStart(2, '0')}
                </span>
              </div>
            )}
            {activeStepCounter === 5 && (
              <div className="dea-font-mono text-[11px] font-semibold tracking-[0.18em] uppercase text-emerald-700 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/90 border border-emerald-500/20 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span>COMPLETE</span>
              </div>
            )}
          </div>

          {/* Central Message & Cut-Line Viewport (With 450ms Message Overlap) */}
          <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center dea-stage-mask px-4 overflow-hidden min-h-[160px]">
            {/* Exiting Message (Flying Upward and Vanishing) */}
            {exitingSlot && (
              <div className="absolute inset-0 flex items-center justify-center">
                {renderMessageContent(exitingSlot)}
              </div>
            )}

            {/* Active Entering/Holding/Cutting Message */}
            {activeSlot && (
              <div className="absolute inset-0 flex items-center justify-center">
                {renderMessageContent(activeSlot)}
              </div>
            )}

            {/* Spark Particles */}
            {sparks.map((spark) => {
              const rad = (spark.angle * Math.PI) / 180;
              const tx = Math.cos(rad) * spark.distance;
              const ty = Math.sin(rad) * spark.distance;
              return (
                <span
                  key={spark.id}
                  className="absolute pointer-events-none rounded-full z-20"
                  style={
                    {
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#2dd4bf',
                      boxShadow: '0 0 8px #2dd4bf, 0 0 3px #ffffff',
                      top: sparkCenter === 'radial' ? '38%' : '54%',
                      left: sparkCenter === 'radial' ? '50%' : 'calc(50% + 140px)',
                      '--tx': `${tx}px`,
                      '--ty': `${ty}px`,
                      animation: 'deaSparkFly 0.9s cubic-bezier(.16,1,.3,1) forwards',
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>

          {/* Bottom Segmented Progress (5 Pills) */}
          <div className="pb-6 sm:pb-8 z-10 flex items-center justify-center gap-2">
            {[0, 1, 2, 3, 4].map((idx) => {
              const isFilled =
                completedSteps[idx] || (activeStepCounter !== null && activeStepCounter > idx);
              const isCurrent = activeStepCounter === idx;
              return (
                <div
                  key={idx}
                  className="w-[36px] h-[4px] rounded-full overflow-hidden transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(15,118,110,0.14)',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: isFilled ? '100%' : isCurrent ? '55%' : '0%',
                      background: 'linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)',
                      boxShadow: isFilled ? '0 0 6px rgba(45,212,191,0.6)' : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

DocumentExtractionAnimation.displayName = 'DocumentExtractionAnimation';
export default DocumentExtractionAnimation;
