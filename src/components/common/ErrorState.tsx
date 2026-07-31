import { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
  action?: ReactNode;
}

/**
 * Standardized error state. Use after a failed query/mutation
 * to give the user a clear retry path.
 */
export const ErrorState = memo(function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  variant = 'default',
  className,
  action,
}: ErrorStateProps) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const _title = title ?? (isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong');
  const _desc = description ?? (isAr ? 'تعذّر تحميل البيانات. حاول مجدّدًا.' : 'We couldn’t load the data. Please try again.');
  const _retry = retryLabel ?? (isAr ? 'إعادة المحاولة' : 'Retry');

  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm',
          className,
        )}
      >
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{_title}</span>
        </span>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry} className="h-7 px-2 text-destructive hover:text-destructive">
            <RefreshCw className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            {_retry}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn('flex flex-col items-center justify-center py-8 text-center', className)}
      >
        <AlertTriangle className="h-8 w-8 text-destructive/70 mb-2" />
        <p className="text-sm font-semibold text-foreground">{_title}</p>
        {description && <p className="text-xs mt-1 text-muted-foreground max-w-xs">{_desc}</p>}
        {(onRetry || action) && (
          <div className="mt-3 flex items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                {_retry}
              </Button>
            )}
            {action}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-destructive/20 blur-2xl opacity-60" />
        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent border border-destructive/20 flex items-center justify-center shadow-sm">
          <AlertTriangle className="h-9 w-9 text-destructive/80" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-base font-bold text-foreground tracking-tight">{_title}</h3>
      <p className="text-sm mt-2 text-muted-foreground max-w-md leading-relaxed">{_desc}</p>
      {(onRetry || action) && (
        <div className="mt-5 flex items-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {_retry}
            </Button>
          )}
          {action}
        </div>
      )}
    </motion.div>
  );
});
