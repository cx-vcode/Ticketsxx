import { memo, forwardRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ticket, fetchTicketApprovals } from '@/lib/api';
import { StatusBadge, PriorityBadge, SLABadge } from '@/components/TicketBadges';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { User, Clock, ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

import { Highlight } from '@/components/common/Highlight';

interface Props {
  ticket: Ticket;
  index: number;
  onClick: () => void;
  highlight?: string;
}

/**
 * Compact "Linear/Notion" style row.
 * Shows code, title, badges and an inline approval indicator.
 */
function TicketApprovalIndicator({ ticketId }: { ticketId: string }) {
  const { lang } = useLanguage();
  const { data: approvals = [] } = useQuery({
    queryKey: ['ticket-approvals', ticketId],
    queryFn: () => fetchTicketApprovals(ticketId),
    enabled: !!ticketId,
    staleTime: 60_000,
  });
  if (approvals.length === 0) return null;
  const total = approvals.length;
  const approved = approvals.filter(a => a.status === 'approved').length;
  const rejected = approvals.filter(a => a.status === 'rejected').length;
  const pending = approvals.filter(a => a.status === 'pending').length;

  const tone = rejected > 0
    ? 'text-destructive border-destructive/30 bg-destructive/5'
    : pending > 0
      ? 'text-warning border-warning/30 bg-warning/5'
      : 'text-success border-success/30 bg-success/5';

  const Icon = rejected > 0 ? AlertTriangle : ShieldCheck;
  const label = lang === 'ar' ? 'اعتماد' : 'Approval';

  return (
    <span
      className={cn(
        'hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium',
        tone,
      )}
      title={`${approved}/${total} ${label}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {approved}/{total}
    </span>
  );
}

interface PropsExt extends Props {
  active?: boolean;
}

export const TicketListItem = memo(forwardRef<HTMLButtonElement, PropsExt>(function TicketListItem({ ticket, onClick, highlight = '', active = false }, ref) {
  const { t, lang, isRTL } = useLanguage();
  const isOverdue = ticket.sla_resolution_due_at && !ticket.resolved_at && new Date(ticket.sla_resolution_due_at) < new Date();
  const dateLocale = lang === 'ar' ? ar : enUS;

  const AssignArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <button
      ref={ref}
      onClick={onClick}
      data-ticket-row
      className={cn(
        'group w-full text-start px-3 sm:px-4 py-3 sm:py-3.5 transition-all duration-200',
        'hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset',
        'relative',
        active && 'bg-primary/[0.06] ring-1 ring-primary/20',
        isOverdue && 'ltr:border-l-2 ltr:border-l-destructive rtl:border-r-2 rtl:border-r-destructive bg-destructive/[0.03]',
      )}
      aria-label={`${t.tickets.code} ${ticket.code || ticket.ticket_number}: ${ticket.title}`}
    >
      {/* Hover accent bar */}
      <span className="absolute ltr:left-0 rtl:right-0 top-1/2 -translate-y-1/2 w-[2px] h-0 bg-primary rounded-full transition-all duration-300 group-hover:h-8" />

      <div className="flex items-start gap-3">
        {/* Status dot with pulse for active */}
        <div className="pt-1.5 shrink-0 relative">
          <span className={cn(
            'block w-2 h-2 rounded-full ring-2 ring-transparent transition-all duration-300',
            ticket.status === 'new' && 'bg-info ring-info/20',
            ticket.status === 'open' && 'bg-primary ring-primary/20',
            ticket.status === 'in_progress' && 'bg-warning ring-warning/20',
            ticket.status === 'waiting_on_customer' && 'bg-muted-foreground',
            ticket.status === 'resolved' && 'bg-success ring-success/20',
            ticket.status === 'closed' && 'bg-muted-foreground/60',
            ticket.status === 'reopened' && 'bg-destructive ring-destructive/20 animate-pulse',
          )} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: code + title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-muted-foreground shrink-0 tabular-nums tracking-tight">
              <Highlight text={ticket.code || `#${ticket.ticket_number}`} query={highlight} />
            </span>
            <h3 className="font-semibold text-[13px] sm:text-sm truncate text-foreground group-hover:text-primary transition-colors duration-200 tracking-tight">
              <Highlight text={ticket.title} query={highlight} />
            </h3>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="hidden sm:inline-flex">
              <SLABadge slaResolutionDueAt={ticket.sla_resolution_due_at} resolvedAt={ticket.resolved_at} />
            </span>
            <TicketApprovalIndicator ticketId={ticket.id} />
            {ticket.services && (
              <span className="hidden lg:inline-flex text-[10px] text-muted-foreground/80 truncate max-w-[200px] font-medium">
                {ticket.services.systems?.name} · {ticket.services.name}
              </span>
            )}
          </div>
        </div>

        {/* Right column: people + time */}
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5 max-w-[150px] truncate font-medium">
            <User className="h-3 w-3 opacity-70" />
            <span className="truncate">{ticket.requester?.full_name || t.common.unknown}</span>
          </span>
          {ticket.agent?.full_name && (
            <span className="flex items-center gap-1.5 text-primary/90 max-w-[150px] truncate font-medium">
              <AssignArrow className="h-3 w-3" />
              <span className="truncate">{ticket.agent.full_name}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 tabular-nums opacity-80">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: dateLocale })}
          </span>
        </div>
      </div>
    </button>
  );
}));
