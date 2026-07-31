import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchReportData, fetchTickets, fetchTicketStats, fetchDepartments } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Loader2, BarChart3, PieChart as PieIcon,
  Activity, Shield, Clock, AlertTriangle, CheckCircle2, Users, Calendar,
  ArrowRight, Lightbulb, Target, Zap, Download
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '@/components/DashboardCharts';

const COLORS = [
  'hsl(217, 72%, 50%)', 'hsl(152, 55%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)', 'hsl(199, 89%, 48%)', 'hsl(25, 95%, 53%)'
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const datePresets = [
  { label: '7 أيام', days: 7 },
  { label: '30 يوم', days: 30 },
  { label: '90 يوم', days: 90 },
];

export default function ExecutiveDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(30);
  const [deptFilter, setDeptFilter] = useState('all');

  const rangeFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dateRange);
    return d.toISOString().slice(0, 10);
  }, [dateRange]);
  const rangeTo = new Date().toISOString().slice(0, 10);

  // Previous period for comparison
  const prevFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dateRange * 2);
    return d.toISOString().slice(0, 10);
  }, [dateRange]);
  const prevTo = rangeFrom;

  const { data: report } = useQuery({
    queryKey: ['exec-report', rangeFrom, rangeTo],
    queryFn: () => fetchReportData({ from: rangeFrom, to: rangeTo }),
  });

  const { data: prevReport } = useQuery({
    queryKey: ['exec-report-prev', prevFrom, prevTo],
    queryFn: () => fetchReportData({ from: prevFrom, to: prevTo }),
  });

  const { data: stats } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: fetchTicketStats,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['ticket-forecast'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('forecast-tickets');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Derived data
  const trendData = useMemo(() => {
    if (!report?.rawTickets) return [];
    const map: Record<string, { date: string; created: number; resolved: number }> = {};
    report.rawTickets.forEach((t: any) => {
      const day = t.created_at?.slice(0, 10);
      if (!day) return;
      if (!map[day]) map[day] = { date: day, created: 0, resolved: 0 };
      map[day].created++;
      if (t.resolved_at) map[day].resolved++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [report]);

  const deptData = useMemo(() => {
    if (!report?.byDepartment) return [];
    return Object.entries(report.byDepartment)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [report]);

  const serviceData = useMemo(() => {
    if (!report?.byService) return [];
    return Object.entries(report.byService)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [report]);

  const statusPieData = useMemo(() => {
    if (!report?.byStatus) return [];
    const labels: Record<string, string> = {
      new: 'جديدة', open: 'مفتوحة', in_progress: 'قيد المعالجة',
      waiting_on_customer: 'بانتظار العميل', resolved: 'تم الحل', closed: 'مغلقة', reopened: 'معاد فتحها'
    };
    return Object.entries(report.byStatus)
      .map(([k, v]) => ({ name: labels[k] || k, value: v as number }))
      .filter(d => d.value > 0);
  }, [report]);

  const priorityData = useMemo(() => {
    if (!report?.byPriority) return [];
    const labels: Record<string, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' };
    return Object.entries(report.byPriority)
      .map(([k, v]) => ({ name: labels[k] || k, value: v as number }))
      .filter(d => d.value > 0);
  }, [report]);

  // Comparison metrics
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const totalChange = calcChange(report?.total || 0, prevReport?.total || 0);
  const slaChange = calcChange(report?.slaCompliancePercent || 0, prevReport?.slaCompliancePercent || 0);
  const avgResChange = calcChange(report?.avgResolutionHours || 0, prevReport?.avgResolutionHours || 0);

  // Forecast chart data
  const forecastChartData = useMemo(() => {
    if (!forecast) return [];
    const historical = (forecast.historical || []).slice(-14).map((h: any) => ({
      date: h.date,
      actual: h.count,
      predicted: null,
    }));
    const predicted = (forecast.forecast || []).map((f: any) => ({
      date: f.date,
      actual: null,
      predicted: f.predicted_count,
    }));
    return [...historical, ...predicted];
  }, [forecast]);

  const trendIcon = forecast?.trend_direction === 'increasing' ? TrendingUp :
    forecast?.trend_direction === 'decreasing' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;

  const unresolvedCount = (stats?.new ?? 0) + (stats?.open ?? 0) + (stats?.in_progress ?? 0) + (stats?.waiting_on_customer ?? 0) + (stats?.reopened ?? 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur-md px-4 gap-4 shrink-0 sticky top-0 z-30"
          >
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-bold text-foreground hidden sm:block">Dashboard تنفيذي</h1>
              <div className="flex gap-1">
                {datePresets.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setDateRange(p.days)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                      dateRange === p.days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportToCSV(report)}>
                <Download className="h-3.5 w-3.5" /> تصدير
              </Button>
              <NotificationsPopover />
            </div>
          </motion.header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl mx-auto">

              {/* KPI Row with Comparison */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <ComparisonKPI title="إجمالي التذاكر" value={report?.total || 0} change={totalChange} icon={BarChart3} />
                <ComparisonKPI title="غير محلولة" value={unresolvedCount} icon={AlertTriangle} color="text-warning" />
                <ComparisonKPI title="متأخرة (SLA)" value={report?.overdueCount || 0} icon={Shield} color="text-destructive" />
                <ComparisonKPI title="التزام SLA" value={`${report?.slaCompliancePercent || 0}%`} change={slaChange} icon={CheckCircle2} color="text-success" invertChange />
                <ComparisonKPI title="متوسط الحل" value={`${report?.avgResolutionHours || 0}h`} change={-avgResChange} icon={Clock} color="text-info" invertChange />
                <ComparisonKPI title="متوسط أول رد" value={`${report?.avgFirstResponseHours || 0}h`} icon={Zap} color="text-primary" />
              </div>

              {/* AI Forecast Section */}
              <motion.div variants={fadeUp}>
                <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      تنبؤات الذكاء الاصطناعي — حجم التذاكر
                    </CardTitle>
                    {forecast && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs gap-1">
                          <TrendIcon className="h-3 w-3" />
                          {forecast.trend_direction === 'increasing' ? 'اتجاه صاعد' :
                           forecast.trend_direction === 'decreasing' ? 'اتجاه هابط' : 'مستقر'}
                        </Badge>
                        {forecast.peak_day && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Calendar className="h-3 w-3" /> أعلى يوم: {forecast.peak_day}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {forecastLoading ? (
                      <div className="h-[200px] flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground mr-2">جاري التحليل...</span>
                      </div>
                    ) : forecastChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={forecastChartData}>
                          <defs>
                            <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Area type="monotone" dataKey="actual" name="فعلي" stroke="hsl(217, 72%, 50%)" fill="url(#gradActual)" strokeWidth={2} connectNulls={false} />
                          <Line type="monotone" dataKey="predicted" name="متوقع" stroke="hsl(280, 60%, 50%)" strokeWidth={2} strokeDasharray="5 5" connectNulls={false} dot={{ r: 4, fill: 'hsl(280, 60%, 50%)' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                        لا توجد بيانات كافية للتنبؤ
                      </div>
                    )}

                    {/* AI Insights */}
                    {forecast?.insights && forecast.insights.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {forecast.insights.slice(0, 3).map((insight: any, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-3 rounded-xl border text-sm ${
                              insight.type === 'warning' ? 'border-destructive/20 bg-destructive/5' :
                              insight.type === 'recommendation' ? 'border-success/20 bg-success/5' :
                              'border-primary/20 bg-primary/5'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {insight.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> :
                               insight.type === 'recommendation' ? <Lightbulb className="h-3.5 w-3.5 text-success" /> :
                               <TrendingUp className="h-3.5 w-3.5 text-primary" />}
                              <span className="text-xs font-semibold">{insight.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Trend Chart */}
                <motion.div variants={fadeUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        اتجاه التذاكر اليومي
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={trendData}>
                            <defs>
                              <linearGradient id="gradCreated2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gradResolved2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(152, 55%, 42%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(152, 55%, 42%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Area type="monotone" dataKey="created" name="تم إنشاؤها" stroke="hsl(217, 72%, 50%)" fill="url(#gradCreated2)" strokeWidth={2} />
                            <Area type="monotone" dataKey="resolved" name="تم حلها" stroke="hsl(152, 55%, 42%)" fill="url(#gradResolved2)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Status Pie */}
                <motion.div variants={fadeUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PieIcon className="h-4 w-4 text-primary" />
                        توزيع الحالات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {statusPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                              {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Department & Service Charts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div variants={fadeUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        حسب القسم
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {deptData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={deptData} layout="vertical">
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                            <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                            <Bar dataKey="value" name="التذاكر" radius={[0, 6, 6, 0]}>
                              {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4 text-warning" />
                        حسب الأولوية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {priorityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={priorityData} cx="50%" cy="50%" outerRadius={65}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <PolarRadiusAxis tick={{ fontSize: 9 }} />
                            <Radar name="التذاكر" dataKey="value" stroke="hsl(217, 72%, 50%)" fill="hsl(217, 72%, 50%)" fillOpacity={0.3} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-info" />
                        أكثر الخدمات طلباً
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {serviceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={serviceData}>
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                            <Bar dataKey="value" name="التذاكر" fill="hsl(199, 89%, 48%)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* SLA by Service */}
              {report?.slaByService && Object.keys(report.slaByService).length > 0 && (
                <motion.div variants={fadeUp}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        التزام SLA حسب الخدمة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={Object.entries(report.slaByService).map(([k, v]: [string, any]) => ({
                          name: k, compliance: v.compliance, breaches: v.breaches
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="compliance" name="الالتزام %" fill="hsl(152, 55%, 42%)" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="breaches" name="الخروقات" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Comparison KPI Card
function ComparisonKPI({ title, value, change, icon: Icon, color = 'text-primary', invertChange }: {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  color?: string;
  invertChange?: boolean;
}) {
  const isPositive = invertChange ? (change ?? 0) >= 0 : (change ?? 0) > 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-border/50 bg-card p-4 transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-xl bg-muted flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{title}</p>
    </motion.div>
  );
}
