import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Award, Star, Clock, CheckCircle, TrendingUp, Loader2, CalendarIcon, Download, ArrowUpDown, BarChart3, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, PieChart, Pie, Cell
} from 'recharts';

interface AgentStats {
  agent_id: string;
  name: string;
  resolved: number;
  avgResolutionHours: number;
  avgRating: number;
  ratingCount: number;
  assigned: number;
  inProgress: number;
  waitingOnCustomer: number;
  closed: number;
  firstResponseAvgHours: number;
}

async function fetchAgentPerformance(): Promise<{ agents: AgentStats[]; tickets: any[] }> {
  const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['agent', 'admin']);
  if (!roles?.length) return { agents: [], tickets: [] };

  const agentIds = roles.map(r => r.user_id);

  const [profilesRes, ticketsRes, ratingsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, department_id').in('id', agentIds),
    supabase.from('tickets').select('assigned_agent_id, status, created_at, resolved_at, first_response_at, priority').in('assigned_agent_id', agentIds),
    supabase.from('ticket_ratings').select('ticket_id, rating').then(async (res) => {
      if (!res.data?.length) return [];
      const ticketIds = res.data.map(r => r.ticket_id);
      const { data: tickets } = await supabase.from('tickets').select('id, assigned_agent_id').in('id', ticketIds);
      return res.data.map(r => ({
        ...r,
        agent_id: tickets?.find(t => t.id === r.ticket_id)?.assigned_agent_id,
      }));
    }),
  ]);

  const profiles = profilesRes.data || [];
  const tickets = ticketsRes.data || [];
  const ratings = ratingsRes || [];

  const agents = agentIds.map(id => {
    const profile = profiles.find(p => p.id === id);
    const name = profile?.full_name || 'غير معروف';
    const agentTickets = tickets.filter(t => t.assigned_agent_id === id);
    const resolved = agentTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
    const inProgress = agentTickets.filter(t => t.status === 'in_progress').length;
    const waitingOnCustomer = agentTickets.filter(t => t.status === 'waiting_on_customer').length;
    const closed = agentTickets.filter(t => t.status === 'closed').length;

    let totalMs = 0;
    resolved.forEach(t => { if (t.resolved_at) totalMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime(); });

    let totalFrMs = 0, frCount = 0;
    agentTickets.forEach(t => { if (t.first_response_at) { totalFrMs += new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime(); frCount++; } });

    const agentRatings = ratings.filter((r: any) => r.agent_id === id);
    const avgRating = agentRatings.length > 0 ? agentRatings.reduce((s: number, r: any) => s + r.rating, 0) / agentRatings.length : 0;

    return {
      agent_id: id, name,
      resolved: resolved.length,
      avgResolutionHours: resolved.length > 0 ? Math.round(totalMs / resolved.length / (1000 * 60 * 60) * 10) / 10 : 0,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingCount: agentRatings.length,
      assigned: agentTickets.length, inProgress, waitingOnCustomer, closed,
      firstResponseAvgHours: frCount > 0 ? Math.round(totalFrMs / frCount / (1000 * 60 * 60) * 10) / 10 : 0,
    };
  }).sort((a, b) => b.resolved - a.resolved);

  return { agents, tickets };
}

const medals = ['🥇', '🥈', '🥉'];
const CHART_COLORS = [
  'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)', 'hsl(190, 90%, 50%)',
];

