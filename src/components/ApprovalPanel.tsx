import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTicketApprovals,
  updateTicketApproval,
  delegateApproval,
  fetchAgents,
  ApprovalStatus,
  approvalStatusLabels,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check,
  X,
  Clock,
  ShieldCheck,
  Forward,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MinusCircle,
  Calendar,
  User as UserIcon,
  StickyNote,
} from 'lucide-react';
import { format, isPast, formatDistanceToNow, differenceInHours } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface Props {
  ticketId: string;
  ticketStatus: string;
}

const statusIcon: Record<ApprovalStatus, typeof Check> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

const statusTone: Record<
  ApprovalStatus,
  { dot: string; chip: string; ring: string; iconBg: string; iconColor: string }
> = {
  approved: {
    dot: 'bg-success',
    chip: 'bg-success/15 text-success border-success/30',
    ring: 'border-success/40 bg-success/[0.04]',
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
  },
  rejected: {
    dot: 'bg-destructive',
    chip: 'bg-destructive/15 text-destructive border-destructive/30',
    ring: 'border-destructive/40 bg-destructive/[0.04]',
    iconBg: 'bg-destructive/15',
    iconColor: 'text-destructive',
  },
  pending: {
    dot: 'bg-warning',
    chip: 'bg-warning/15 text-warning border-warning/30',
    ring: 'border-border bg-muted/30',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
};

export function ApprovalPanel({ ticketId, ticketStatus: _ticketStatus }: Props) {
  const { user, role } = useAuth();
  const { lang, isRTL } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const dateLocale = lang === 'ar' ? ar : enUS;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [delegateMode, setDelegateMode] = useState(false);
  const [delegateTo, setDelegateTo] = useState('');

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['ticket-approvals', ticketId],
    queryFn: () => fetchTicketApprovals(ticketId),
    enabled: !!ticketId,
  });

  const sorted = useMemo(
    () =>
      [...approvals].sort(
        (a, b) =>
          (a.approval_stages?.stage_order || 0) -
          (b.approval_stages?.stage_order || 0),
      ),
    [approvals],
  );

  const currentPending = useMemo(
    () => sorted.find((a) => a.status === 'pending'),
    [sorted],
  );

  // Auto-select current pending when data loads
  useEffect(() => {
    if (!selectedId && sorted.length > 0) {
      setSelectedId(currentPending?.id ?? sorted[sorted.length - 1].id);
    }
  }, [sorted, currentPending, selectedId]);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled: delegateMode,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApprovalStatus }) =>
      updateTicketApproval(id, {
        status,
        approver_id: user!.id,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-approvals', ticketId] });
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setNotes('');
      toast({
        title: lang === 'ar' ? 'تم تحديث الاعتماد' : 'Approval updated',
      });
    },
    onError: (err: any) => {
      toast({
        title: lang === 'ar' ? 'خطأ' : 'Error',
        description: sanitizeError(err),
        variant: 'destructive',
      });
    },
  });

  const delegateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      delegateApproval(id, delegateTo, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-approvals', ticketId] });
      setDelegateMode(false);
      setDelegateTo('');
      toast({
        title: lang === 'ar' ? 'تم تفويض الاعتماد' : 'Approval delegated',
      });
    },
    onError: (err: any) => {
      toast({
        title: lang === 'ar' ? 'خطأ' : 'Error',
        description: sanitizeError(err),
        variant: 'destructive',
      });
    },
  });

  if (isLoading || sorted.length === 0) return null;

  const total = sorted.length;
  const approved = sorted.filter((a) => a.status === 'approved').length;
  const rejected = sorted.filter((a) => a.status === 'rejected').length;
  const pending = sorted.filter((a) => a.status === 'pending').length;
  const progressPct = Math.round((approved / total) * 100);
  const overall: ApprovalStatus =
    rejected > 0 ? 'rejected' : pending === 0 ? 'approved' : 'pending';

  const selected = sorted.find((a) => a.id === selectedId) ?? sorted[0];
  const selectedIdx = sorted.findIndex((a) => a.id === selected.id);

  const isAgentOrAdmin = role === 'agent' || role === 'admin';
  const canActOnSelected =
    isAgentOrAdmin && selected.status === 'pending' && selected.id === currentPending?.id;

  const t = {
    title: lang === 'ar' ? 'مراحل الاعتماد' : 'Approval flow',
    complete: lang === 'ar' ? 'مكتمل' : 'complete',
    pending: lang === 'ar' ? 'في الانتظار' : 'pending',
    rejected: lang === 'ar' ? 'مرفوض' : 'rejected',
    current: lang === 'ar' ? 'الحالية' : 'Current',
    overdue: lang === 'ar' ? 'متأخر' : 'Overdue',
    notesPh: lang === 'ar' ? 'أضف ملاحظة (اختياري)…' : 'Add a note (optional)…',
    approve: lang === 'ar' ? 'اعتماد' : 'Approve',
    reject: lang === 'ar' ? 'رفض' : 'Reject',
    delegate: lang === 'ar' ? 'تفويض' : 'Delegate',
    delegateTo: lang === 'ar' ? 'اختر الشخص المفوّض إليه…' : 'Choose delegate…',
    confirmDelegate: lang === 'ar' ? 'تأكيد التفويض' : 'Confirm delegate',
    cancel: lang === 'ar' ? 'إلغاء' : 'Cancel',
    deadline: lang === 'ar' ? 'الموعد النهائي' : 'Deadline',
    decidedBy: lang === 'ar' ? 'القرار بواسطة' : 'Decided by',
    decidedAt: lang === 'ar' ? 'تاريخ القرار' : 'Decided at',
    delegated: lang === 'ar' ? 'مُفوَّض إلى' : 'Delegated to',
    waiting: lang === 'ar' ? 'بانتظار قرار' : 'Awaiting decision',
    parallel: lang === 'ar' ? 'موازي' : 'Parallel',
    sequential: lang === 'ar' ? 'تسلسلي' : 'Sequential',
    notYourTurn:
      lang === 'ar'
        ? 'هذه المرحلة ليست النشطة حالياً'
        : 'This stage is not currently active',
    youCantAct:
      lang === 'ar'
        ? 'لا تملك صلاحية اتخاذ قرار في هذه المرحلة'
        : "You don't have permission to act here",
    of: lang === 'ar' ? 'من' : 'of',
  };

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  const goPrev = () => selectedIdx > 0 && setSelectedId(sorted[selectedIdx - 1].id);
  const goNext = () =>
    selectedIdx < sorted.length - 1 && setSelectedId(sorted[selectedIdx + 1].id);

  const overallTone = statusTone[overall];

  return (
    <Card
      className="overflow-hidden rounded-2xl border-border/60 shadow-sm"
      data-testid="approval-panel"
    >
      <CardContent className="p-0">
        {/* HEADER */}
        <div className="relative px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                  overallTone.iconBg,
                )}
              >
                <ShieldCheck className={cn('h-5 w-5', overallTone.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">{t.title}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {approved}/{total} {t.complete}
                  {pending > 0 && ` · ${pending} ${t.pending}`}
                  {rejected > 0 && ` · ${rejected} ${t.rejected}`}
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn('text-[11px] gap-1 border', overallTone.chip)}
            >
              {overall === 'approved' && <Check className="h-3 w-3" />}
              {overall === 'rejected' && <X className="h-3 w-3" />}
              {overall === 'pending' && <Clock className="h-3 w-3" />}
              {approvalStatusLabels[overall]}
            </Badge>
          </div>

          {/* PROGRESS BAR */}
          <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'h-full rounded-full',
                rejected > 0 ? 'bg-destructive' : 'bg-success',
              )}
            />
          </div>
        </div>

        {/* STEPPER */}
        <div className="px-2 sm:px-3 pb-3">
          <LayoutGroup id={`approval-stepper-${ticketId}`}>
            <div
              className="flex items-stretch gap-1.5 overflow-x-auto custom-scrollbar pb-1 px-1"
              role="tablist"
            >
              {sorted.map((a, idx) => {
                const Icon = statusIcon[a.status];
                const isActive = a.id === selected.id;
                const isCurrentPending = a.id === currentPending?.id;
                const overdue =
                  a.status === 'pending' &&
                  a.deadline_at &&
                  isPast(new Date(a.deadline_at));
                const tone = overdue
                  ? statusTone.rejected
                  : statusTone[a.status];

                return (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setSelectedId(a.id);
                      setDelegateMode(false);
                    }}
                    className={cn(
                      'group relative flex-1 min-w-[110px] sm:min-w-[130px] text-start rounded-xl border px-2.5 py-2 transition-all duration-200',
                      'hover:border-primary/40 hover:bg-primary/[0.03]',
                      tone.ring,
                      isActive && 'ring-2 ring-primary/40 border-primary/40',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`approval-active-${ticketId}`}
                        className="absolute inset-0 rounded-xl bg-primary/[0.04] pointer-events-none"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <div className="relative flex items-center gap-1.5 mb-1">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center shrink-0',
                          tone.iconBg,
                        )}
                      >
                        {overdue ? (
                          <AlertTriangle className={cn('h-3 w-3', tone.iconColor)} />
                        ) : a.status === 'pending' && !isCurrentPending ? (
                          <MinusCircle className={cn('h-3 w-3', tone.iconColor)} />
                        ) : (
                          <Icon className={cn('h-3 w-3', tone.iconColor)} />
                        )}
                      </div>
                      <span className="text-[10px] font-bold tabular-nums opacity-60">
                        {idx + 1}
                      </span>
                      {isCurrentPending && (
                        <motion.span
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="ms-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                        >
                          {t.current}
                        </motion.span>
                      )}
                      {overdue && !isCurrentPending && (
                        <span className="ms-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                          {t.overdue}
                        </span>
                      )}
                    </div>
                    <p className="relative text-xs font-semibold text-foreground truncate">
                      {a.approval_stages?.stage_name || '—'}
                    </p>
                    {a.approver?.full_name && (
                      <p className="relative text-[10px] text-muted-foreground truncate mt-0.5">
                        {a.approver.full_name}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        {/* SELECTED DETAIL */}
        <div className="border-t border-border/60 bg-muted/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="px-4 sm:px-5 py-4 space-y-3"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold tracking-tight">
                      {selected.approval_stages?.stage_name || '—'}
                    </h4>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] border', statusTone[selected.status].chip)}
                    >
                      {approvalStatusLabels[selected.status]}
                    </Badge>
                    {selected.approval_stages?.stage_type && (
                      <span className="text-[10px] text-muted-foreground">
                        ·{' '}
                        {selected.approval_stages.stage_type === 'parallel'
                          ? t.parallel
                          : t.sequential}
                      </span>
                    )}
                    {selected.is_escalated && (
                      <Badge variant="destructive" className="text-[10px] gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {lang === 'ar' ? 'مُصعَّد' : 'Escalated'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-1">
                    {selectedIdx + 1} {t.of} {total}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={selectedIdx === 0}
                    onClick={goPrev}
                    aria-label="Previous"
                  >
                    <PrevIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={selectedIdx === sorted.length - 1}
                    onClick={goNext}
                    aria-label="Next"
                  >
                    <NextIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selected.deadline_at && (
                  <DeadlineRow
                    iso={selected.deadline_at}
                    isPending={selected.status === 'pending'}
                    locale={dateLocale}
                    label={t.deadline}
                  />
                )}
                {selected.approver?.full_name && (
                  <MetaRow
                    icon={UserIcon}
                    label={t.decidedBy}
                    value={selected.approver.full_name}
                  />
                )}
                {selected.decided_at && (
                  <MetaRow
                    icon={Calendar}
                    label={t.decidedAt}
                    value={format(new Date(selected.decided_at), 'd MMM yyyy, HH:mm', {
                      locale: dateLocale,
                    })}
                  />
                )}
                {selected.delegated_profile?.full_name && (
                  <MetaRow
                    icon={Forward}
                    label={t.delegated}
                    value={selected.delegated_profile.full_name}
                  />
                )}
              </div>

              {selected.notes && (
                <div className="rounded-lg bg-card border border-border/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                    <StickyNote className="h-3 w-3" />
                    {lang === 'ar' ? 'ملاحظات' : 'Notes'}
                  </p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {/* Actions */}
              {selected.status === 'pending' && !canActOnSelected && (
                <p className="text-[11px] text-muted-foreground italic">
                  {selected.id !== currentPending?.id ? t.notYourTurn : t.youCantAct}
                </p>
              )}

              <AnimatePresence mode="wait">
                {canActOnSelected && (
                  <motion.div
                    key={delegateMode ? 'delegate' : 'decide'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2 pt-1"
                  >
                    {!delegateMode ? (
                      <>
                        <Textarea
                          placeholder={t.notesPh}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[64px] text-xs rounded-xl resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground rounded-xl"
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({
                                id: selected.id,
                                status: 'approved',
                              })
                            }
                          >
                            {decideMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {t.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5 rounded-xl"
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({
                                id: selected.id,
                                status: 'rejected',
                              })
                            }
                          >
                            {decideMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            {t.reject}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 rounded-xl"
                            onClick={() => setDelegateMode(true)}
                          >
                            <Forward className="h-3.5 w-3.5" />
                            {t.delegate}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Select value={delegateTo} onValueChange={setDelegateTo}>
                          <SelectTrigger className="rounded-xl text-xs">
                            <SelectValue placeholder={t.delegateTo} />
                          </SelectTrigger>
                          <SelectContent>
                            {agents
                              .filter((a) => a.user_id !== user?.id)
                              .map((a) => (
                                <SelectItem key={a.user_id} value={a.user_id}>
                                  {a.profiles?.full_name} ({a.profiles?.email})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 rounded-xl"
                            disabled={!delegateTo || delegateMutation.isPending}
                            onClick={() => delegateMutation.mutate({ id: selected.id })}
                          >
                            {delegateMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Forward className="h-3.5 w-3.5" />
                            )}
                            {t.confirmDelegate}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl"
                            onClick={() => {
                              setDelegateMode(false);
                              setDelegateTo('');
                            }}
                          >
                            {t.cancel}
                          </Button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Check;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-card/60 border border-border/40 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function DeadlineRow({
  iso,
  isPending,
  locale,
  label,
}: {
  iso: string;
  isPending: boolean;
  locale: typeof ar;
  label: string;
}) {
  const date = new Date(iso);
  const overdue = isPending && isPast(date);
  const hoursLeft = isPending ? differenceInHours(date, new Date()) : null;
  const warn = !overdue && hoursLeft !== null && hoursLeft >= 0 && hoursLeft <= 24;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 py-2',
        overdue
          ? 'bg-destructive/5 border-destructive/30'
          : warn
            ? 'bg-warning/5 border-warning/30'
            : 'bg-card/60 border-border/40',
      )}
    >
      <Clock
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          overdue
            ? 'text-destructive'
            : warn
              ? 'text-warning'
              : 'text-muted-foreground',
        )}
      />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-xs font-medium truncate">
          {format(date, 'd MMM yyyy, HH:mm', { locale })}
          {isPending && (
            <span
              className={cn(
                'ms-2 text-[10px]',
                overdue
                  ? 'text-destructive font-semibold'
                  : warn
                    ? 'text-warning font-semibold'
                    : 'text-muted-foreground',
              )}
            >
              · {formatDistanceToNow(date, { addSuffix: true, locale })}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
