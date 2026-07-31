import { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'compact' | 'illustrated';
  className?: string;
}

export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn('flex flex-col items-center justify-center py-8 text-muted-foreground', className)}
      >
        <Icon className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs mt-1 text-center max-w-xs opacity-80">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      {/* Glowing icon halo */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl opacity-60 animate-pulse" />
        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 flex items-center justify-center shadow-sm">
          <Icon className="h-9 w-9 text-primary/80" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm mt-2 text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
});
