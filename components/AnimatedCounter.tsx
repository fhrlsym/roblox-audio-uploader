'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate, MotionValue } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

export default function AnimatedCounter({ value, className, duration = 0.6 }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const prevRef = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.23, 1, 0.32, 1],
    });
    prevRef.current = value;
    return controls.stop;
  }, [value, motionValue, duration]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
    return unsubscribe;
  }, [rounded]);

  return <span ref={ref} className={className}>{value}</span>;
}
