import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { updateTicketApproval, bulkUpdateApprovals, approvalStatusLabels, ApprovalStatus } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { Clock, Check, X, User, GripVertical, AlertTriangle, Forward, Search, Filter, BarChart3, TrendingUp, ShieldCheck, CheckSquare, Square, Loader2 } from 'lucide-react';
import { formatDistanceToNow, isPast, differenceInHours } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/i18n';

type ApprovalCol = 'pending' | 'approved' | 'rejected';

const columnConfig: Record<ApprovalCol, { label: string; labelAr: string; borderColor: string; icon: typeof Clock; bgColor: string }> = {
  pending: { label: 'Pending', labelAr: 'في الانتظار', borderColor: 'border-t-warning', icon: Clock, bgColor: 'bg-warning/10' },
  approved: { label: 'Approved', labelAr: 'معتمد', borderColor: 'border-t-success', icon: Check, bgColor: 'bg-success/10' },
  rejected: { label: 'Rejected', labelAr: 'مرفوض', borderColor: 'border-t-destructive', icon: X, bgColor: 'bg-destructive/10' },
};

interface ApprovalCard {
  id: string;
  ticket_id: string;
  status: ApprovalStatus;
  deadline_at: string | null;
  is_escalated: boolean;
  delegated_to: string | null;
  created_at: string;
  decided_at: string | null;
  approval_stages: { stage_name: string; stage_order: number } | null;
  ticket: { ticket_number: number; title: string; code: string | null; priority: string } | null;
  approver: { full_name: string } | null;
  delegated_profile: { full_name: string } | null;
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive',
  high: 'bg-orange-500/10 text-orange-600',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

export function ApprovalKanban() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ApprovalCol | null>(null);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStage, setFilterStage] = useState('all');

  // Bulk-selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approved' | 'rejected' | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approval-kanban'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_approvals')
        .select('id, ticket_id, status, deadline_at, is_escalated, delegated_to, created_at, decided_at, approval_stages(stage_name, stage_order), ticket:tickets!ticket_approvals_ticket_id_fkey(ticket_number, title, code, priority), approver:profiles!ticket_approvals_approver_id_fkey(full_name), delegated_profile:profiles!ticket_approvals_delegated_to_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown) as ApprovalCard[];
    },
  });

  // KPI stats
  const kpiStats = useMemo(() => {
    const pending = approvals.filter(a => a.status === 'pending').length;
    const approved = approvals.filter(a => a.status === 'approved').length;
    const rejected = approvals.filter(a => a.status === 'rejected').length;
    const overdue = approvals.filter(a => a.status === 'pending' && a.deadline_at && isPast(new Date(a.deadline_at))).length;
    const escalated = approvals.filter(a => a.is_escalated).length;
    const decided = approvals.filter(a => a.decided_at && a.created_at);
    let avgHours: number | null = null;
    if (decided.length > 0) {
      const total = decided.reduce((s, a) => s + Math.abs(differenceInHours(new Date(a.decided_at!), new Date(a.created_at))), 0);
      avgHours = Math.round(total / decided.length * 10) / 10;
    }
    return { pending, approved, rejected, overdue, escalated, avgHours, total: approvals.length };
  }, [approvals]);

  // Get unique stages for filter
  const stages = useMemo(() => {
    const s = new Set<string>();
    approvals.forEach(a => { if (a.approval_stages?.stage_name) s.add(a.approval_stages.stage_name); });
    return Array.from(s);
  }, [approvals]);

  // Filtered approvals
  const filtered = useMemo(() => {
    let result = approvals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.ticket?.title?.toLowerCase().includes(q) ||
        a.ticket?.code?.toLowerCase().includes(q) ||
        a.ticket?.ticket_number?.toString().includes(q) ||
        a.approver?.full_name?.toLowerCase().includes(q)
      );
    }
    if (filterPriority !== 'all') result = result.filter(a => a.ticket?.priority === filterPriority);
    if (filterStage !== 'all') result = result.filter(a => a.approval_stages?.stage_name === filterStage);
    return result;
  }, [approvals, search, filterPriority, filterStage]);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApprovalStatus }) =>
      updateTicketApproval(id, { status, approver_id: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: isAr ? 'تم تحديث الاعتماد' : 'Approval updated' });
    },
    onError: (err: any) => {
      toast({ title: isAr ? 'خطأ' : 'Error', description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status, notes }: { ids: string[]; status: 'approved' | 'rejected'; notes?: string }) =>
      bulkUpdateApprovals(ids, status, user!.id, notes),
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ['approval-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: isAr ? 'تم تنفيذ الإجراء الجماعي' : 'Bulk action completed',
        description: isAr ? `تم تحديث ${updated} اعتماد` : `${updated} approvals updated`,
      });
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkAction(null);
      setBulkNotes('');
    },
    onError: (err: any) => {
      toast({ title: isAr ? 'فشل الإجراء الجماعي' : 'Bulk action failed', description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const pendingSelectedCount = useMemo(
    () => approvals.filter(a => selectedIds.has(a.id) && a.status === 'pending').length,
    [approvals, selectedIds],
  );

  const toggleSelect = (id: string, status: ApprovalStatus) => {
    if (status !== 'pending') return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPendingFiltered = () => {
    setSelectedIds(new Set(filtered.filter(a => a.status === 'pending').map(a => a.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const columns: ApprovalCol[] = ['pending', 'approved', 'rejected'];

  const handleDragStart = (e: React.DragEvent, approvalId: string) => {
    e.dataTransfer.setData('approvalId', approvalId);
    setDraggedId(approvalId);
  };

  const handleDrop = (e: React.DragEvent, newStatus: ApprovalCol) => {
    e.preventDefault();
    const approvalId = e.dataTransfer.getData('approvalId');
    setDraggedId(null);
    setDragOverCol(null);
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval || approval.status === newStatus || approval.status !== 'pending') {
      if (approval?.status !== 'pending') {
        toast({ title: isAr ? 'لا يمكن تغيير حالة اعتماد تم البت فيه' : 'Cannot change decided approval', variant: 'destructive' });
      }
      return;
    }
    if (newStatus === 'pending') return;
    mutation.mutate({ id: approvalId, status: newStatus });
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Clock className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const kpiCards = [
    { label: isAr ? 'إجمالي الاعتمادات' : 'Total', value: kpiStats.total, icon: ShieldCheck, color: 'text-primary bg-primary/10' },
    { label: isAr ? 'معلّقة' : 'Pending', value: kpiStats.pending, icon: Clock, color: 'text-warning bg-warning/10' },
    { label: isAr ? 'متأخرة' : 'Overdue', value: kpiStats.overdue, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
    { label: isAr ? 'مُصعّدة' : 'Escalated', value: kpiStats.escalated, icon: TrendingUp, color: 'text-orange-600 bg-orange-500/10' },
    { label: isAr ? 'متوسط القرار' : 'Avg Decision', value: kpiStats.avgHours !== null ? `${kpiStats.avgHours}h` : '—', icon: BarChart3, color: 'text-emerald-600 bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiCards.map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="rounded-2xl border-border/50">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                  <kpi.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالعنوان أو الكود...' : 'Search by title or code...'}
            className="ps-9 h-9 rounded-xl text-xs"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-9 rounded-xl text-xs">
            <SelectValue placeholder={isAr ? 'الأولوية' : 'Priority'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? 'كل الأولويات' : 'All Priorities'}</SelectItem>
            <SelectItem value="urgent">{isAr ? 'عاجلة' : 'Urgent'}</SelectItem>
            <SelectItem value="high">{isAr ? 'عالية' : 'High'}</SelectItem>
            <SelectItem value="medium">{isAr ? 'متوسطة' : 'Medium'}</SelectItem>
            <SelectItem value="low">{isAr ? 'منخفضة' : 'Low'}</SelectItem>
          </SelectContent>
        </Select>
        {stages.length > 0 && (
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-44 h-9 rounded-xl text-xs">
              <SelectValue placeholder={isAr ? 'المرحلة' : 'Stage'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'كل المراحل' : 'All Stages'}</SelectItem>
              {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Badge variant="secondary" className="text-[10px] px-2 py-1 rounded-full">
          {isAr ? 'نتائج' : 'Results'}: {filtered.length}
        </Badge>
        <div className="ms-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={selectMode ? 'default' : 'outline'}
            className="h-9 rounded-xl text-xs gap-1.5"
            onClick={() => {
              setSelectMode(v => !v);
              if (selectMode) clearSelection();
            }}
          >
            {selectMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {isAr ? 'تحديد متعدد' : 'Multi-select'}
          </Button>
          {selectMode && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-xl text-xs"
              onClick={selectAllPendingFiltered}
            >
              {isAr ? 'تحديد كل المعلّقة' : 'Select all pending'}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectMode && pendingSelectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-xs">{pendingSelectedCount}</Badge>
              <span className="text-xs font-medium text-foreground">
                {isAr ? 'اعتماد محدد' : 'selected'}
              </span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
                {isAr ? 'إلغاء التحديد' : 'Clear'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 h-8 bg-success hover:bg-success/90 text-success-foreground"
                disabled={bulkMutation.isPending}
                onClick={() => setBulkAction('approved')}
              >
                <Check className="h-3.5 w-3.5" />
                {isAr ? 'اعتماد الكل' : 'Approve all'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5 h-8"
                disabled={bulkMutation.isPending}
                onClick={() => setBulkAction('rejected')}
              >
                <X className="h-3.5 w-3.5" />
                {isAr ? 'رفض الكل' : 'Reject all'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk confirm dialog */}
      <Dialog open={bulkAction !== null} onOpenChange={(open) => { if (!open) { setBulkAction(null); setBulkNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approved'
                ? (isAr ? 'تأكيد الاعتماد الجماعي' : 'Confirm bulk approval')
                : (isAr ? 'تأكيد الرفض الجماعي' : 'Confirm bulk rejection')}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? `سيتم تطبيق الإجراء على ${pendingSelectedCount} اعتماد معلّق فقط. لا يمكن التراجع.`
                : `Action will apply to ${pendingSelectedCount} pending approvals only. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={isAr ? 'ملاحظات (اختياري)...' : 'Notes (optional)...'}
            value={bulkNotes}
            onChange={e => setBulkNotes(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBulkAction(null); setBulkNotes(''); }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant={bulkAction === 'rejected' ? 'destructive' : 'default'}
              disabled={bulkMutation.isPending}
              onClick={() => bulkAction && bulkMutation.mutate({
                ids: Array.from(selectedIds),
                status: bulkAction,
                notes: bulkNotes.trim() || undefined,
              })}
            >
              {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
              {isAr ? 'تأكيد' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kanban Columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {columns.map(col => {
          const config = columnConfig[col];
          const colApprovals = filtered.filter(a => a.status === col);
          const ColIcon = config.icon;

          return (
            <div
              key={col}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col)}
              className={`flex-1 min-w-[280px] rounded-xl border-t-4 ${config.borderColor} bg-card border border-border/50 flex flex-col transition-all ${
                dragOverCol === col ? 'ring-2 ring-primary/40 bg-primary/5' : ''
              }`}
            >
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${config.bgColor}`}>
                      <ColIcon className="h-3.5 w-3.5" />
                    </div>
                    {isAr ? config.labelAr : config.label}
                  </h3>
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {colApprovals.length}
                  </span>
                </div>
              </div>

              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                {colApprovals.map(approval => {
                  const isOverdue = approval.deadline_at && approval.status === 'pending' && isPast(new Date(approval.deadline_at));
                  const priority = approval.ticket?.priority || 'medium';
                  return (
                    <motion.div
                      key={approval.id}
                      draggable={!selectMode && approval.status === 'pending'}
                      onDragStart={(e: any) => handleDragStart(e, approval.id)}
                      onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                      whileHover={{ y: -2 }}
                      onClick={() => {
                        if (selectMode) {
                          toggleSelect(approval.id, approval.status);
                        } else if (approval.ticket_id) {
                          navigate(`/tickets/${approval.ticket_id}`);
                        }
                      }}
                      className={`p-3 rounded-lg border border-border/50 bg-background cursor-pointer hover:shadow-card-hover transition-all ${
                        draggedId === approval.id ? 'opacity-40' : ''
                      } ${isOverdue ? 'border-s-2 border-s-destructive' : ''} ${
                        selectedIds.has(approval.id) ? 'ring-2 ring-primary border-primary/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {selectMode && (
                            <Checkbox
                              checked={selectedIds.has(approval.id)}
                              disabled={approval.status !== 'pending'}
                              onCheckedChange={() => toggleSelect(approval.id, approval.status)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5"
                            />
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {approval.ticket?.code || `#${approval.ticket?.ticket_number}`}
                          </span>
                          <Badge className={`text-[8px] px-1 py-0 border-0 ${priorityColors[priority]}`}>
                            {priority}
                          </Badge>
                        </div>
                        {!selectMode && approval.status === 'pending' && <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab flex-shrink-0" />}
                      </div>

                      <h4 className="text-xs font-semibold text-foreground line-clamp-2 mb-1.5">
                        {approval.ticket?.title}
                      </h4>

                      <p className="text-[10px] text-muted-foreground mb-2">
                        {isAr ? 'المرحلة' : 'Stage'}: {approval.approval_stages?.stage_name}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[9px] gap-0.5 px-1.5 py-0">
                            <AlertTriangle className="h-2 w-2" />
                            {isAr ? 'متأخر' : 'Overdue'}
                          </Badge>
                        )}
                        {approval.is_escalated && (
                          <Badge variant="destructive" className="text-[9px] gap-0.5 px-1.5 py-0">
                            {isAr ? 'مُصعّد' : 'Escalated'}
                          </Badge>
                        )}
                        {approval.delegated_profile?.full_name && (
                          <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 py-0">
                            <Forward className="h-2 w-2" />
                            {approval.delegated_profile.full_name}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                        {approval.approver?.full_name ? (
                          <span className="flex items-center gap-0.5 truncate">
                            <User className="h-2.5 w-2.5" />
                            {approval.approver.full_name}
                          </span>
                        ) : <span />}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true, locale: ar })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
                {colApprovals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground/40 text-xs">
                    {isAr ? 'لا توجد اعتمادات' : 'No approvals'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
