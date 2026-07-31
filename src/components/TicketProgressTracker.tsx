import { motion } from 'framer-motion';
import { Check, Circle, Clock, MessageSquare, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';
import { differenceInMinutes, differenceInHours, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';

interface TicketProgressTrackerProps {
  status: string;
  className?: string;
  compact?: boolean;
  slaResolutionDueAt?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
}

export function TicketProgressTracker({ status, className, compact = false, slaResolutionDueAt, createdAt, resolvedAt }: TicketProgressTrackerProps) {
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'ar' ? ar : enUS;

  const TICKET_STAGES = [
    { key: 'new', label: lang === 'ar' ? 'جديدة' : 'New', icon: Circle, description: lang === 'ar' ? 'تم استلام التذكرة' : 'Ticket received' },
    { key: 'open', label: lang === 'ar' ? 'مفتوحة' : 'Open', icon: Clock, description: lang === 'ar' ? 'قيد المراجعة' : 'Under review' },
    { key: 'in_progress', label: lang === 'ar' ? 'قيد المعالجة' : 'In Progress', icon: MessageSquare, description: lang === 'ar' ? 'يعمل عليها فريق الدعم' : 'Support team working on it' },
    { key: 'resolved', label: lang === 'ar' ? 'محلولة' : 'Resolved', icon: CheckCircle2, description: lang === 'ar' ? 'تم حل المشكلة' : 'Issue resolved' },
    { key: 'closed', label: lang === 'ar' ? 'مغلقة' : 'Closed', icon: Check, description: lang === 'ar' ? 'تم إغلاق التذكرة' : 'Ticket closed' },
  ];

  const SPECIAL_STATUSES: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
    waiting_on_customer: { label: lang === 'ar' ? 'بانتظار ردك' : 'Waiting for your reply', icon: AlertTriangle, color: 'text-orange-500' },
    reopened: { label: lang === 'ar' ? 'أعيد فتحها' : 'Reopened', icon: RotateCcw, color: 'text-rose-500' },
  };

  const specialStatus = SPECIAL_STATUSES[status];
  
  const getStageIndex = (s: string): number => {
    const idx = TICKET_STAGES.findIndex(st => st.key === s);
    if (idx !== -1) return idx;
    if (s === 'waiting_on_customer') return 2;
    if (s === 'reopened') return 1;
    return 0;
  };

  const currentIndex = getStageIndex(status);

  // SLA countdown
  const getSlaInfo = () => {
    if (!slaResolutionDueAt) return null;
    const now = new Date();
    const due = new Date(slaResolutionDueAt);
    const isResolved = ['resolved', 'closed'].includes(status);
    
    if (isResolved && resolvedAt) {
      const resolved = new Date(resolvedAt);
      const wasOnTime = resolved <= due;
      return {
        text: wasOnTime 
          ? (lang === 'ar' ? '✅ تم الحل في الوقت' : '✅ Resolved on time')
          : (lang === 'ar' ? '⚠️ تم الحل بعد الموعد' : '⚠️ Resolved late'),
        color: wasOnTime ? 'text-success' : 'text-warning',
        bgColor: wasOnTime ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20',
      };
    }

    const minutesLeft = differenceInMinutes(due, now);
    const hoursLeft = differenceInHours(due, now);
    
    if (minutesLeft < 0) {
      return {
        text: lang === 'ar' ? `⏰ متأخر ${formatDistanceToNow(due, { locale: dateLocale })}` : `⏰ Overdue by ${formatDistanceToNow(due, { locale: dateLocale })}`,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10 border-destructive/20',
      };
    }
    
    if (hoursLeft < 2) {
      return {
        text: lang === 'ar' ? `⚡ متبقي ${minutesLeft} دقيقة` : `⚡ ${minutesLeft} minutes left`,
        color: 'text-warning',
        bgColor: 'bg-warning/10 border-warning/20',
      };
    }

    return {
      text: lang === 'ar' ? `⏳ متبقي ${hoursLeft} ساعة` : `⏳ ${hoursLeft} hours left`,
      color: 'text-info',
      bgColor: 'bg-info/10 border-info/20',
    };
  };

  const slaInfo = getSlaInfo();

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {TICKET_STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={stage.key} className="flex items-center gap-1">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  isCompleted && "bg-emerald-500",
                  isCurrent && "bg-primary ring-2 ring-primary/30",
                  !isCompleted && !isCurrent && "bg-muted-foreground/20"
                )}
              />
              {i < TICKET_STAGES.length - 1 && (
                <div className={cn(
                  "h-0.5 w-4 rounded transition-all",
                  isCompleted ? "bg-emerald-500" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          );
        })}
        {slaInfo && (
          <span className={cn("text-[9px] font-medium ltr:ml-2 rtl:mr-2", slaInfo.color)}>
            {slaInfo.text}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Special status + SLA alerts */}
      <div className="flex flex-wrap gap-2">
        {specialStatus && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2"
          >
            <specialStatus.icon className={cn("h-4 w-4 shrink-0", specialStatus.color)} />
            <span className={cn("text-sm font-medium", specialStatus.color)}>{specialStatus.label}</span>
          </motion.div>
        )}
        {slaInfo && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", slaInfo.bgColor)}
          >
            <Timer className={cn("h-4 w-4 shrink-0", slaInfo.color)} />
            <span className={cn("text-sm font-medium", slaInfo.color)}>{slaInfo.text}</span>
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {TICKET_STAGES.map((stage, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const StageIcon = stage.icon;

            return (
              <div key={stage.key} className="flex flex-col items-center relative z-10">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-full border-2 transition-all",
                    isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                    !isCompleted && !isCurrent && "bg-muted border-muted-foreground/20 text-muted-foreground/40"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StageIcon className="h-4 w-4" />
                  )}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 + 0.1 }}
                  className="mt-2 text-center"
                >
                  <p className={cn(
                    "text-[11px] font-medium",
                    isCurrent ? "text-primary" : isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                  )}>
                    {stage.label}
                  </p>
                  {isCurrent && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">{stage.description}</p>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Connecting line */}
        <div className="absolute top-[18px] right-[18px] left-[18px] h-0.5 bg-muted-foreground/10 -z-0" />
        <motion.div
          className="absolute top-[18px] right-[18px] h-0.5 bg-emerald-500 -z-0"
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex / (TICKET_STAGES.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
