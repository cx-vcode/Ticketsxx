import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

/**
 * Animated number counter with spring physics.
 * Counts up from 0 → value when first scrolled into view.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 22, mass: 1 });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      setDisplay(latest.toFixed(decimals));
    });
  }, [spring, decimals]);

  return (
    <span ref={ref} className={className} data-num>
      {prefix}{display}{suffix}
    </span>
  );
}
