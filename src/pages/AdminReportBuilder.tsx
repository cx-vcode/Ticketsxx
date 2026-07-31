import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/i18n';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  BarChart3, PieChart, LineChart, TrendingUp, Download, Plus, Play,
  Filter, Columns, Calendar, Save, Share2, Sparkles, RefreshCw,
  Table2, LayoutGrid, ArrowUpDown, Clock, Users, Ticket, AlertTriangle,
  CheckCircle, XCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartPie, Pie, Cell, LineChart as RechartLine, Line, Area, AreaChart } from 'recharts';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
];

const metricOptions = [
  { id: 'tickets_by_status', label_ar: 'التذاكر حسب الحالة', label_en: 'Tickets by Status', icon: Ticket },
  { id: 'tickets_by_priority', label_ar: 'التذاكر حسب الأولوية', label_en: 'Tickets by Priority', icon: AlertTriangle },
  { id: 'tickets_by_department', label_ar: 'التذاكر حسب القسم', label_en: 'Tickets by Department', icon: Users },
  { id: 'tickets_over_time', label_ar: 'التذاكر عبر الزمن', label_en: 'Tickets Over Time', icon: TrendingUp },
  { id: 'resolution_time', label_ar: 'وقت الحل', label_en: 'Resolution Time', icon: Clock },
  { id: 'agent_performance', label_ar: 'أداء الوكلاء', label_en: 'Agent Performance', icon: Users },
  { id: 'sla_compliance', label_ar: 'الالتزام بـ SLA', label_en: 'SLA Compliance', icon: CheckCircle },
];

