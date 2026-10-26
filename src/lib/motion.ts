import {
  motion,
  AnimatePresence,
  MotionConfig,
  LazyMotion,
  domAnimation,
  m,
  type Variants,
  type Transition
} from 'framer-motion';

/**
 * CLINICAL MOTION SYSTEM TOKENS
 * Precise, subtle, and calm. Deceleration-focused easing with zero playful bounce.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATIONS = {
  instant: 0.1,
  fast: 0.2,
  base: 0.25,
  slow: 0.35,
  chart: 0.8,
  counter: 1.0,
  counterUpdate: 0.5,
} as const;

export const DISTANCES = {
  entranceY: 8,
  drawerX: 24,
  modalScale: 0.97,
} as const;

/**
 * The only spring allowed in the system is for the sidebar width collapse.
 * Zero bounce (damping: 32, stiffness: 300).
 */
export const SIDEBAR_SPRING: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
};

export const BASE_TRANSITION: Transition = {
  duration: DURATIONS.base,
  ease: EASE,
};

export const FAST_TRANSITION: Transition = {
  duration: DURATIONS.fast,
  ease: EASE,
};

export const INSTANT_TRANSITION: Transition = {
  duration: DURATIONS.instant,
  ease: EASE,
};

/**
 * CORE CLINICAL MOTION VARIANTS
 */

// Stagger container: 0.05s per item, max 8 items
export const staggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

// Subtle upward fade (8px lift)
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: DISTANCES.entranceY },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: DURATIONS.fast, ease: EASE },
  },
};

// Clean opacity fade
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: FAST_TRANSITION,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: EASE },
  },
};

// Modals: backdrop fade + panel scale (0.97 -> 1)
export const modalVariants = {
  backdrop: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATIONS.fast, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
  },
  panel: {
    hidden: { opacity: 0, scale: DISTANCES.modalScale, y: 4 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: DURATIONS.fast, ease: EASE },
    },
    exit: {
      opacity: 0,
      scale: DISTANCES.modalScale,
      y: 4,
      transition: { duration: 0.15, ease: EASE },
    },
  },
};

// Drawers: x 24px to 0, fade
export const drawerVariants: Variants = {
  hidden: { opacity: 0, x: DISTANCES.drawerX },
  visible: {
    opacity: 1,
    x: 0,
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    x: DISTANCES.drawerX,
    transition: FAST_TRANSITION,
  },
};

// Mobile Bottom Sheet variant
export const bottomSheetVariants: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: FAST_TRANSITION,
  },
};

// Toasts: y: 8 to 0 + fade
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: FAST_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: EASE },
  },
};

// Alert Banners: height tween auto
export const bannerVariants: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: FAST_TRANSITION,
  },
};

// Page transitions: 8px entrance rise, fade
export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: DISTANCES.entranceY },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: EASE },
  },
};

// OTP Digit Entry
export const otpBoxVariants: Variants = {
  initial: { scale: 0.9, opacity: 0.6 },
  entered: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.12, ease: EASE },
  },
};

// Error Shake
export const shakeVariants: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: DURATIONS.slow, ease: EASE },
  },
};

// Checkmark path drawing (0 bounce)
export const popCheckVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.2, ease: EASE },
  },
};

// Button Tap feedback (calm scale 0.98, instant)
export const buttonTapTransition: Transition = {
  duration: DURATIONS.instant,
  ease: EASE,
};

// Re-exports
export { motion, AnimatePresence, MotionConfig, LazyMotion, domAnimation, m };
