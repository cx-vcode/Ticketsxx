import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, RefreshCw, ArrowLeft, Wrench, FileText, Layers } from 'lucide-react';
import {
  fetchApprovalHealthOverview,
  fetchServicesWithoutAssignmentGroup,
  fetchServicesWithoutApprovalCoverage,
  fetchTicketsMissingApprovals,
  backfillAllMissingApprovals,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';

export default function AdminApprovalHealth() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ['approval-health-overview'],
    queryFn: fetchApprovalHealthOverview,
    refetchInterval: 30000,
  });

  const { data: noGroup = [] } = useQuery({
    queryKey: ['services-no-group'],
    queryFn: fetchServicesWithoutAssignmentGroup,
  });

  const { data: noCoverage = [] } = useQuery({
    queryKey: ['services-no-coverage'],
    queryFn: fetchServicesWithoutApprovalCoverage,
  });

  const { data: ticketsMissing = [] } = useQuery({
    queryKey: ['tickets-missing-approvals'],
    queryFn: fetchTicketsMissingApprovals,
  });

  const backfillAll = useMutation({
    mutationFn: backfillAllMissingApprovals,
    onSuccess: (r) => {
      toast({
        title: 'تم التعويض',
        description: `${r.processed} تذكرة عُولجت، ${r.total_inserted} مرحلة أُضيفت`,
      });
      qc.invalidateQueries({ queryKey: ['tickets-missing-approvals'] });
      qc.invalidateQueries({ queryKey: ['approval-health-overview'] });
    },
    onError: (e: any) => toast({ title: 'فشل', description: sanitizeError(e), variant: 'destructive' }),
  });

  const score = health?.health_score ?? 0;
  const scoreTone = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';
  const scoreBg = score >= 80 ? 'from-success/15 to-success/5' : score >= 50 ? 'from-warning/15 to-warning/5' : 'from-destructive/15 to-destructive/5';

  return (
    <PageLayout>
      <main className="flex-1 overflow-auto">
        <PageHeader
          icon={<ShieldCheck className="w-4 h-4" />}
          title="لوحة صحة ربط الاعتمادات"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/approval-stages"><ArrowLeft className="w-4 h-4 ms-1" /> مراحل الاعتماد</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries()}>
                <RefreshCw className="w-4 h-4 ms-1" /> تحديث
              </Button>
            </div>
          }
        />
        <p className="container mx-auto px-4 lg:px-6 pt-4 text-sm text-muted-foreground max-w-7xl">
          نظرة فورية على كل ما يربط الخدمات والأقسام بمراحل الاعتماد
        </p>

        <div className="container mx-auto px-4 lg:px-6 pb-10 space-y-6 max-w-7xl">
          {/* Health Score Hero */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={cn('border-2 overflow-hidden bg-gradient-to-br', scoreBg)}>
              <CardContent className="p-6 sm:p-8">
                {loadingHealth ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="text-center md:text-start shrink-0">
                      <div className={cn('text-6xl md:text-7xl font-bold tabular-nums', scoreTone)}>
                        {score}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">من 100</p>
                    </div>
                    <div className="flex-1 w-full">
                      <h3 className="text-lg font-bold mb-1">مؤشر صحة النظام</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {score >= 80 ? 'كل شيء يعمل بشكل ممتاز ✨' :
                         score >= 50 ? 'هناك بعض الفجوات تحتاج لمعالجة ⚠️' :
                         'مشاكل حرجة تحتاج تدخل فوري 🚨'}
                      </p>
                      <Progress value={score} className="h-3" />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <Stat label="الخدمات" value={health?.services_total ?? 0} icon={Layers} />
                        <Stat label="الأقسام" value={health?.departments_total ?? 0} icon={FileText} />
                        <Stat label="إجمالي المراحل" value={health?.stages_total ?? 0} icon={ShieldCheck} />
                        <Stat label="متوسط مراحل/قسم" value={health?.avg_stages_per_department ?? 0} icon={CheckCircle2} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Issue cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <IssueCard
              title="خدمات بلا قسم افتراضي"
              count={health?.services_no_assignment_group ?? 0}
              tone="warning"
              icon={AlertTriangle}
              description="هذه الخدمات لا توجّه التذاكر تلقائياً"
              action={<Link to="/admin/services" className="text-xs font-semibold underline">إصلاح الآن →</Link>}
            />
            <IssueCard
              title="خدمات بلا مراحل اعتماد"
              count={health?.services_no_approval_coverage ?? 0}
              tone="destructive"
              icon={XCircle}
              description="تذاكر هذه الخدمات تذهب مباشرة للحالة المفتوحة"
              action={<Link to="/admin/approval-templates" className="text-xs font-semibold underline">تطبيق قالب →</Link>}
            />
            <IssueCard
              title="أقسام بلا مراحل"
              count={health?.departments_no_stages ?? 0}
              tone="warning"
              icon={AlertTriangle}
              description="أقسام بدون أي مرحلة اعتماد معرّفة"
              action={<Link to="/admin/approval-stages" className="text-xs font-semibold underline">إضافة مراحل →</Link>}
            />
            <IssueCard
              title="تذاكر معلقة بلا اعتمادات"
              count={health?.tickets_pending_without_approvals ?? 0}
              tone={ticketsMissing.length > 0 ? 'destructive' : 'success'}
              icon={ticketsMissing.length > 0 ? XCircle : CheckCircle2}
              description="تذاكر مفتوحة لا تحتوي على أي مراحل اعتماد"
              action={
                ticketsMissing.length > 0 ? (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => backfillAll.mutate()} disabled={backfillAll.isPending}>
                    <Wrench className="w-3 h-3 ms-1" />
                    {backfillAll.isPending ? 'جاري التعويض...' : `تعويض ${ticketsMissing.length} تذكرة`}
                  </Button>
                ) : null
              }
            />
          </div>

          {/* Detailed lists */}
          {(noGroup.length > 0 || noCoverage.length > 0 || ticketsMissing.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {noGroup.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      خدمات بلا قسم افتراضي ({noGroup.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 max-h-72 overflow-auto">
                    {noGroup.slice(0, 20).map((s) => (
                      <div key={s.service_id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{s.service_name}</p>
                          <p className="text-muted-foreground text-[10px]">{s.system_name || '—'}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{s.active_tickets_count} تذكرة</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {noCoverage.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      خدمات بلا تغطية اعتماد ({noCoverage.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 max-h-72 overflow-auto">
                    {noCoverage.slice(0, 20).map((s) => (
                      <div key={s.service_id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{s.service_name}</p>
                          <p className="text-muted-foreground text-[10px]">{s.system_name || '—'}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{s.active_tickets_count} تذكرة</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </PageLayout>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-background/60 backdrop-blur rounded-lg p-3 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function IssueCard({
  title, count, tone, icon: Icon, description, action,
}: {
  title: string; count: number; tone: 'success' | 'warning' | 'destructive';
  icon: any; description: string; action?: React.ReactNode;
}) {
  const ok = count === 0;
  const toneClasses = ok
    ? 'border-success/30 bg-success/5'
    : tone === 'destructive'
      ? 'border-destructive/30 bg-destructive/5'
      : 'border-warning/30 bg-warning/5';
  const iconColor = ok ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-warning';

  return (
    <Card className={cn('border-2', toneClasses)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Icon className={cn('w-5 h-5', iconColor)} />
          <p className={cn('text-3xl font-bold tabular-nums', iconColor)}>{count}</p>
        </div>
        <h4 className="text-sm font-bold mb-1">{title}</h4>
        <p className="text-[11px] text-muted-foreground mb-2">{description}</p>
        {!ok && action}
      </CardContent>
    </Card>
  );
}