export default function AgentPerformance() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [sortField, setSortField] = useState<keyof AgentStats>('resolved');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMetric, setFilterMetric] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: fetchAgentPerformance,
  });

  const agents = data?.agents || [];

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q));
    }
    if (filterMetric === 'top_rated') result = result.filter(a => a.avgRating >= 4);
    if (filterMetric === 'high_volume') result = result.filter(a => a.assigned >= 10);
    return [...result].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return 0;
    });
  }, [agents, search, filterMetric, sortField, sortAsc]);

  const toggleSort = (field: keyof AgentStats) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const comparisonData = useMemo(() => agents.map(a => ({
    name: a.name.split(' ')[0],
    [isAr ? 'محلولة' : 'Resolved']: a.resolved,
    [isAr ? 'متوسط الحل' : 'Avg Resolution']: a.avgResolutionHours,
    [isAr ? 'التقييم' : 'Rating']: a.avgRating,
  })), [agents, isAr]);

  const radarData = useMemo(() => {
    if (agents.length === 0) return [];
    const maxR = Math.max(...agents.map(a => a.resolved), 1);
    const maxA = Math.max(...agents.map(a => a.assigned), 1);
    const maxS = Math.max(...agents.map(a => a.avgResolutionHours), 1);
    return [
      { metric: isAr ? 'المحلولة' : 'Resolved', ...Object.fromEntries(agents.slice(0, 5).map(a => [a.name.split(' ')[0], Math.round(a.resolved / maxR * 100)])) },
      { metric: isAr ? 'المعيّنة' : 'Assigned', ...Object.fromEntries(agents.slice(0, 5).map(a => [a.name.split(' ')[0], Math.round(a.assigned / maxA * 100)])) },
      { metric: isAr ? 'التقييم' : 'Rating', ...Object.fromEntries(agents.slice(0, 5).map(a => [a.name.split(' ')[0], Math.round(a.avgRating / 5 * 100)])) },
      { metric: isAr ? 'سرعة الحل' : 'Speed', ...Object.fromEntries(agents.slice(0, 5).map(a => [a.name.split(' ')[0], maxS > 0 ? Math.round((1 - a.avgResolutionHours / maxS) * 100) : 50])) },
    ];
  }, [agents, isAr]);

  const workloadData = useMemo(() => agents.map((a, i) => ({
    name: a.name.split(' ')[0], value: a.assigned, fill: CHART_COLORS[i % CHART_COLORS.length],
  })), [agents]);

  const handleExportCSV = useCallback(() => {
    const headers = isAr
      ? ['الوكيل', 'المعيّنة', 'المحلولة', 'متوسط الحل (ساعة)', 'متوسط الرد (ساعة)', 'التقييم', 'عدد التقييمات']
      : ['Agent', 'Assigned', 'Resolved', 'Avg Resolution (h)', 'Avg Response (h)', 'Rating', 'Rating Count'];
    const rows = filteredAgents.map(a => [a.name, a.assigned, a.resolved, a.avgResolutionHours, a.firstResponseAvgHours, a.avgRating, a.ratingCount]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agent_performance_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  }, [filteredAgents, isAr]);

  const handleExportPDF = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html dir="${isAr ? 'rtl' : 'ltr'}"><head><title>${isAr ? 'تقرير أداء الوكلاء' : 'Agent Performance Report'}</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:30px}h1{color:#1a4b8c;border-bottom:2px solid #1a4b8c;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px;text-align:${isAr ? 'right' : 'left'}}th{background:#f0f4f8;color:#1a4b8c}tr:nth-child(even){background:#f9fafb}.footer{margin-top:30px;text-align:center;color:#888;font-size:12px}</style></head><body>
    <h1>📊 ${isAr ? 'تقرير أداء الوكلاء' : 'Agent Performance Report'}</h1>
    <table><thead><tr><th>#</th><th>${isAr ? 'الوكيل' : 'Agent'}</th><th>${isAr ? 'المعيّنة' : 'Assigned'}</th><th>${isAr ? 'المحلولة' : 'Resolved'}</th><th>${isAr ? 'متوسط الحل' : 'Avg Resolution'}</th><th>${isAr ? 'التقييم' : 'Rating'}</th></tr></thead>
    <tbody>${filteredAgents.map((a, i) => `<tr><td>${i < 3 ? medals[i] : i + 1}</td><td>${a.name}</td><td>${a.assigned}</td><td>${a.resolved}</td><td>${a.avgResolutionHours}h</td><td>${a.avgRating}</td></tr>`).join('')}</tbody></table>
    <div class="footer">${format(new Date(), 'dd MMMM yyyy - HH:mm', { locale: ar })}</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [filteredAgents, isAr]);

  const presets = [
    { label: isAr ? '7 أيام' : '7 days', days: 7 },
    { label: isAr ? '30 يوم' : '30 days', days: 30 },
    { label: isAr ? '90 يوم' : '90 days', days: 90 },
  ];

  return (
    <PageLayout>
      <PageHeader
        title={isAr ? 'أداء الوكلاء' : 'Agent Performance'}
        icon={<Award className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleExportPDF}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        }
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {presets.map(p => (
              <Button key={p.days} variant="outline" size="sm"
                className={cn("text-xs rounded-xl", dateFrom && Math.abs(subDays(new Date(), p.days).getTime() - dateFrom.getTime()) < 86400000 && "bg-primary text-primary-foreground")}
                onClick={() => { setDateFrom(subDays(new Date(), p.days)); setDateTo(new Date()); }}>
                {p.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl"><CalendarIcon className="h-3.5 w-3.5" />{dateFrom ? format(dateFrom, 'dd/MM/yyyy') : isAr ? 'من' : 'From'}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">{isAr ? 'إلى' : 'to'}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl"><CalendarIcon className="h-3.5 w-3.5" />{dateTo ? format(dateTo, 'dd/MM/yyyy') : isAr ? 'إلى' : 'To'}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <div className="flex-1" />
            <div className="relative min-w-[180px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={isAr ? 'بحث بالاسم...' : 'Search by name...'} className="ps-9 h-8 rounded-xl text-xs" />
            </div>
            <Select value={filterMetric} onValueChange={setFilterMetric}>
              <SelectTrigger className="w-36 h-8 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="top_rated">{isAr ? 'أعلى تقييم (4+)' : 'Top Rated (4+)'}</SelectItem>
                <SelectItem value="high_volume">{isAr ? 'حجم عالي (10+)' : 'High Volume (10+)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary KPIs */}
          {!isLoading && agents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { icon: Users, label: isAr ? 'الوكلاء' : 'Agents', value: agents.length, color: 'text-primary bg-primary/10' },
                { icon: CheckCircle, label: isAr ? 'المحلولة' : 'Resolved', value: agents.reduce((s, a) => s + a.resolved, 0), color: 'text-emerald-600 bg-emerald-500/10' },
                { icon: Clock, label: isAr ? 'أسرع حل' : 'Fastest', value: `${Math.min(...agents.filter(a => a.avgResolutionHours > 0).map(a => a.avgResolutionHours)) || 0}h`, color: 'text-blue-600 bg-blue-500/10' },
                { icon: Star, label: isAr ? 'أعلى تقييم' : 'Top Rating', value: Math.max(...agents.map(a => a.avgRating)) || 0, color: 'text-amber-600 bg-amber-500/10' },
                { icon: TrendingUp, label: isAr ? 'المعيّنة' : 'Assigned', value: agents.reduce((s, a) => s + a.assigned, 0), color: 'text-indigo-600 bg-indigo-500/10' },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className="rounded-2xl border-border/50">
                    <CardContent className="flex items-center gap-3 py-3">
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
          )}

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : agents.length === 0 ? (
            <Card><CardContent className="py-20 text-center text-muted-foreground">{isAr ? 'لا يوجد بيانات' : 'No data'}</CardContent></Card>
          ) : (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />{isAr ? 'مقارنة الأداء' : 'Performance Comparison'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey={isAr ? 'محلولة' : 'Resolved'} fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey={isAr ? 'متوسط الحل' : 'Avg Resolution'} fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey={isAr ? 'التقييم' : 'Rating'} fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{isAr ? 'توزيع الأعباء' : 'Workload Distribution'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={workloadData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {workloadData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Radar */}
              {agents.length >= 2 && (
                <Card className="rounded-2xl border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{isAr ? 'مقارنة شاملة (أفضل 5)' : 'Comprehensive Comparison (Top 5)'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis tick={false} domain={[0, 100]} />
                        {agents.slice(0, 5).map((a, i) => (
                          <Radar key={a.agent_id} name={a.name.split(' ')[0]} dataKey={a.name.split(' ')[0]}
                            stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                        ))}
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Table */}
              <Card className="rounded-2xl border-border/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-primary" />
                    {isAr ? 'جدول المقارنة التفصيلي' : 'Detailed Comparison'}
                    <span className="text-[10px] text-muted-foreground font-normal">({isAr ? 'اضغط للترتيب' : 'Click to sort'})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>{isAr ? 'الوكيل' : 'Agent'}</TableHead>
                          <SortableHead label={isAr ? 'المعيّنة' : 'Assigned'} field="assigned" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <SortableHead label={isAr ? 'المحلولة' : 'Resolved'} field="resolved" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <SortableHead label={isAr ? 'متوسط الحل' : 'Avg Res.'} field="avgResolutionHours" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <SortableHead label={isAr ? 'متوسط الرد' : 'Avg Resp.'} field="firstResponseAvgHours" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <SortableHead label={isAr ? 'التقييم' : 'Rating'} field="avgRating" current={sortField} asc={sortAsc} onSort={toggleSort} />
                          <TableHead className="text-center">{isAr ? 'الحالة' : 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAgents.map((agent, i) => (
                          <TableRow key={agent.agent_id} className={i < 3 ? 'bg-primary/5' : ''}>
                            <TableCell className="text-center text-lg">{i < 3 ? medals[i] : <span className="text-sm text-muted-foreground">{i + 1}</span>}</TableCell>
                            <TableCell className="font-semibold">{agent.name}</TableCell>
                            <TableCell className="text-center">{agent.assigned}</TableCell>
                            <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{agent.resolved}</TableCell>
                            <TableCell className="text-center">{agent.avgResolutionHours}h</TableCell>
                            <TableCell className="text-center">{agent.firstResponseAvgHours}h</TableCell>
                            <TableCell className="text-center">
                              {agent.avgRating > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  <span className="font-medium">{agent.avgRating}</span>
                                  <span className="text-[10px] text-muted-foreground">({agent.ratingCount})</span>
                                </div>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {agent.inProgress > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-indigo-500/10 text-indigo-600 border-0">{agent.inProgress} {isAr ? 'قيد المعالجة' : 'In Progress'}</Badge>}
                                {agent.waitingOnCustomer > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-500/10 text-orange-600 border-0">{agent.waitingOnCustomer} {isAr ? 'انتظار' : 'Waiting'}</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
}

function SortableHead({ label, field, current, asc, onSort }: {
  label: string; field: keyof AgentStats; current: keyof AgentStats; asc: boolean;
  onSort: (f: keyof AgentStats) => void;
}) {
  return (
    <TableHead className="text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => onSort(field)}>
      <div className="flex items-center justify-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", current === field ? "text-primary" : "text-muted-foreground/30")} />
      </div>
    </TableHead>
  );
}
