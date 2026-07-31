import { useQuery } from '@tanstack/react-query';
import { Ticket, fetchTicketApprovals } from '@/lib/api';
import { StatusBadge, PriorityBadge, SLABadge } from '@/components/TicketBadges';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

interface Props {
  tickets: Ticket[];
  onTicketClick: (id: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

function ApprovalCell({ ticketId }: { ticketId: string }) {
  const { lang } = useLanguage();
  const { data: approvals = [] } = useQuery({
    queryKey: ['ticket-approvals', ticketId],
    queryFn: () => fetchTicketApprovals(ticketId),
    enabled: !!ticketId,
    staleTime: 60_000,
  });
  if (approvals.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
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
      className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium', tone)}
      title={`${approved}/${total} ${label}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {approved}/{total}
    </span>
  );
}

export function TicketTableView({ tickets, onTicketClick, page, onPageChange, pageSize = 20 }: Props) {
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'ar' ? ar : enUS;
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
  const paginated = tickets.slice((page - 1) * pageSize, page * pageSize);

  const lblApproval = lang === 'ar' ? 'الاعتماد' : 'Approval';

  return (
    <div className="flex flex-col">
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="ltr:text-left rtl:text-right w-[100px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.code}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.title}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[140px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.client}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[110px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.status}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[100px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.filters.priority}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[110px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SLA</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[110px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lblApproval}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[120px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.system}</TableHead>
              <TableHead className="ltr:text-left rtl:text-right w-[110px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.tickets.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(ticket => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors border-border/40"
                onClick={() => onTicketClick(ticket.id)}
              >
                <TableCell className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
                  {ticket.code || `#${ticket.ticket_number}`}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-sm line-clamp-1">{ticket.title}</span>
                </TableCell>
                <TableCell className="text-sm text-foreground/90">{ticket.requester?.full_name || t.common.unknown}</TableCell>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                <TableCell><SLABadge slaResolutionDueAt={ticket.sla_resolution_due_at} resolvedAt={ticket.resolved_at} /></TableCell>
                <TableCell><ApprovalCell ticketId={ticket.id} /></TableCell>
                <TableCell className="text-xs">
                  {ticket.services?.systems?.name ? (
                    <span className="text-muted-foreground">{ticket.services.systems.name}</span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: dateLocale })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t.common.showing} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, tickets.length)} {t.common.of} {tickets.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-lg text-xs" onClick={() => onPageChange(p)}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
