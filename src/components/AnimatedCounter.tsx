import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * AnimatedCounter counts from 0 to value in 1s (ease-out) on initial mount,
 * and interpolates from previous to new value in 0.5s on updates.
 * Uses tabular-nums to prevent jitter and respects prefers-reduced-motion.
 */
export default function AnimatedCounter({
  value,
  duration,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const isFirstMount = useRef(true);
  const prevValue = useRef(0);

  useEffect(() => {
    // Check for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValue.current = value;
      isFirstMount.current = false;
      return;
    }

    const startValue = isFirstMount.current ? 0 : prevValue.current;
    const endValue = value;
    const animDuration = duration ?? (isFirstMount.current ? 1000 : 500);

    if (startValue === endValue) {
      setDisplayValue(endValue);
      isFirstMount.current = false;
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animDuration, 1);

      // Deceleration easeOut: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        prevValue.current = endValue;
        isFirstMount.current = false;
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}
