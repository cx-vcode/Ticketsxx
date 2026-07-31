import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode, useMemo } from 'react';
import { ease } from '@/lib/motion';

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  const variants = useMemo(() => {
    if (reduce) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      };
    }
    return {
      initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
      animate: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
          duration: 0.5,
          ease: ease.smooth,
          staggerChildren: 0.06,
        },
      },
      exit: {
        opacity: 0,
        y: -10,
        filter: 'blur(4px)',
        transition: { duration: 0.25, ease: [0.4, 0, 1, 1] as const },
      },
    };
  }, [reduce]);

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex-1 flex flex-col min-w-0"
    >
      {children}
    </motion.div>
  );
}