export default function AdminReportBuilder() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [reportName, setReportName] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['tickets_by_status', 'tickets_by_priority']);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'area'>('bar');
  const [dateRange, setDateRange] = useState('30d');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch real data
  const { data: ticketStats } = useQuery({
    queryKey: ['report-builder-stats', dateRange],
    queryFn: async () => {
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      const since = new Date(Date.now() - daysAgo * 86400000).toISOString();

      const { data: tickets } = await supabase
        .from('tickets')
        .select('status, priority, department_id, created_at, resolved_at, assigned_agent_id, departments(name), agent:profiles!tickets_assigned_agent_id_fkey(full_name)')
        .gte('created_at', since);

      return tickets || [];
    },
  });

  const getChartData = useCallback((metricId: string) => {
    if (!ticketStats) return [];
    switch (metricId) {
      case 'tickets_by_status': {
        const counts: Record<string, number> = {};
        ticketStats.forEach((t: any) => { counts[t.status] = (counts[t.status] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      }
      case 'tickets_by_priority': {
        const counts: Record<string, number> = {};
        ticketStats.forEach((t: any) => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      }
      case 'tickets_by_department': {
        const counts: Record<string, number> = {};
        ticketStats.forEach((t: any) => {
          const dept = (t.departments as any)?.name || 'Unassigned';
          counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      }
      case 'tickets_over_time': {
        const daily: Record<string, number> = {};
        ticketStats.forEach((t: any) => {
          const day = t.created_at.slice(0, 10);
          daily[day] = (daily[day] || 0) + 1;
        });
        return Object.entries(daily).sort().slice(-14).map(([name, value]) => ({ name: name.slice(5), value }));
      }
      case 'agent_performance': {
        const counts: Record<string, number> = {};
        ticketStats.forEach((t: any) => {
          const agent = (t.agent as any)?.full_name || 'Unassigned';
          counts[agent] = (counts[agent] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
      }
      default:
        return [];
    }
  }, [ticketStats]);

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success(isAr ? 'تم إنشاء التقرير بنجاح' : 'Report generated successfully');
    }, 1500);
  };

  const renderChart = (data: any[], type: string) => {
    if (!data.length) return <p className="text-center text-sm text-muted-foreground py-8">{isAr ? 'لا توجد بيانات' : 'No data'}</p>;

    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <RechartPie>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </RechartPie>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <RechartLine data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
            </RechartLine>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Area type="monotone" dataKey="value" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <PageLayout>
      <PageHeader title={isAr ? 'منشئ التقارير المخصصة' : 'Custom Report Builder'} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }} className="max-w-7xl mx-auto space-y-6">

          {/* Builder Controls */}
          <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border/50 shadow-card overflow-hidden">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {isAr ? 'إعدادات التقرير' : 'Report Configuration'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{isAr ? 'اسم التقرير' : 'Report Name'}</Label>
                    <Input
                      value={reportName}
                      onChange={e => setReportName(e.target.value)}
                      placeholder={isAr ? 'مثال: تقرير شهري' : 'e.g. Monthly Report'}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{isAr ? 'الفترة الزمنية' : 'Date Range'}</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">{isAr ? 'آخر 7 أيام' : 'Last 7 days'}</SelectItem>
                        <SelectItem value="30d">{isAr ? 'آخر 30 يوم' : 'Last 30 days'}</SelectItem>
                        <SelectItem value="90d">{isAr ? 'آخر 90 يوم' : 'Last 90 days'}</SelectItem>
                        <SelectItem value="1y">{isAr ? 'آخر سنة' : 'Last year'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{isAr ? 'نوع الرسم' : 'Chart Type'}</Label>
                    <div className="flex gap-2">
                      {[
                        { type: 'bar' as const, icon: BarChart3 },
                        { type: 'pie' as const, icon: PieChart },
                        { type: 'line' as const, icon: LineChart },
                        { type: 'area' as const, icon: TrendingUp },
                      ].map(ct => (
                        <Button
                          key={ct.type}
                          variant={chartType === ct.type ? 'default' : 'outline'}
                          size="icon"
                          className="rounded-xl h-9 w-9"
                          onClick={() => setChartType(ct.type)}
                        >
                          <ct.icon className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Metric Selection */}
                <div className="space-y-2">
                  <Label className="text-xs">{isAr ? 'المقاييس المطلوبة' : 'Select Metrics'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {metricOptions.map(m => (
                      <button
                        key={m.id}
                        onClick={() => toggleMetric(m.id)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all duration-200 ${
                          selectedMetrics.includes(m.id)
                            ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        <m.icon className="h-3.5 w-3.5" />
                        {isAr ? m.label_ar : m.label_en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                    <Save className="h-3.5 w-3.5" />
                    {isAr ? 'حفظ القالب' : 'Save Template'}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                    <Download className="h-3.5 w-3.5" />
                    {isAr ? 'تصدير PDF' : 'Export PDF'}
                  </Button>
                  <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {isAr ? 'إنشاء التقرير' : 'Generate Report'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {selectedMetrics.map((metricId, i) => {
              const metric = metricOptions.find(m => m.id === metricId);
              if (!metric) return null;
              const data = getChartData(metricId);
              return (
                <motion.div
                  key={metricId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                    <CardHeader className="pb-2 border-b border-border/40">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <metric.icon className="h-4 w-4 text-primary" />
                        {isAr ? metric.label_ar : metric.label_en}
                        <Badge variant="outline" className="text-[9px] ms-auto">{data.length} {isAr ? 'عنصر' : 'items'}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {renderChart(data, metricId === 'tickets_over_time' ? 'area' : chartType)}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Data Table */}
          {selectedMetrics.length > 0 && ticketStats && ticketStats.length > 0 && (
            <motion.div variants={fadeUp}>
              <Card className="rounded-2xl border-border/50 shadow-card overflow-hidden">
                <CardHeader className="border-b border-border/40">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-primary" />
                    {isAr ? 'البيانات التفصيلية' : 'Detailed Data'}
                    <Badge variant="outline" className="text-[9px] ms-auto">{ticketStats.length} {isAr ? 'تذكرة' : 'tickets'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr>
                          <th className="text-start p-3 font-semibold text-muted-foreground">{isAr ? 'الحالة' : 'Status'}</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground">{isAr ? 'الأولوية' : 'Priority'}</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground">{isAr ? 'القسم' : 'Department'}</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground">{isAr ? 'الوكيل' : 'Agent'}</th>
                          <th className="text-start p-3 font-semibold text-muted-foreground">{isAr ? 'التاريخ' : 'Date'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {ticketStats.slice(0, 20).map((t: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3">{t.status}</td>
                            <td className="p-3">{t.priority}</td>
                            <td className="p-3">{(t.departments as any)?.name || '—'}</td>
                            <td className="p-3">{(t.agent as any)?.full_name || '—'}</td>
                            <td className="p-3">{t.created_at?.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>
    </PageLayout>
  );
}
