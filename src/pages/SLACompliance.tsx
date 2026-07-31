import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer } from '@/components/layout';
import { EmptyState, ErrorState, AdminTableSkeleton } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  ShieldCheck, ShieldAlert, Clock, Download, CalendarDays, Filter,
  AlertTriangle, CheckCircle, Timer, Gauge, Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { subDays, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

async function fetchSLAData() {
  const [ticketsRes, agentsRes] = await Promise.all([
    supabase.from('tickets').select('id, ticket_number, title, status, priority, created_at, resolved_at, sla_first_response_due_at, sla_resolution_due_at, first_response_at, service_id, department_id, assigned_agent_id, services(name, systems(name)), departments(name)'),
    supabase.from('profiles').select('id, full_name'),
  ]);
  if (ticketsRes.error) throw ticketsRes.error;
  return {
    tickets: ticketsRes.data || [],
    agents: agentsRes.data || [],
  };
}

function formatDuration(mins: number, isAr: boolean) {
  if (mins < 60) return isAr ? `${mins} دقيقة` : `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return isAr ? `${h} ساعة ${m > 0 ? `و ${m} دقيقة` : ''}` : `${h}h ${m > 0 ? `${m}m` : ''}`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return isAr ? `${d} يوم ${rh > 0 ? `و ${rh} ساعة` : ''}` : `${d}d ${rh > 0 ? `${rh}h` : ''}`;
}

export default function SLACompliance() {
  const { lang, isRTL } = useLanguage();
  const { priorityLabels: localizedPriority } = useLocalizedLabels();
  const isAr = lang === 'ar';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState(isAr ? 'الكل' : 'All');

  const datePresets = useMemo(() => [
    { label: isAr ? 'آخر 7 أيام' : 'Last 7 days', getValue: () => { const to = new Date(); return { from: subDays(to, 7).toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } },
    { label: isAr ? 'آخر 30 يوم' : 'Last 30 days', getValue: () => { const to = new Date(); return { from: subDays(to, 30).toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } },
    { label: isAr ? 'آخر 90 يوم' : 'Last 90 days', getValue: () => { const to = new Date(); return { from: subDays(to, 90).toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } },
    { label: isAr ? 'الكل' : 'All', getValue: () => ({ from: '', to: '' }) },
  ], [isAr]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sla-compliance'],
    queryFn: fetchSLAData,
  });

  const applyPreset = (preset: typeof datePresets[0]) => {
    const val = preset.getValue();
    setDateFrom(val.from);
    setDateTo(val.to);
    setActivePreset(preset.label);
  };

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    return data.tickets.filter((t: any) => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(t.created_at);
      if (dateFrom && d < startOfDay(new Date(dateFrom))) return false;
      if (dateTo && d > endOfDay(new Date(dateTo))) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const withSLA = filteredTickets.filter((t: any) => t.sla_resolution_due_at);
    if (withSLA.length === 0) return null;

    const now = new Date();

    // Resolution SLA
    const resolvedWithSLA = withSLA.filter((t: any) => t.resolved_at);
    const resolutionMet = resolvedWithSLA.filter((t: any) => new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at)).length;
    const resolutionBreached = resolvedWithSLA.length - resolutionMet;
    const overdue = withSLA.filter((t: any) => !t.resolved_at && new Date(t.sla_resolution_due_at) < now).length;

    // First Response SLA
    const withFR = withSLA.filter((t: any) => t.sla_first_response_due_at);
    const frResponded = withFR.filter((t: any) => t.first_response_at);
    const frMet = frResponded.filter((t: any) => new Date(t.first_response_at) <= new Date(t.sla_first_response_due_at)).length;

    const totalForCompliance = resolvedWithSLA.length || 1;
    const compliancePercent = Math.round((resolutionMet / totalForCompliance) * 100);
    const frCompliancePercent = frResponded.length > 0 ? Math.round((frMet / frResponded.length) * 100) : 100;

    // MTTR + MTTFR
    const resolutionDurations = resolvedWithSLA.map((t: any) => differenceInMinutes(new Date(t.resolved_at), new Date(t.created_at)));
    const mttr = resolutionDurations.length > 0
      ? Math.round(resolutionDurations.reduce((s, v) => s + v, 0) / resolutionDurations.length)
      : 0;
    const frDurations = frResponded.map((t: any) => differenceInMinutes(new Date(t.first_response_at), new Date(t.created_at)));
    const mtfr = frDurations.length > 0
      ? Math.round(frDurations.reduce((s, v) => s + v, 0) / frDurations.length)
      : 0;

    // By Priority
    const byPriority: Record<string, { total: number; met: number; breached: number }> = {};
    withSLA.forEach((t: any) => {
      if (!byPriority[t.priority]) byPriority[t.priority] = { total: 0, met: 0, breached: 0 };
      byPriority[t.priority].total++;
      if (t.resolved_at) {
        if (new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at)) byPriority[t.priority].met++;
        else byPriority[t.priority].breached++;
      } else if (new Date(t.sla_resolution_due_at) < now) {
        byPriority[t.priority].breached++;
      }
    });

    const priorityData = Object.entries(byPriority).map(([k, v]) => ({
      name: localizedPriority[k] || k,
      [isAr ? 'الالتزام' : 'Compliance']: v.total > 0 ? Math.round((v.met / v.total) * 100) : 0,
      [isAr ? 'التجاوز' : 'Breaches']: v.breached,
      [isAr ? 'الإجمالي' : 'Total']: v.total,
    }));

    // By Service
    const byService: Record<string, { name: string; total: number; met: number; breached: number }> = {};
    withSLA.forEach((t: any) => {
      const svcName = (t as any).services?.name || (isAr ? 'غير محدد' : 'Unspecified');
      if (!byService[svcName]) byService[svcName] = { name: svcName, total: 0, met: 0, breached: 0 };
      byService[svcName].total++;
      if (t.resolved_at) {
        if (new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at)) byService[svcName].met++;
        else byService[svcName].breached++;
      } else if (new Date(t.sla_resolution_due_at) < now) {
        byService[svcName].breached++;
      }
    });

    const serviceData = Object.values(byService).map(s => ({
      name: s.name,
      [isAr ? 'الالتزام' : 'Compliance']: s.total > 0 ? Math.round((s.met / s.total) * 100) : 0,
      [isAr ? 'التجاوز' : 'Breaches']: s.breached,
    }));

    // By Department
    const byDept: Record<string, { name: string; total: number; met: number; breached: number }> = {};
    withSLA.forEach((t: any) => {
      const deptName = (t as any).departments?.name || (isAr ? 'غير محدد' : 'Unspecified');
      if (!byDept[deptName]) byDept[deptName] = { name: deptName, total: 0, met: 0, breached: 0 };
      byDept[deptName].total++;
      if (t.resolved_at) {
        if (new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at)) byDept[deptName].met++;
        else byDept[deptName].breached++;
      } else if (new Date(t.sla_resolution_due_at) < now) {
        byDept[deptName].breached++;
      }
    });

    const deptData = Object.values(byDept).map(d => ({
      name: d.name,
      [isAr ? 'الالتزام' : 'Compliance']: d.total > 0 ? Math.round((d.met / d.total) * 100) : 0,
      [isAr ? 'التجاوز' : 'Breaches']: d.breached,
    }));

    // Top breaching agents
    const byAgent: Record<string, { id: string; total: number; breached: number }> = {};
    withSLA.forEach((t: any) => {
      if (!t.assigned_agent_id) return;
      if (!byAgent[t.assigned_agent_id]) byAgent[t.assigned_agent_id] = { id: t.assigned_agent_id, total: 0, breached: 0 };
      byAgent[t.assigned_agent_id].total++;
      const isBreached = t.resolved_at
        ? new Date(t.resolved_at) > new Date(t.sla_resolution_due_at)
        : new Date(t.sla_resolution_due_at) < now;
      if (isBreached) byAgent[t.assigned_agent_id].breached++;
    });
    const topBreachingAgents = Object.values(byAgent)
      .filter(a => a.breached > 0)
      .map(a => {
        const agent = data?.agents.find((p: any) => p.id === a.id);
        return {
          name: agent?.full_name || (isAr ? 'غير معروف' : 'Unknown'),
          total: a.total,
          breached: a.breached,
          rate: Math.round((a.breached / a.total) * 100),
        };
      })
      .sort((a, b) => b.breached - a.breached)
      .slice(0, 8);

    // Trend
    const trendMap: Record<string, { date: string; compliance: number; breaches: number; total: number; met: number }> = {};
    withSLA.forEach((t: any) => {
      const day = t.created_at?.slice(0, 10);
      if (!day) return;
      if (!trendMap[day]) trendMap[day] = { date: day, compliance: 0, breaches: 0, total: 0, met: 0 };
      trendMap[day].total++;
      if (t.resolved_at) {
        if (new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at)) trendMap[day].met++;
        else trendMap[day].breaches++;
      } else if (new Date(t.sla_resolution_due_at) < now) {
        trendMap[day].breaches++;
      }
    });
    Object.values(trendMap).forEach(d => {
      d.compliance = d.total > 0 ? Math.round((d.met / d.total) * 100) : 0;
    });
    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    // Breached tickets list
    const breachedTickets = withSLA.filter((t: any) => {
      if (t.resolved_at) return new Date(t.resolved_at) > new Date(t.sla_resolution_due_at);
      return new Date(t.sla_resolution_due_at) < now;
    }).slice(0, 20);

    return {
      total: withSLA.length,
      compliancePercent,
      frCompliancePercent,
      resolutionMet,
      resolutionBreached,
      overdue,
      mttr,
      mtfr,
      priorityData,
      serviceData,
      deptData,
      trend,
      breachedTickets,
      topBreachingAgents,
    };
  }, [filteredTickets, data, isAr, localizedPriority]);

  const handleExportCSV = () => {
    if (!filteredTickets.length) return;
    const headers = isAr
      ? ['رقم التذكرة', 'العنوان', 'الأولوية', 'الحالة', 'موعد SLA', 'تاريخ الحل', 'النتيجة']
      : ['Ticket #', 'Title', 'Priority', 'Status', 'SLA Due', 'Resolved At', 'Outcome'];
    const rows = filteredTickets.filter((t: any) => t.sla_resolution_due_at).map((t: any) => {
      const met = t.resolved_at ? new Date(t.resolved_at) <= new Date(t.sla_resolution_due_at) : new Date(t.sla_resolution_due_at) >= new Date();
      return [t.ticket_number, `"${(t.title || '').replace(/"/g, '""')}"`, t.priority, t.status, t.sla_resolution_due_at?.slice(0, 16), t.resolved_at?.slice(0, 16) || '', met ? (isAr ? 'ملتزم' : 'Met') : (isAr ? 'متجاوز' : 'Breached')];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sla-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <PageLayout>
      <PageHeader
        title={isAr ? 'تقرير التزام SLA' : 'SLA Compliance Report'}
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleExportCSV} disabled={!filteredTickets.length}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </Button>
        }
      />
      <PageContainer maxWidth="lg">
        {isLoading ? (
          <AdminTableSkeleton rows={5} cols={6} kpiCount={6} showToolbar />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="space-y-6">
            {/* Date Filter */}
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
              <Card className="rounded-2xl border-border/50">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{isAr ? 'فلتر الفترة الزمنية' : 'Time Range Filter'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {datePresets.map(p => (
                      <Button key={p.label} variant={activePreset === p.label ? 'default' : 'outline'} size="sm" className="text-xs rounded-full" onClick={() => applyPreset(p)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-3 items-center flex-wrap">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }} className="h-9 text-xs w-36 rounded-xl" dir="ltr" />
                    <span className="text-muted-foreground text-xs">{isAr ? 'إلى' : 'to'}</span>
                    <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(''); }} className="h-9 text-xs w-36 rounded-xl" dir="ltr" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {!stats ? (
              <EmptyState
                icon={ShieldCheck}
                title={isAr ? 'لا توجد تذاكر بسياسات SLA في هذه الفترة' : 'No SLA-tracked tickets in this period'}
                description={isAr ? 'تأكد من إعداد سياسات SLA وحاول توسيع الفترة الزمنية.' : 'Ensure SLA policies are set up and try expanding the time range.'}
              />
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
                  {[
                    { icon: ShieldCheck, value: `${stats.compliancePercent}%`, label: isAr ? 'التزام الحل' : 'Resolution Compliance', color: stats.compliancePercent >= 80 ? 'success' : 'destructive' },
                    { icon: Timer, value: `${stats.frCompliancePercent}%`, label: isAr ? 'التزام أول رد' : 'First Response', color: stats.frCompliancePercent >= 80 ? 'success' : 'destructive' },
                    { icon: Gauge, value: formatDuration(stats.mttr, isAr), label: isAr ? 'متوسط وقت الحل' : 'MTTR', color: 'primary' },
                    { icon: Clock, value: formatDuration(stats.mtfr, isAr), label: isAr ? 'متوسط أول رد' : 'MTFR', color: 'info' },
                    { icon: CheckCircle, value: stats.resolutionMet, label: isAr ? 'ملتزمة' : 'Met', color: 'success' },
                    { icon: ShieldAlert, value: stats.resolutionBreached, label: isAr ? 'متجاوزة' : 'Breached', color: 'destructive' },
                    { icon: AlertTriangle, value: stats.overdue, label: isAr ? 'متأخرة الآن' : 'Overdue Now', color: 'warning' },
                    { icon: Clock, value: stats.total, label: isAr ? 'إجمالي SLA' : 'Total SLA', color: 'primary' },
                  ].map((kpi, i) => (
                    <motion.div key={i} custom={i + 1} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardContent className="p-3 text-center">
                          <kpi.icon className={`h-4 w-4 mx-auto mb-1 text-${kpi.color}`} />
                          <p className="text-base font-bold leading-tight truncate">{kpi.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Charts row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader><CardTitle className="text-sm">{isAr ? 'الالتزام حسب الأولوية' : 'Compliance by Priority'}</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={stats.priorityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey={isAr ? 'الالتزام' : 'Compliance'} fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey={isAr ? 'التجاوز' : 'Breaches'} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {stats.serviceData.length > 0 && (
                    <motion.div custom={10} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardHeader><CardTitle className="text-sm">{isAr ? 'الالتزام حسب الخدمة' : 'Compliance by Service'}</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={stats.serviceData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                              <Bar dataKey={isAr ? 'الالتزام' : 'Compliance'} fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                {/* Charts row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {stats.deptData.length > 0 && (
                    <motion.div custom={11} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardHeader><CardTitle className="text-sm">{isAr ? 'الالتزام حسب القسم' : 'Compliance by Department'}</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={stats.deptData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                              <Bar dataKey={isAr ? 'الالتزام' : 'Compliance'} fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                              <Bar dataKey={isAr ? 'التجاوز' : 'Breaches'} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {stats.trend.length > 1 && (
                    <motion.div custom={12} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardHeader><CardTitle className="text-sm">{isAr ? 'اتجاه الالتزام بمرور الوقت' : 'Compliance Trend Over Time'}</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={stats.trend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                              <Line type="monotone" dataKey="compliance" name={isAr ? 'نسبة الالتزام %' : 'Compliance %'} stroke="hsl(142, 71%, 45%)" strokeWidth={2} />
                              <Line type="monotone" dataKey="breaches" name={isAr ? 'التجاوزات' : 'Breaches'} stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                {/* Top Breaching Agents */}
                {stats.topBreachingAgents.length > 0 && (
                  <motion.div custom={13} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4 text-destructive" />
                          {isAr ? 'الوكلاء الأكثر تجاوزاً للـ SLA' : 'Top Agents with SLA Breaches'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {stats.topBreachingAgents.map((agent, i) => (
                            <div key={i} className="p-3 rounded-xl bg-destructive/5 border border-destructive/15">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-bold shrink-0">
                                  {agent.name.charAt(0)}
                                </div>
                                <p className="text-sm font-medium truncate">{agent.name}</p>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                  {agent.breached}/{agent.total} {isAr ? 'تذكرة' : 'tickets'}
                                </span>
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                                  {agent.rate}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Breached Tickets Table */}
                {stats.breachedTickets.length > 0 && (
                  <motion.div custom={14} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-destructive" />
                          {isAr ? 'التذاكر المتجاوزة لـ SLA' : 'SLA Breached Tickets'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'الكود' : 'Code'}</TableHead>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'العنوان' : 'Title'}</TableHead>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'الأولوية' : 'Priority'}</TableHead>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'موعد SLA' : 'SLA Due'}</TableHead>
                                <TableHead className={isRTL ? 'text-right' : 'text-left'}>{isAr ? 'الخدمة' : 'Service'}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stats.breachedTickets.map((t: any) => (
                                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/tickets/${t.id}`}>
                                  <TableCell className="font-mono text-xs">#{t.ticket_number}</TableCell>
                                  <TableCell className="text-sm max-w-[200px] truncate">{t.title}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('text-[10px]',
                                      t.priority === 'urgent' ? 'bg-destructive/15 text-destructive' :
                                      t.priority === 'high' ? 'bg-warning/15 text-warning' : 'bg-muted'
                                    )}>
                                      {localizedPriority[t.priority] || t.priority}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{t.status}</TableCell>
                                  <TableCell className="text-xs text-destructive">{t.sla_resolution_due_at?.slice(0, 16)}</TableCell>
                                  <TableCell className="text-xs">{(t as any).services?.name || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
}
