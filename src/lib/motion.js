import {
  motion,
  AnimatePresence,
  MotionConfig,
  LazyMotion,
  domAnimation,
  m,
} from 'framer-motion';

export const EASE = [0.16, 1, 0.3, 1];

export const DURATIONS = {
  instant: 0.12,
  fast: 0.25,
  base: 0.38,
  slow: 0.55,
  chart: 0.8,
  counter: 1.0,
  counterUpdate: 0.45,
};

export const DISTANCES = {
  entranceY: 10,
  drawerX: 24,
  modalScale: 0.97,
};

export const SIDEBAR_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
};

export const BASE_TRANSITION = {
  duration: DURATIONS.base,
  ease: EASE,
};

export const FAST_TRANSITION = {
  duration: DURATIONS.fast,
  ease: EASE,
};

export const INSTANT_TRANSITION = {
  duration: DURATIONS.instant,
  ease: EASE,
};

export const staggerVariants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: DISTANCES.entranceY },
  initial: { opacity: 0, y: DISTANCES.entranceY },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  animate: {
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

export const fadeVariants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: FAST_TRANSITION,
  },
  animate: {
    opacity: 1,
    transition: FAST_TRANSITION,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: EASE },
  },
};

export const modalVariants = {
  backdrop: {
    hidden: { opacity: 0 },
    initial: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATIONS.fast, ease: EASE } },
    animate: { opacity: 1, transition: { duration: DURATIONS.fast, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.18, ease: EASE } },
  },
  panel: {
    hidden: { opacity: 0, scale: DISTANCES.modalScale, y: 6 },
    initial: { opacity: 0, scale: DISTANCES.modalScale, y: 6 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: BASE_TRANSITION,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: BASE_TRANSITION,
    },
    exit: {
      opacity: 0,
      scale: DISTANCES.modalScale,
      y: 4,
      transition: { duration: 0.18, ease: EASE },
    },
  },
};

export const drawerVariants = {
  hidden: { opacity: 0, x: DISTANCES.drawerX },
  initial: { opacity: 0, x: DISTANCES.drawerX },
  visible: {
    opacity: 1,
    x: 0,
    transition: BASE_TRANSITION,
  },
  animate: {
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

export const bottomSheetVariants = {
  hidden: { opacity: 0, y: '100%' },
  initial: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  animate: {
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

export const toastVariants = {
  hidden: { opacity: 0, y: 8 },
  initial: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: FAST_TRANSITION,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: FAST_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.18, ease: EASE },
  },
};

export const bannerVariants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  initial: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: BASE_TRANSITION,
  },
  animate: {
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

export const pageTransitionVariants = {
  hidden: { opacity: 0, y: DISTANCES.entranceY },
  initial: { opacity: 0, y: DISTANCES.entranceY },
  visible: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: BASE_TRANSITION,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: EASE },
  },
};

export const otpBoxVariants = {
  initial: { scale: 0.9, opacity: 0.6 },
  entered: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.15, ease: EASE },
  },
};

export const shakeVariants = {
  idle: { x: 0 },
  shake: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: DURATIONS.slow, ease: EASE },
  },
};

export const popCheckVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  initial: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.25, ease: EASE },
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.25, ease: EASE },
  },
};

export const buttonTapTransition = {
  duration: DURATIONS.instant,
  ease: EASE,
};

export { motion, AnimatePresence, MotionConfig, LazyMotion, domAnimation, m };
