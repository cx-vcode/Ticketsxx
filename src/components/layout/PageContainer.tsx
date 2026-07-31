import { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeUp } from '@/lib/motion';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Adds the subtle radial mesh background. Default: true */
  mesh?: boolean;
  /** Constrain width. Default: 'xl' (max-w-screen-2xl). 'full' = no constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const widthMap = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-2xl',
  full: '',
};

/**
 * Standard page body wrapper used inside PageLayout after PageHeader.
 * Provides consistent padding, mesh background, max-width, and entrance motion.
 */
export const PageContainer = memo(function PageContainer({
  children,
  className,
  mesh = true,
  maxWidth = 'xl',
}: PageContainerProps) {
  return (
    <main className="flex-1 overflow-auto bg-muted/20 relative" role="main">
      {mesh && <div className="absolute inset-0 gradient-mesh pointer-events-none opacity-50" />}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className={cn(
          'relative mx-auto p-4 md:p-6 lg:p-8 space-y-6',
          widthMap[maxWidth],
          className,
        )}
      >
        {children}
      </motion.div>
    </main>
  );
});

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Lightweight section header inside a page (e.g. above a table or chart). */
export const SectionHeader = memo(function SectionHeader({
  title,
  description,
  icon,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-bold text-foreground tracking-tight truncate">{title}</h2>
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
});
