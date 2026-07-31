import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Clock, X, AlertTriangle, ShieldCheck, MinusCircle } from 'lucide-react';
import { fetchTicketApprovals, ApprovalStatus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { isPast } from 'date-fns';

interface ApprovalStepperProps {
  ticketId: string;
  variant?: 'horizontal' | 'compact';
  className?: string;
}

const statusIcon: Record<ApprovalStatus, typeof Check> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

/**
 * ApprovalStepper - minimal Linear/Notion style horizontal stepper for approvals
 * Renders nothing if there are no approvals
 */
export const ApprovalStepper = memo(function ApprovalStepper({
  ticketId,
  variant = 'horizontal',
  className,
}: ApprovalStepperProps) {
  const { isRTL, lang } = useLanguage();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['ticket-approvals', ticketId],
    queryFn: () => fetchTicketApprovals(ticketId),
    enabled: !!ticketId,
  });

  const sorted = useMemo(
    () => [...approvals].sort((a, b) => (a.approval_stages?.stage_order || 0) - (b.approval_stages?.stage_order || 0)),
    [approvals],
  );

  if (isLoading || sorted.length === 0) return null;

  const total = sorted.length;
  const approved = sorted.filter(a => a.status === 'approved').length;
  const rejected = sorted.filter(a => a.status === 'rejected').length;
  const pending = sorted.filter(a => a.status === 'pending').length;
  const currentIndex = sorted.findIndex(a => a.status === 'pending');

  const lblCurrent = lang === 'ar' ? 'الحالية' : 'Current';
  const lblComplete = lang === 'ar' ? 'مكتمل' : 'Complete';
  const lblRejected = lang === 'ar' ? 'مرفوض' : 'Rejected';
  const lblPending = lang === 'ar' ? 'قيد الاعتماد' : 'Pending';
  const lblStages = lang === 'ar' ? 'مراحل الاعتماد' : 'Approval stages';
  const lblOverdue = lang === 'ar' ? 'متأخر' : 'Overdue';

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/50 p-3 sm:p-4',
        className,
      )}
      data-testid="approval-stepper"
    >
      {/* Header summary */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{lblStages}</p>
            <p className="text-[10px] text-muted-foreground">
              {approved}/{total} {lblComplete}
              {pending > 0 && ` · ${pending} ${lblPending}`}
              {rejected > 0 && ` · ${rejected} ${lblRejected}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(approved / total) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'h-full rounded-full',
                rejected > 0 ? 'bg-destructive' : 'bg-success',
              )}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground font-medium w-8 text-end">
            {Math.round((approved / total) * 100)}%
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className={cn('flex items-stretch gap-1 overflow-x-auto custom-scrollbar pb-1', isRTL && 'flex-row')}>
        {sorted.map((approval, idx) => {
          const Icon = statusIcon[approval.status];
          const isCurrent = idx === currentIndex;
          const isOverdue =
            approval.status === 'pending' &&
            approval.deadline_at &&
            isPast(new Date(approval.deadline_at));

          const tone =
            approval.status === 'approved'
              ? 'border-success/40 bg-success/5 text-success'
              : approval.status === 'rejected'
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : isOverdue
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : isCurrent
              ? 'border-primary/40 bg-primary/5 text-primary ring-1 ring-primary/20'
              : 'border-border bg-muted/30 text-muted-foreground';

          return (
            <motion.div
              key={approval.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn(
                'flex-1 min-w-[120px] rounded-lg border px-2.5 py-2 transition-all',
                tone,
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn(
                  'w-5 h-5 rounded-md flex items-center justify-center shrink-0',
                  approval.status === 'approved' && 'bg-success/15',
                  approval.status === 'rejected' && 'bg-destructive/15',
                  approval.status === 'pending' && !isOverdue && (isCurrent ? 'bg-primary/15' : 'bg-muted'),
                  isOverdue && 'bg-destructive/15',
                )}>
                  {isOverdue ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : approval.status === 'pending' && !isCurrent ? (
                    <MinusCircle className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
                <span className="text-[10px] font-bold tabular-nums opacity-70">
                  {idx + 1}/{total}
                </span>
                {isCurrent && (
                  <span className="text-[9px] font-semibold ms-auto px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                    {lblCurrent}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-[9px] font-semibold ms-auto px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    {lblOverdue}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground truncate">
                {approval.approval_stages?.stage_name || '—'}
              </p>
              {approval.approver?.full_name && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {approval.approver.full_name}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
