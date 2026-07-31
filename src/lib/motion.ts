/**
 * Premium animation primitives — Framer Motion variants & easing.
 * All variants honor prefers-reduced-motion via useReducedMotion hook.
 * Use across pages for consistent, polished motion.
 */
import type { Variants, Transition } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

// Curves
export const ease = {
  spring: [0.34, 1.56, 0.64, 1] as const,
  smooth: [0.16, 1, 0.3, 1] as const,
  snap: [0.4, 0, 0.2, 1] as const,
  out: [0.22, 1, 0.36, 1] as const,
};

// Spring physics for natural feel
export const spring: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 26,
  mass: 0.8,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 22,
  mass: 1,
};

// ─── Static variants (default — full motion) ───────────────────────────────

export const pageContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05, when: 'beforeChildren' },
  },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: ease.smooth },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: ease.smooth } },
};

export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring },
};

export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.08 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: 18, filter: 'blur(3px)' },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: ease.smooth },
  },
};

export const counterPop: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring },
};

export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

// Hover micro-interactions (disabled when reduced motion)
export const hoverLift = {
  y: -3,
  transition: { duration: 0.25, ease: ease.smooth },
};

export const hoverScale = {
  scale: 1.03,
  transition: { duration: 0.2, ease: ease.smooth },
};

export const tapShrink = { scale: 0.97 };

// ─── Reduced-motion variants (only opacity) ────────────────────────────────

const reducedFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const reducedContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0, when: 'beforeChildren' } },
  exit: { opacity: 0 },
};

/**
 * Hook returning the right primitives based on user motion preference.
 * Use this in components instead of importing variants directly when
 * you want to honor prefers-reduced-motion.
 */
export function useMotionPrimitives() {
  const reduce = useReducedMotion();

  return useMemo(() => {
    if (reduce) {
      return {
        pageContainer: reducedContainer,
        fadeUp: reducedFade,
        fadeIn: reducedFade,
        cardEnter: reducedFade,
        listContainer: reducedContainer,
        listItem: reducedFade,
        counterPop: reducedFade,
        gridContainer: reducedContainer,
        hoverLift: {},
        hoverScale: {},
        tapShrink: {},
        reduce: true,
      };
    }
    return {
      pageContainer,
      fadeUp,
      fadeIn,
      cardEnter,
      listContainer,
      listItem,
      counterPop,
      gridContainer,
      hoverLift,
      hoverScale,
      tapShrink,
      reduce: false,
    };
  }, [reduce]);
}
