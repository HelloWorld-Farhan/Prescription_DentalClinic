import React, { useEffect, useRef, useState, memo } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * AnimatedCounter counts smoothly on initial mount and interpolates
 * on updates without jitter, memoized to prevent re-renders when value is identical.
 */
function AnimatedCounterComponent({
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
    // If value hasn't changed since last animation, skip
    if (!isFirstMount.current && prevValue.current === value) {
      return;
    }

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
    const animDuration = duration ?? (isFirstMount.current ? 800 : 400);

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

      // Silky quartic easeOut: 1 - Math.pow(1 - progress, 4)
      const easeProgress = 1 - Math.pow(1 - progress, 4);
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

export default memo(AnimatedCounterComponent);
