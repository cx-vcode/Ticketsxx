import { useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';
import { BarChart3, Download, PieChart as PieIcon, TrendingUp, Activity } from 'lucide-react';
import { TicketStatus } from '@/lib/api';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';

/* Navy blue professional palette */
const COLORS = [
  'hsl(217, 71%, 45%)',   /* primary navy */
  'hsl(210, 80%, 55%)',   /* accent blue */
  'hsl(199, 89%, 48%)',   /* sky blue */
  'hsl(158, 60%, 42%)',   /* success teal */
  'hsl(45, 93%, 47%)',    /* warning gold */
  'hsl(262, 52%, 50%)',   /* purple */
  'hsl(0, 62%, 50%)',     /* destructive red */
];

const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

interface DashboardChartsProps {
  report: any;
  trendData: Array<{ date: string; created: number; resolved: number }>;
}

export function exportToCSV(report: any, lang: string = 'ar') {
  if (!report?.rawTickets?.length) return;
  const headers = lang === 'ar'
    ? ['رقم التذكرة', 'العنوان', 'الحالة', 'الأولوية', 'القسم', 'النظام', 'الخدمة', 'تاريخ الإنشاء', 'تاريخ الحل', 'ساعات الحل']
    : ['Ticket #', 'Title', 'Status', 'Priority', 'Department', 'System', 'Service', 'Created', 'Resolved', 'Resolution Hours'];
  const rows = report.rawTickets.map((t: any) => [
    t.ticket_number, `"${t.title}"`, t.status, t.priority, t.department, t.system, t.service,
    t.created_at?.slice(0, 10), t.resolved_at?.slice(0, 10) || '', t.resolutionHours ?? ''
  ]);
  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tickets-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

export const DashboardCharts = memo(function DashboardCharts({ report, trendData }: DashboardChartsProps) {
  const { t, lang } = useLanguage();

  const statusLabelMap: Record<string, string> = {
    new: t.tickets.new,
    open: t.tickets.open,
    in_progress: t.tickets.inProgress,
    waiting_on_customer: t.tickets.waitingOnCustomer,
    resolved: t.tickets.resolved,
    closed: t.tickets.closed,
    reopened: t.tickets.reopened,
  };

  const priorityLabelMap: Record<string, string> = {
    low: t.tickets.priority.low,
    medium: t.tickets.priority.medium,
    high: t.tickets.priority.high,
    urgent: t.tickets.priority.urgent,
  };

  const copy = lang === 'ar' ? {
    trend: 'اتجاه التذاكر اليومي',
    exportCSV: 'تصدير CSV',
    created: 'تم إنشاؤها',
    resolved: 'تم حلها',
    noData: 'لا توجد بيانات',
    noDataPeriod: 'لا توجد بيانات في هذه الفترة',
    byStatus: 'حسب الحالة',
    byPriority: 'حسب الأولوية',
    bySource: 'حسب المصدر',
    tickets: 'التذاكر',
    slaByService: 'التزام SLA حسب الخدمة',
    compliancePercent: 'نسبة الالتزام %',
  } : {
    trend: 'Daily Ticket Trend',
    exportCSV: 'Export CSV',
    created: 'Created',
    resolved: 'Resolved',
    noData: 'No data',
    noDataPeriod: 'No data in this period',
    byStatus: 'By Status',
    byPriority: 'By Priority',
    bySource: 'By Source',
    tickets: 'Tickets',
    slaByService: 'SLA Compliance by Service',
    compliancePercent: 'Compliance %',
  };

  const statusPieData = useMemo(() => {
    if (!report?.byStatus) return [];
    return Object.entries(report.byStatus).map(([k, v]) => ({
      name: statusLabelMap[k] || k,
      value: v as number,
    })).filter(d => d.value > 0);
  }, [report, lang]);

  const sourceData = useMemo(() => {
    if (!report?.bySystem) return [];
    return Object.entries(report.bySystem).map(([k, v]) => ({
      name: k,
      value: v as number,
    })).filter(d => d.value > 0);
  }, [report]);

  const priorityData = useMemo(() => {
    if (!report?.byPriority) return [];
    return Object.entries(report.byPriority).map(([k, v]) => ({
      name: priorityLabelMap[k] || k,
      value: v as number,
    })).filter(d => d.value > 0);
  }, [report, lang]);

  const slaServiceData = useMemo(() => {
    if (!report?.slaByService) return [];
    return Object.entries(report.slaByService).map(([k, v]: [string, any]) => ({
      name: k,
      compliance: v.compliance,
      breaches: v.breaches,
    }));
  }, [report]);

  const tooltipStyle = {
    borderRadius: '12px',
    fontSize: '12px',
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 8px 32px hsl(220 30% 10% / 0.12)',
  };

  return (
    <motion.div className="space-y-4" variants={stagger} initial="hidden" animate="visible">
      {/* Trend Chart */}
      <motion.div variants={fadeUp}>
        <Card className="overflow-hidden border-border/40 shadow-card hover:shadow-card-hover transition-shadow duration-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2 font-semibold">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              {copy.trend}
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg border-border/50 hover:border-primary/30 transition-colors" onClick={() => exportToCSV(report, lang)}>
              <Download className="h-3.5 w-3.5" />
              {copy.exportCSV}
            </Button>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(158, 60%, 42%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(158, 60%, 42%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="created" name={copy.created} stroke="hsl(217, 71%, 45%)" fill="url(#gradCreated)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="resolved" name={copy.resolved} stroke="hsl(158, 60%, 42%)" fill="url(#gradResolved)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">{copy.noDataPeriod}</div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Row 2: Pie + Priority + Source */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeUp}>
          <Card className="h-full border-border/40 shadow-card hover:shadow-card-hover transition-shadow duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PieIcon className="h-3.5 w-3.5 text-primary" />
                </div>
                {copy.byStatus}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={42} strokeWidth={2} stroke="hsl(var(--card))">
                      {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{copy.noData}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full border-border/40 shadow-card hover:shadow-card-hover transition-shadow duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Activity className="h-3.5 w-3.5 text-warning" />
                </div>
                {copy.byPriority}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={priorityData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name={copy.tickets} radius={[0, 8, 8, 0]}>
                      {priorityData.map((_, i) => (
                        <Cell key={i} fill={['hsl(210, 80%, 55%)', 'hsl(45, 93%, 47%)', 'hsl(25, 95%, 53%)', 'hsl(0, 72%, 51%)'][i] || COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{copy.noData}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full border-border/40 shadow-card hover:shadow-card-hover transition-shadow duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                <div className="w-7 h-7 rounded-lg bg-info/10 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-info" />
                </div>
                {copy.bySource}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sourceData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name={copy.tickets} fill="hsl(210, 80%, 55%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{copy.noData}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* SLA by Service */}
      {slaServiceData.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-border/40 shadow-card hover:shadow-card-hover transition-shadow duration-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{copy.slaByService}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={slaServiceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="compliance" name={copy.compliancePercent} fill="hsl(217, 71%, 45%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
});
