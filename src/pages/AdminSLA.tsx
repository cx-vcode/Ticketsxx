import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSLAPolicies, updateSLAPolicy } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer } from '@/components/layout';
import { ErrorState, AdminTableSkeleton } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Timer, ShieldCheck, AlertTriangle, ArrowUpRight, Clock, Bell, Settings2, BarChart3, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
// LoadingSpinner replaced by AdminTableSkeleton
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

const priorityOrder = ['urgent', 'high', 'medium', 'low'] as const;
const priorityColors: Record<string, string> = {
  urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-info/10 text-info border-info/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const escalationLevels = [
  { level: 3, color: 'bg-destructive/10 text-destructive' },
  { level: 2, color: 'bg-warning/10 text-warning' },
  { level: 1, color: 'bg-info/10 text-info' },
  { level: 0, color: 'bg-muted text-muted-foreground' },
];

function formatMinutes(mins: number, lang: string) {
  if (mins < 60) return lang === 'ar' ? `${mins} دقيقة` : `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return lang === 'ar' ? `${h} ساعة` : `${h}h`;
  return lang === 'ar' ? `${h} ساعة و ${m} دقيقة` : `${h}h ${m}m`;
}

export default function AdminSLA() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, lang, isRTL } = useLanguage();
  const { priorityLabels: localizedPriority } = useLocalizedLabels();

  const { data: policies = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sla-policies'],
    queryFn: fetchSLAPolicies,
  });

  // Live SLA stats
  const { data: liveStats } = useQuery({
    queryKey: ['sla-live-stats'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [breachedRes, atRiskRes, compliantRes, totalRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("resolved","closed")')
          .lt('sla_resolution_due_at', now)
          .not('sla_resolution_due_at', 'is', null),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("resolved","closed")')
          .gt('sla_resolution_due_at', now)
          .lt('sla_resolution_due_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
          .not('sla_resolution_due_at', 'is', null),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .in('status', ['resolved', 'closed'])
          .not('sla_resolution_due_at', 'is', null),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
          .not('sla_resolution_due_at', 'is', null),
      ]);
      return {
        breached: breachedRes.count || 0,
        atRisk: atRiskRes.count || 0,
        compliant: compliantRes.count || 0,
        total: totalRes.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Overdue tickets
  const { data: overdueTickets = [] } = useQuery({
    queryKey: ['sla-overdue-tickets'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('tickets')
        .select('id, code, ticket_number, title, priority, status, sla_resolution_due_at, assigned_agent_id, services(name)')
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_resolution_due_at', now)
        .not('sla_resolution_due_at', 'is', null)
        .order('sla_resolution_due_at', { ascending: true })
        .limit(15);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const [edits, setEdits] = useState<Record<string, { response: number; resolution: number }>>({});

  useEffect(() => {
    if (policies.length > 0) {
      const map: typeof edits = {};
      policies.forEach(p => {
        map[p.id] = { response: p.first_response_minutes, resolution: p.resolution_minutes };
      });
      setEdits(map);
    }
  }, [policies]);

  const updateMut = useMutation({
    mutationFn: ({ id, response, resolution }: { id: string; response: number; resolution: number }) =>
      updateSLAPolicy(id, { first_response_minutes: response, resolution_minutes: resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      toast({ title: t.admin.slaUpdated });
    },
  });

  const sortedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => priorityOrder.indexOf(a.priority as any) - priorityOrder.indexOf(b.priority as any));
  }, [policies]);

  const complianceRate = liveStats && liveStats.total > 0
    ? Math.round(((liveStats.total - liveStats.breached) / liveStats.total) * 100)
    : 100;

  const escalationRules = useMemo(() => [
    {
      priority: lang === 'ar' ? 'عاجل' : 'Urgent',
      threshold: lang === 'ar' ? '1 ساعة' : '1 hour',
      action: lang === 'ar' ? 'تصعيد فوري للمدير + إشعار عاجل' : 'Immediate escalation to manager + urgent alert',
      level: 3,
    },
    {
      priority: lang === 'ar' ? 'عالي' : 'High',
      threshold: lang === 'ar' ? '4 ساعات' : '4 hours',
      action: lang === 'ar' ? 'تصعيد لقائد الفريق + رفع الأولوية' : 'Escalate to team lead + raise priority',
      level: 2,
    },
    {
      priority: lang === 'ar' ? 'متوسط' : 'Medium',
      threshold: lang === 'ar' ? '8 ساعات' : '8 hours',
      action: lang === 'ar' ? 'إعادة تعيين تلقائي + إشعار' : 'Auto-reassign + notification',
      level: 1,
    },
    {
      priority: lang === 'ar' ? 'منخفض' : 'Low',
      threshold: lang === 'ar' ? '24 ساعة' : '24 hours',
      action: lang === 'ar' ? 'إشعار بريدي للوكيل' : 'Email notification to agent',
      level: 0,
    },
  ], [lang]);

  return (
    <PageLayout>
      <PageHeader title={t.admin.slaTitle} icon={<Timer className="h-5 w-5" />} />
      <PageContainer maxWidth="lg">
        {isLoading ? (
          <AdminTableSkeleton rows={5} cols={4} kpiCount={4} showToolbar={false} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="space-y-6">
            {/* Live KPI Strip */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { icon: ShieldCheck, label: lang === 'ar' ? 'نسبة الالتزام' : 'Compliance', value: `${complianceRate}%`, color: complianceRate >= 80 ? 'text-success' : 'text-destructive', bgColor: complianceRate >= 80 ? 'bg-success/10' : 'bg-destructive/10' },
                { icon: AlertTriangle, label: lang === 'ar' ? 'تذاكر متجاوزة' : 'Breached', value: liveStats?.breached ?? 0, color: 'text-destructive', bgColor: 'bg-destructive/10' },
                { icon: Clock, label: lang === 'ar' ? 'على وشك التجاوز' : 'At Risk', value: liveStats?.atRisk ?? 0, color: 'text-warning', bgColor: 'bg-warning/10' },
                { icon: CheckCircle, label: lang === 'ar' ? 'ملتزمة' : 'Compliant', value: liveStats?.compliant ?? 0, color: 'text-success', bgColor: 'bg-success/10' },
              ].map((kpi, i) => (
                <Card key={i} className="rounded-2xl border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bgColor}`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{kpi.value}</p>
                      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            {/* Compliance Progress */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible">
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{lang === 'ar' ? 'معدل الالتزام الإجمالي' : 'Overall Compliance Rate'}</span>
                    <Badge variant="outline" className={complianceRate >= 90 ? 'text-success border-success/20 bg-success/10' : complianceRate >= 70 ? 'text-warning border-warning/20 bg-warning/10' : 'text-destructive border-destructive/20 bg-destructive/10'}>
                      {complianceRate >= 90 ? (lang === 'ar' ? 'ممتاز' : 'Excellent') : complianceRate >= 70 ? (lang === 'ar' ? 'جيد' : 'Good') : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement')}
                    </Badge>
                  </div>
                  <Progress value={complianceRate} className="h-3 rounded-full" />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {lang === 'ar' ? `${liveStats?.total ?? 0} تذكرة مع سياسة SLA` : `${liveStats?.total ?? 0} tickets with SLA policy`}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tabs */}
            <Tabs defaultValue="policies" className="w-full">
              <TabsList className="w-full grid grid-cols-3 rounded-xl h-10">
                <TabsTrigger value="policies" className="gap-1.5 text-xs rounded-lg">
                  <Settings2 className="h-3.5 w-3.5" />
                  {lang === 'ar' ? 'السياسات' : 'Policies'}
                </TabsTrigger>
                <TabsTrigger value="escalation" className="gap-1.5 text-xs rounded-lg">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {lang === 'ar' ? 'التصعيد' : 'Escalation'}
                </TabsTrigger>
                <TabsTrigger value="breaches" className="gap-1.5 text-xs rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {lang === 'ar' ? 'التجاوزات' : 'Breaches'}
                </TabsTrigger>
              </TabsList>

              {/* Policies Tab */}
              <TabsContent value="policies" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">{t.admin.slaDesc}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedPolicies.map((policy, i) => (
                    <motion.div key={policy.id} variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: i * 0.08 }}>
                      <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Timer className="h-4 w-4 text-primary" />
                              </div>
                              {localizedPriority[policy.priority]}
                            </CardTitle>
                            <Badge variant="outline" className={`text-[10px] ${priorityColors[policy.priority]}`}>
                              {policy.priority.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Visual summary */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/30 text-center">
                              <p className="text-[10px] text-muted-foreground mb-0.5">{t.admin.firstResponseMin}</p>
                              <p className="text-sm font-bold text-primary">{formatMinutes(edits[policy.id]?.response ?? policy.first_response_minutes, lang)}</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/30 text-center">
                              <p className="text-[10px] text-muted-foreground mb-0.5">{t.admin.resolutionMin}</p>
                              <p className="text-sm font-bold text-primary">{formatMinutes(edits[policy.id]?.resolution ?? policy.resolution_minutes, lang)}</p>
                            </div>
                          </div>

                          {/* Edit fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">{t.admin.firstResponseMin}</Label>
                              <Input
                                type="number"
                                min={1}
                                className="rounded-xl h-9 text-sm"
                                value={edits[policy.id]?.response ?? policy.first_response_minutes}
                                onChange={e => setEdits(prev => ({
                                  ...prev,
                                  [policy.id]: { ...prev[policy.id], response: parseInt(e.target.value) || 1 }
                                }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">{t.admin.resolutionMin}</Label>
                              <Input
                                type="number"
                                min={1}
                                className="rounded-xl h-9 text-sm"
                                value={edits[policy.id]?.resolution ?? policy.resolution_minutes}
                                onChange={e => setEdits(prev => ({
                                  ...prev,
                                  [policy.id]: { ...prev[policy.id], resolution: parseInt(e.target.value) || 1 }
                                }))}
                              />
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full gradient-accent text-accent-foreground rounded-xl shadow-lg shadow-primary/20"
                            disabled={updateMut.isPending}
                            onClick={() => updateMut.mutate({
                              id: policy.id,
                              response: edits[policy.id]?.response ?? policy.first_response_minutes,
                              resolution: edits[policy.id]?.resolution ?? policy.resolution_minutes,
                            })}
                          >
                            {updateMut.isPending && <Loader2 className={`h-3 w-3 animate-spin ${isRTL ? 'ml-1' : 'mr-1'}`} />}
                            {t.common.save}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              {/* Escalation Tab */}
              <TabsContent value="escalation" className="space-y-4 mt-4">
                <Card className="rounded-2xl border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                      {lang === 'ar' ? 'مصفوفة التصعيد التلقائي' : 'Auto-Escalation Matrix'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {lang === 'ar' 
                        ? 'يتم تنفيذ التصعيد تلقائياً عند تجاوز مهلة SLA بناءً على مستوى الأولوية'
                        : 'Escalation is automatically triggered when SLA deadline is breached based on priority level'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {escalationRules.map((rule, i) => (
                      <motion.div
                        key={rule.level}
                        initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${escalationLevels[i].color}`}>
                          L{rule.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{rule.priority}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              <Clock className="h-2.5 w-2.5 ltr:mr-0.5 rtl:ml-0.5" />
                              {rule.threshold}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{rule.action}</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card className="rounded-2xl border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      {lang === 'ar' ? 'إعدادات التنبيهات' : 'Alert Settings'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: lang === 'ar' ? 'تنبيه قبل انتهاء المهلة بساعة' : 'Alert 1 hour before deadline', enabled: true },
                      { label: lang === 'ar' ? 'تصعيد تلقائي عند التجاوز' : 'Auto-escalate on breach', enabled: true },
                      { label: lang === 'ar' ? 'إشعار المدراء عند التصعيد' : 'Notify managers on escalation', enabled: true },
                      { label: lang === 'ar' ? 'إرسال بريد إلكتروني للتنبيهات' : 'Send email alerts', enabled: true },
                    ].map((setting, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                        <span className="text-sm">{setting.label}</span>
                        <Switch defaultChecked={setting.enabled} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Business Hours Card */}
              <Card className="rounded-2xl border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {lang === 'ar' ? 'ساعات العمل (تطبيق SLA)' : 'Business Hours (SLA Window)'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {lang === 'ar'
                      ? 'حدد ساعات العمل التي يُحسب خلالها التزام SLA. خارج هذه الساعات يتم إيقاف عداد المهلة.'
                      : 'Define working hours for SLA tracking. Counters pause outside these hours.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'بداية اليوم' : 'Day Start'}</Label>
                      <Input
                        type="time"
                        defaultValue={localStorage.getItem('sla_business_hours_start') || '08:00'}
                        onBlur={e => localStorage.setItem('sla_business_hours_start', e.target.value)}
                        className="rounded-xl h-9 text-sm"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'نهاية اليوم' : 'Day End'}</Label>
                      <Input
                        type="time"
                        defaultValue={localStorage.getItem('sla_business_hours_end') || '17:00'}
                        onBlur={e => localStorage.setItem('sla_business_hours_end', e.target.value)}
                        className="rounded-xl h-9 text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(lang === 'ar'
                      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
                      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    ).map((day, idx) => {
                      const stored = JSON.parse(localStorage.getItem('sla_working_days') || '[0,1,2,3,4]');
                      const isActive = stored.includes(idx);
                      return (
                        <Badge
                          key={idx}
                          variant={isActive ? 'default' : 'outline'}
                          className="cursor-pointer rounded-full text-[11px] py-1 px-3 select-none"
                          onClick={() => {
                            const current = JSON.parse(localStorage.getItem('sla_working_days') || '[0,1,2,3,4]');
                            const next = current.includes(idx) ? current.filter((d: number) => d !== idx) : [...current, idx];
                            localStorage.setItem('sla_working_days', JSON.stringify(next));
                            window.location.reload();
                          }}
                        >
                          {day}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Breaches Tab */}
              <TabsContent value="breaches" className="space-y-4 mt-4">
                {overdueTickets.length === 0 ? (
                  <Card className="rounded-2xl border-border/50">
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
                      <p className="font-semibold">{lang === 'ar' ? 'لا توجد تجاوزات حالياً' : 'No active breaches'}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lang === 'ar' ? 'جميع التذاكر ضمن المهلة المحددة' : 'All tickets are within SLA deadlines'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        {lang === 'ar' ? `${overdueTickets.length} تذكرة متجاوزة` : `${overdueTickets.length} breached tickets`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {overdueTickets.map((ticket: any, i: number) => {
                        const due = new Date(ticket.sla_resolution_due_at);
                        const overdueMins = differenceInMinutes(new Date(), due);
                        const overdueText = formatDistanceToNow(due, { locale: lang === 'ar' ? ar : enUS, addSuffix: false });
                        
                        return (
                          <motion.a
                            key={ticket.id}
                            href={`/tickets/${ticket.id}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-3 p-3.5 rounded-xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors cursor-pointer block"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{ticket.code || `#${ticket.ticket_number}`}: {ticket.title}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{(ticket as any).services?.name || ''}</span>
                                <span className="text-[10px] text-destructive font-medium">
                                  {lang === 'ar' ? `متأخر ${overdueText}` : `Overdue by ${overdueText}`}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${priorityColors[ticket.priority]}`}>
                                {localizedPriority[ticket.priority] || ticket.priority}
                              </Badge>
                              <span className="text-[9px] text-destructive font-mono">
                                {overdueMins > 60 ? `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m` : `${overdueMins}m`}
                              </span>
                            </div>
                          </motion.a>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
}
