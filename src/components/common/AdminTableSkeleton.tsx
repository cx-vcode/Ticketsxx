import { memo } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminTableSkeletonProps {
  rows?: number;
  cols?: number;
  showToolbar?: boolean;
  showKpis?: boolean;
  kpiCount?: number;
  className?: string;
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] as const },
});

/**
 * Polished skeleton tuned for Admin pages that follow the
 * "KPIs row → toolbar → table" layout (Users, Departments, etc.).
 */
export const AdminTableSkeleton = memo(function AdminTableSkeleton({
  rows = 8,
  cols = 5,
  showToolbar = true,
  showKpis = true,
  kpiCount = 4,
  className,
}: AdminTableSkeletonProps) {
  return (
    <div className={cn('space-y-5', className)}>
      {showKpis && (
        <div className={cn('grid gap-3', kpiCount === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3')}>
          {Array.from({ length: kpiCount }).map((_, i) => (
            <motion.div
              key={i}
              {...stagger(i)}
              className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-9 w-9 rounded-xl shimmer" />
                <Skeleton className="h-3 w-12 rounded shimmer" />
              </div>
              <Skeleton className="h-7 w-20 shimmer" />
              <Skeleton className="h-3 w-24 shimmer" />
            </motion.div>
          ))}
        </div>
      )}

      {showToolbar && (
        <motion.div {...stagger(kpiCount)} className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-64 rounded-lg shimmer" />
          <Skeleton className="h-9 w-28 rounded-lg shimmer" />
          <Skeleton className="h-9 w-28 rounded-lg shimmer" />
          <div className="ltr:ml-auto rtl:mr-auto flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg shimmer" />
            <Skeleton className="h-9 w-32 rounded-lg shimmer" />
          </div>
        </motion.div>
      )}

      <motion.div {...stagger(kpiCount + 1)} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 px-4 py-3 flex gap-4 border-b border-border/40">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className={cn('h-3.5 shimmer', i === 0 ? 'w-32' : 'flex-1')} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div
            key={i}
            {...stagger(i)}
            className="px-4 py-3.5 border-t border-border/30 flex items-center gap-4"
          >
            <div className="flex items-center gap-3 w-32">
              <Skeleton className="h-8 w-8 rounded-full shimmer" />
              <Skeleton className="h-3.5 w-20 shimmer" />
            </div>
            {Array.from({ length: cols - 1 }).map((__, j) => (
              <Skeleton
                key={j}
                className={cn(
                  'h-3.5 flex-1 shimmer',
                  j === cols - 2 && 'max-w-[120px]',
                )}
              />
            ))}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
});
