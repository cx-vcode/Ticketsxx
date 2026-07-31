import { memo } from 'react';
import { TicketStatus, TicketPriority } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/i18n';

const statusStyles: Record<TicketStatus, string> = {
  new: 'bg-info/15 text-info border-info/30',
  open: 'bg-primary/15 text-primary border-primary/30',
  in_progress: 'bg-warning/15 text-warning border-warning/30',
  waiting_on_customer: 'bg-accent/15 text-accent border-accent/30',
  resolved: 'bg-success/15 text-success border-success/30',
  closed: 'bg-muted text-muted-foreground border-border',
  reopened: 'bg-destructive/15 text-destructive border-destructive/30',
};

const priorityStyles: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-info/15 text-info border-info/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  urgent: 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse',
};

function useStatusLabels(): Record<TicketStatus, string> {
  const { t } = useLanguage();
  return {
    new: t.tickets.new,
    open: t.tickets.open,
    in_progress: t.tickets.inProgress,
    waiting_on_customer: t.tickets.waitingOnCustomer,
    resolved: t.tickets.resolved,
    closed: t.tickets.closed,
    reopened: t.tickets.reopened,
  };
}

function usePriorityLabels(): Record<TicketPriority, string> {
  const { t } = useLanguage();
  return {
    low: t.tickets.priority.low,
    medium: t.tickets.priority.medium,
    high: t.tickets.priority.high,
    urgent: t.tickets.priority.urgent,
  };
}

export const StatusBadge = memo(function StatusBadge({ status }: { status: TicketStatus }) {
  const labels = useStatusLabels();
  return (
    <Badge variant="outline" className={cn('text-xs font-medium transition-colors', statusStyles[status])}>
      {labels[status]}
    </Badge>
  );
});

export const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const labels = usePriorityLabels();
  return (
    <Badge variant="outline" className={cn('text-xs font-medium transition-colors', priorityStyles[priority])}>
      {labels[priority]}
    </Badge>
  );
});

type SLAStatus = 'achieved' | 'breached' | 'on_track' | 'at_risk';

export const SLABadge = memo(function SLABadge({ slaResolutionDueAt, resolvedAt }: { slaResolutionDueAt: string | null; resolvedAt: string | null }) {
  const { t } = useLanguage();

  if (!slaResolutionDueAt) return <span className="text-xs text-muted-foreground">—</span>;

  const dueDate = new Date(slaResolutionDueAt);
  const now = new Date();

  let status: SLAStatus;
  if (resolvedAt) {
    const resolved = new Date(resolvedAt);
    status = resolved <= dueDate ? 'achieved' : 'breached';
  } else {
    const timeLeft = dueDate.getTime() - now.getTime();
    if (timeLeft < 0) {
      status = 'breached';
    } else if (timeLeft < 2 * 60 * 60 * 1000) {
      status = 'at_risk';
    } else {
      status = 'on_track';
    }
  }

  const config: Record<SLAStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
    achieved: { label: t.tickets.sla.achieved, icon: ShieldCheck, className: 'bg-success/15 text-success border-success/30' },
    breached: { label: t.tickets.sla.breached, icon: ShieldAlert, className: 'bg-destructive/15 text-destructive border-destructive/30' },
    on_track: { label: t.tickets.sla.onTrack, icon: Clock, className: 'bg-info/15 text-info border-info/30' },
    at_risk: { label: t.tickets.sla.atRisk, icon: AlertTriangle, className: 'bg-warning/15 text-warning border-warning/30' },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold gap-1 transition-colors', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
});
