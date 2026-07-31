import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApprovalStages, createApprovalStage, updateApprovalStage, deleteApprovalStage, fetchDepartments, fetchAgents, fetchServices, rebuildApprovalRelationships, type ApprovalStage } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeError } from '@/lib/errorHandler';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ShieldCheck, Layers, GitBranch, Clock, AlertTriangle, BarChart3, Workflow, Wrench, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { ApprovalStageForm, type StageFormData } from '@/components/approval-stages/ApprovalStageForm';
import { DepartmentStageGroup } from '@/components/approval-stages/DepartmentStageGroup';
import { ApprovalFlowchart } from '@/components/approval-stages/ApprovalFlowchart';
import { ApprovalCoveragePanel } from '@/components/approval-stages/ApprovalCoveragePanel';
import { TicketDiagnosticPanel } from '@/components/approval-stages/TicketDiagnosticPanel';
import { TestApprovalCreationPanel } from '@/components/approval-stages/TestApprovalCreationPanel';
import { differenceInHours } from 'date-fns';


const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

interface StageStats {
  pending: number;
  approved: number;
  rejected: number;
  avgDecisionHours: number | null;
}

export default function AdminApprovalStages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, isRTL, lang } = useLanguage();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isAr = lang === 'ar';
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<StageFormData> | undefined>();
  const [filterDept, setFilterDept] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<ApprovalStage | null>(null);
  const [activeTab, setActiveTab] = useState('stages');
  const [rebuilding, setRebuilding] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState<Awaited<ReturnType<typeof rebuildApprovalRelationships>> | null>(null);

  const { data: stages = [], isLoading, error: stagesError, refetch: refetchStages } = useQuery({
    queryKey: ['approval-stages'],
    queryFn: () => fetchApprovalStages(),
    retry: 1,
  });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: fetchAgents });
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });


  // Fetch ticket_approvals for stats
  const { data: approvals = [] } = useQuery({
    queryKey: ['ticket-approvals-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_approvals')
        .select('id, stage_id, status, created_at, decided_at');
      if (error) throw error;
      return data || [];
    },
  });

  // Compute per-stage stats
  const stageStatsMap = useMemo(() => {
    const map: Record<string, StageStats> = {};
    stages.forEach(s => {
      const stageApprovals = approvals.filter((a: any) => a.stage_id === s.id);
      const pending = stageApprovals.filter((a: any) => a.status === 'pending').length;
      const approved = stageApprovals.filter((a: any) => a.status === 'approved').length;
      const rejected = stageApprovals.filter((a: any) => a.status === 'rejected').length;

      const decided = stageApprovals.filter((a: any) => a.decided_at && a.created_at);
      let avgDecisionHours: number | null = null;
      if (decided.length > 0) {
        const totalHours = decided.reduce((sum: number, a: any) => {
          return sum + Math.abs(differenceInHours(new Date(a.decided_at), new Date(a.created_at)));
        }, 0);
        avgDecisionHours = totalHours / decided.length;
      }

      map[s.id] = { pending, approved, rejected, avgDecisionHours };
    });
    return map;
  }, [stages, approvals]);

  // KPI calculations
  const kpiStats = useMemo(() => {
    const totalStages = stages.length;
    const deptsWithStages = new Set(stages.map(s => s.department_id)).size;
    const totalDepts = departments.length;
    const withDeadline = stages.filter(s => s.deadline_hours).length;
    const withEscalation = stages.filter(s => s.escalation_to).length;
    const avgDeadline = withDeadline > 0
      ? stages.filter(s => s.deadline_hours).reduce((sum, s) => sum + (s.deadline_hours || 0), 0) / withDeadline
      : 0;

    const totalPending = approvals.filter((a: any) => a.status === 'pending').length;
    const totalApproved = approvals.filter((a: any) => a.status === 'approved').length;
    const totalRejected = approvals.filter((a: any) => a.status === 'rejected').length;

    return { totalStages, deptsWithStages, totalDepts, withDeadline, withEscalation, avgDeadline, totalPending, totalApproved, totalRejected };
  }, [stages, departments, approvals]);

  const createMut = useMutation({
    mutationFn: (data: StageFormData) => createApprovalStage(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-stages'] }); toast({ title: t.admin.stageCreated }); setFormOpen(false); },
    onError: (err: any) => toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StageFormData }) => updateApprovalStage(id, data as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-stages'] }); toast({ title: t.admin.stageUpdated }); setFormOpen(false); setEditId(null); },
    onError: (err: any) => toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteApprovalStage,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-stages'] }); toast({ title: t.admin.stageDeleted }); setDeleteTarget(null); },
  });

  const handleSubmit = useCallback((data: StageFormData) => {
    if (editId) updateMut.mutate({ id: editId, data });
    else createMut.mutate(data);
  }, [editId, createMut, updateMut]);

  const handleEdit = useCallback((stage: ApprovalStage) => {
    setEditId(stage.id);
    setEditData({
      department_id: stage.department_id,
      stage_name: stage.stage_name,
      stage_order: stage.stage_order,
      stage_type: stage.stage_type,
      approver_role: stage.approver_role,
      approver_id: stage.approver_id,
      service_id: stage.service_id,
      deadline_hours: stage.deadline_hours,
      escalation_to: stage.escalation_to,
    });
    setFormOpen(true);
  }, []);

  const handleDuplicate = useCallback((stage: ApprovalStage) => {
    const maxOrder = stages.filter(s => s.department_id === stage.department_id).reduce((max, s) => Math.max(max, s.stage_order), 0);
    createMut.mutate({
      department_id: stage.department_id,
      stage_name: `${stage.stage_name} (${t.admin.duplicateStage})`,
      stage_order: maxOrder + 1,
      stage_type: stage.stage_type,
      approver_role: stage.approver_role,
      approver_id: stage.approver_id,
      service_id: stage.service_id,
      deadline_hours: stage.deadline_hours,
      escalation_to: stage.escalation_to,
    });
  }, [stages, createMut, t]);

  // Reorder: move up/down
  const handleMoveUp = useCallback(async (stage: ApprovalStage) => {
    const deptStages = stages.filter(s => s.department_id === stage.department_id).sort((a, b) => a.stage_order - b.stage_order);
    const idx = deptStages.findIndex(s => s.id === stage.id);
    if (idx <= 0) return;
    const prev = deptStages[idx - 1];
    // Swap orders
    await Promise.all([
      updateApprovalStage(stage.id, { stage_order: prev.stage_order } as any),
      updateApprovalStage(prev.id, { stage_order: stage.stage_order } as any),
    ]);
    queryClient.invalidateQueries({ queryKey: ['approval-stages'] });
    toast({ title: isAr ? 'تم تغيير الترتيب' : 'Order updated' });
  }, [stages, queryClient, toast, isAr]);

  const handleMoveDown = useCallback(async (stage: ApprovalStage) => {
    const deptStages = stages.filter(s => s.department_id === stage.department_id).sort((a, b) => a.stage_order - b.stage_order);
    const idx = deptStages.findIndex(s => s.id === stage.id);
    if (idx >= deptStages.length - 1) return;
    const next = deptStages[idx + 1];
    await Promise.all([
      updateApprovalStage(stage.id, { stage_order: next.stage_order } as any),
      updateApprovalStage(next.id, { stage_order: stage.stage_order } as any),
    ]);
    queryClient.invalidateQueries({ queryKey: ['approval-stages'] });
    toast({ title: isAr ? 'تم تغيير الترتيب' : 'Order updated' });
  }, [stages, queryClient, toast, isAr]);

  const openNewForm = useCallback(() => {
    setEditId(null);
    setEditData(undefined);
    setFormOpen(true);
  }, []);

  const handleRebuildRelationships = useCallback(async () => {
    setRebuilding(true);
    try {
      const result = await rebuildApprovalRelationships();
      setLastDiagnostics(result);
      if (result.ok) {
        toast({
          title: isAr ? '✅ العلاقات سليمة' : '✅ Relationships healthy',
          description: isAr
            ? `تم التحقق من القيود. ${result.stageCount} مرحلة متاحة.`
            : `Constraints verified. ${result.stageCount} stage(s) reachable.`,
        });
      } else {
        toast({
          title: isAr ? '⚠️ مشكلة في العلاقات' : '⚠️ Relationship issue',
          description: result.embedError || result.fallbackError || 'Unknown',
          variant: 'destructive',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['approval-stages'] });
      await refetchStages();
    } catch (e: any) {
      setLastDiagnostics(null);
      toast({
        title: isAr ? 'فشل الفحص' : 'Rebuild failed',
        description: sanitizeError(e),
        variant: 'destructive',
      });
    } finally {
      setRebuilding(false);
    }
  }, [toast, isAr, queryClient, refetchStages]);

  const filtered = useMemo(() => filterDept === 'all' ? stages : stages.filter(s => s.department_id === filterDept), [stages, filterDept]);
  const grouped = useMemo(() => {
    return filtered.reduce((acc, s) => {
      const key = s.department_id;
      const name = s.departments?.name || '—';
      if (!acc[key]) acc[key] = { name, stages: [] };
      acc[key].stages.push(s);
      return acc;
    }, {} as Record<string, { name: string; stages: ApprovalStage[] }>);
  }, [filtered]);

  const kpiCards = [
    { label: isAr ? 'إجمالي المراحل' : 'Total Stages', value: kpiStats.totalStages, icon: Layers, color: 'text-primary bg-primary/10' },
    { label: isAr ? 'الأقسام المغطاة' : 'Depts Covered', value: `${kpiStats.deptsWithStages}/${kpiStats.totalDepts}`, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: isAr ? 'متوسط المهلة' : 'Avg Deadline', value: kpiStats.avgDeadline > 0 ? `${kpiStats.avgDeadline.toFixed(0)} ${isAr ? 'ساعة' : 'hrs'}` : (isAr ? 'غير محدد' : 'N/A'), icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
    { label: isAr ? 'مراحل بتصعيد' : 'With Escalation', value: kpiStats.withEscalation, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
  ];

  const approvalKpiCards = [
    { label: isAr ? 'اعتمادات معلقة' : 'Pending', value: kpiStats.totalPending, color: 'text-amber-600 bg-amber-500/10' },
    { label: isAr ? 'مقبولة' : 'Approved', value: kpiStats.totalApproved, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: isAr ? 'مرفوضة' : 'Rejected', value: kpiStats.totalRejected, color: 'text-destructive bg-destructive/10' },
  ];

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.approvalStagesTitle}
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                className="gap-2 text-sm rounded-xl"
                onClick={handleRebuildRelationships}
                disabled={rebuilding}
                data-testid="rebuild-relationships-btn"
              >
                {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                {isAr ? 'إعادة بناء العلاقات' : 'Rebuild Relationships'}
              </Button>
            )}
            <Button className="gradient-accent text-accent-foreground gap-2 text-sm shadow-lg shadow-primary/20 rounded-xl" onClick={openNewForm} data-testid="new-stage-btn">
              <Plus className="h-4 w-4" /> {t.admin.newStage}
            </Button>
          </div>
        }
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Error Banner */}
          {stagesError && (
            <Alert variant="destructive" className="mb-4 rounded-2xl" data-testid="stages-error-banner">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {isAr ? 'فشل تحميل مراحل الاعتماد' : 'Failed to load approval stages'}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="font-mono text-xs break-all">
                  {(stagesError as Error)?.message || String(stagesError)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => refetchStages()} className="rounded-lg h-7 text-xs">
                    {isAr ? 'إعادة المحاولة' : 'Retry'}
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={handleRebuildRelationships} disabled={rebuilding} className="rounded-lg h-7 text-xs gap-1">
                      {rebuilding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                      {isAr ? 'فحص العلاقات' : 'Check Relationships'}
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Rebuild Diagnostics Panel */}
          {isAdmin && lastDiagnostics && (
            <Alert
              variant={lastDiagnostics.ok ? 'default' : 'destructive'}
              className="mb-4 rounded-2xl"
              data-testid="rebuild-diagnostics-panel"
            >
              <Wrench className="h-4 w-4" />
              <AlertTitle>
                {isAr ? 'نتائج فحص العلاقات' : 'Rebuild Diagnostics'}
              </AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs">
                  <div data-testid="diag-embed-works">
                    <span className="font-semibold">embedWorks:</span>{' '}
                    <span className={lastDiagnostics.embedWorks ? 'text-emerald-600' : 'text-destructive'}>
                      {String(lastDiagnostics.embedWorks)}
                    </span>
                  </div>
                  <div data-testid="diag-fallback-works">
                    <span className="font-semibold">fallbackWorks:</span>{' '}
                    <span className={lastDiagnostics.fallbackWorks ? 'text-emerald-600' : 'text-destructive'}>
                      {String(lastDiagnostics.fallbackWorks)}
                    </span>
                  </div>
                  <div data-testid="diag-stage-count">
                    <span className="font-semibold">stageCount:</span> {lastDiagnostics.stageCount}
                  </div>
                </div>
                {lastDiagnostics.embedError && (
                  <p className="mt-2 font-mono text-xs break-all" data-testid="diag-embed-error">
                    <span className="font-semibold">embedError:</span> {lastDiagnostics.embedError}
                  </p>
                )}
                {lastDiagnostics.fallbackError && (
                  <p className="mt-1 font-mono text-xs break-all" data-testid="diag-fallback-error">
                    <span className="font-semibold">fallbackError:</span> {lastDiagnostics.fallbackError}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {kpiCards.map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Approval Stats Mini Row */}
          <div className="flex flex-wrap gap-2 mb-5">
            {approvalKpiCards.map((kpi, i) => (
              <Badge key={i} variant="outline" className={`gap-1.5 py-1.5 px-3 text-xs ${kpi.color} border-current/20`}>
                <BarChart3 className="h-3 w-3" />
                {kpi.label}: {kpi.value}
              </Badge>
            ))}
          </div>

          {/* Coverage Diagnostics (admin only) */}
          {isAdmin && <ApprovalCoveragePanel isAr={isAr} />}
          {isAdmin && <TestApprovalCreationPanel isAr={isAr} />}
          {(isAdmin || role === 'agent') && <TicketDiagnosticPanel isAr={isAr} />}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="stages" className="gap-1.5 rounded-lg text-xs">
                <Layers className="h-3.5 w-3.5" />
                {isAr ? 'إدارة المراحل' : 'Manage Stages'}
              </TabsTrigger>
              <TabsTrigger value="flowchart" className="gap-1.5 rounded-lg text-xs">
                <Workflow className="h-3.5 w-3.5" />
                {isAr ? 'المخطط البصري' : 'Visual Flow'}
              </TabsTrigger>
            </TabsList>

            {/* Stages Management Tab */}
            <TabsContent value="stages">
              <motion.div variants={pageVariants} initial="hidden" animate="visible">
                {/* Toolbar */}
                <motion.div variants={fadeUp} className="mb-5 flex items-center gap-3 flex-wrap">
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger className="w-48 rounded-xl h-9">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.common.all}</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="rounded-full text-xs px-3 py-1">
                    {t.admin.totalStages}: {filtered.length}
                  </Badge>
                </motion.div>

                {/* Content */}
                {isLoading ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : Object.keys(grouped).length === 0 ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mb-3 opacity-30" />
                    <p>{t.admin.noStagesYet}</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([deptId, { name, stages: deptStages }]) => (
                      <motion.div key={deptId} variants={fadeUp}>
                        <DepartmentStageGroup
                          deptName={name}
                          stages={deptStages}
                          stageStatsMap={stageStatsMap}
                          onEdit={handleEdit}
                          onDelete={setDeleteTarget}
                          onDuplicate={handleDuplicate}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </TabsContent>

            {/* Flowchart Tab */}
            <TabsContent value="flowchart">
              <ApprovalFlowchart stages={filtered} departments={departments} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Form Dialog */}
      <ApprovalStageForm
        open={formOpen}
        onOpenChange={(v) => { if (!v) { setEditId(null); setEditData(undefined); } setFormOpen(v); }}
        editId={editId}
        initialData={editData}
        departments={departments}
        agents={agents}
        services={services}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.deleteStageConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.deleteStageDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
