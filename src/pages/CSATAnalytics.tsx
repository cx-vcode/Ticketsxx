import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer } from '@/components/layout';
import { EmptyState, ErrorState, AdminTableSkeleton } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Star, Download, Smile, Meh, Frown, CalendarDays, Filter, Users, MessageSquare,
  ThumbsUp, ThumbsDown, Minus, TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { useLanguage } from '@/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, Legend, Cell, AreaChart, Area, PieChart, Pie,
} from 'recharts';

const COLORS = ['hsl(0, 84%, 60%)', 'hsl(25, 95%, 53%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

async function fetchCSATData() {
  const [ratingsRes, ticketsRes, profilesRes] = await Promise.all([
    supabase.from('ticket_ratings').select('id, rating, feedback, created_at, ticket_id, user_id'),
    supabase.from('tickets').select('id, ticket_number, title, assigned_agent_id, service_id, created_at, services(name, systems(name))'),
    supabase.from('profiles').select('id, full_name'),
  ]);
  if (ratingsRes.error) throw ratingsRes.error;
  return {
    ratings: ratingsRes.data || [],
    tickets: ticketsRes.data || [],
    profiles: profilesRes.data || [],
  };
}

export default function CSATAnalytics() {
  const { lang, isRTL } = useLanguage();
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

  const STAR_LABELS = useMemo(() => isAr
    ? ['⭐ سيء جداً', '⭐⭐ سيء', '⭐⭐⭐ مقبول', '⭐⭐⭐⭐ جيد', '⭐⭐⭐⭐⭐ ممتاز']
    : ['⭐ Very Bad', '⭐⭐ Bad', '⭐⭐⭐ OK', '⭐⭐⭐⭐ Good', '⭐⭐⭐⭐⭐ Excellent'],
  [isAr]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['csat-analytics'],
    queryFn: fetchCSATData,
  });

  const applyPreset = (preset: typeof datePresets[0]) => {
    const val = preset.getValue();
    setDateFrom(val.from);
    setDateTo(val.to);
    setActivePreset(preset.label);
  };

  const filteredRatings = useMemo(() => {
    if (!data) return [];
    return data.ratings.filter((r: any) => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(r.created_at);
      if (dateFrom && d < startOfDay(new Date(dateFrom))) return false;
      if (dateTo && d > endOfDay(new Date(dateTo))) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const stats = useMemo(() => {
    if (filteredRatings.length === 0) return null;

    const total = filteredRatings.length;
    const avgRating = filteredRatings.reduce((s: number, r: any) => s + r.rating, 0) / total;
    const distribution = [0, 0, 0, 0, 0];
    filteredRatings.forEach((r: any) => { distribution[r.rating - 1]++; });
    const withFeedback = filteredRatings.filter((r: any) => r.feedback?.trim()).length;
    const satisfied = filteredRatings.filter((r: any) => r.rating >= 4).length;
    const csatPercent = Math.round((satisfied / total) * 100);

    // NPS-style: Promoters (5★) / Passives (4★) / Detractors (1-3★)
    const promoters = filteredRatings.filter((r: any) => r.rating === 5).length;
    const passives = filteredRatings.filter((r: any) => r.rating === 4).length;
    const detractors = filteredRatings.filter((r: any) => r.rating <= 3).length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

    // Trend
    const trendMap: Record<string, { date: string; avg: number; count: number; total: number }> = {};
    filteredRatings.forEach((r: any) => {
      const day = r.created_at?.slice(0, 10);
      if (!day) return;
      if (!trendMap[day]) trendMap[day] = { date: day, avg: 0, count: 0, total: 0 };
      trendMap[day].count++;
      trendMap[day].total += r.rating;
    });
    Object.values(trendMap).forEach(d => { d.avg = Math.round((d.total / d.count) * 10) / 10; });
    const trend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    // Agent breakdown
    const agentMap: Record<string, { name: string; total: number; count: number; ratings: number[] }> = {};
    filteredRatings.forEach((r: any) => {
      const ticket = data?.tickets.find((t: any) => t.id === r.ticket_id);
      const agentId = ticket?.assigned_agent_id;
      if (!agentId) return;
      if (!agentMap[agentId]) {
        const name = data?.profiles.find((p: any) => p.id === agentId)?.full_name || (isAr ? 'غير معروف' : 'Unknown');
        agentMap[agentId] = { name, total: 0, count: 0, ratings: [] };
      }
      agentMap[agentId].total += r.rating;
      agentMap[agentId].count++;
      agentMap[agentId].ratings.push(r.rating);
    });
    const agentStats = Object.values(agentMap)
      .map(a => ({ ...a, avg: Math.round((a.total / a.count) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);

    // Service breakdown
    const serviceMap: Record<string, { name: string; total: number; count: number }> = {};
    filteredRatings.forEach((r: any) => {
      const ticket = data?.tickets.find((t: any) => t.id === r.ticket_id);
      const svc = (ticket as any)?.services;
      const svcName = svc ? `${svc.systems?.name || ''} → ${svc.name}` : (isAr ? 'غير محدد' : 'Unspecified');
      if (!serviceMap[svcName]) serviceMap[svcName] = { name: svcName, total: 0, count: 0 };
      serviceMap[svcName].total += r.rating;
      serviceMap[svcName].count++;
    });
    const serviceStats = Object.values(serviceMap)
      .map(s => ({ ...s, avg: Math.round((s.total / s.count) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);

    return { total, avgRating: Math.round(avgRating * 10) / 10, distribution, withFeedback, csatPercent, trend, agentStats, serviceStats, promoters, passives, detractors, nps };
  }, [filteredRatings, data, isAr]);

  const handleExportCSV = () => {
    if (!filteredRatings.length) return;
    const headers = isAr
      ? ['التقييم', 'الملاحظات', 'التاريخ', 'رقم التذكرة']
      : ['Rating', 'Feedback', 'Date', 'Ticket #'];
    const rows = filteredRatings.map((r: any) => {
      const ticket = data?.tickets.find((t: any) => t.id === r.ticket_id);
      return [r.rating, `"${(r.feedback || '').replace(/"/g, '""')}"`, r.created_at?.slice(0, 10), ticket?.ticket_number || ''];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `csat-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const distributionData = stats?.distribution.map((count, i) => ({
    name: `${i + 1}★`,
    value: count,
    label: STAR_LABELS[i],
  })) || [];

  const npsData = stats ? [
    { name: isAr ? 'مروّجون' : 'Promoters', value: stats.promoters, color: 'hsl(142, 71%, 45%)' },
    { name: isAr ? 'محايدون' : 'Passives', value: stats.passives, color: 'hsl(38, 92%, 50%)' },
    { name: isAr ? 'منتقدون' : 'Detractors', value: stats.detractors, color: 'hsl(0, 84%, 60%)' },
  ] : [];

  return (
    <PageLayout>
      <PageHeader
        title={isAr ? 'تحليلات رضا العملاء (CSAT)' : 'Customer Satisfaction Analytics (CSAT)'}
        icon={<Star className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleExportCSV} disabled={!filteredRatings.length}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </Button>
        }
      />
      <PageContainer maxWidth="lg">
        {isLoading ? (
          <AdminTableSkeleton rows={4} cols={4} kpiCount={4} showToolbar />
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

            {!stats || stats.total === 0 ? (
              <EmptyState
                icon={Star}
                title={isAr ? 'لا توجد تقييمات في هذه الفترة' : 'No ratings in this period'}
                description={isAr ? 'جرّب توسيع نطاق الفترة الزمنية لرؤية تقييمات العملاء.' : 'Try expanding the time range to see customer ratings.'}
              />
            ) : (
              <>
                {/* KPI Strip — including NPS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                  {[
                    { icon: Star, value: stats.avgRating, label: isAr ? 'متوسط التقييم' : 'Avg Rating', color: 'text-primary', bg: 'bg-primary/10' },
                    { icon: stats.csatPercent >= 70 ? Smile : stats.csatPercent >= 40 ? Meh : Frown, value: `${stats.csatPercent}%`, label: isAr ? 'نسبة الرضا (CSAT)' : 'CSAT', color: stats.csatPercent >= 70 ? 'text-success' : stats.csatPercent >= 40 ? 'text-warning' : 'text-destructive', bg: stats.csatPercent >= 70 ? 'bg-success/10' : stats.csatPercent >= 40 ? 'bg-warning/10' : 'bg-destructive/10' },
                    { icon: TrendingUp, value: stats.nps, label: isAr ? 'مؤشر NPS' : 'NPS Score', color: stats.nps >= 50 ? 'text-success' : stats.nps >= 0 ? 'text-warning' : 'text-destructive', bg: stats.nps >= 50 ? 'bg-success/10' : stats.nps >= 0 ? 'bg-warning/10' : 'bg-destructive/10' },
                    { icon: MessageSquare, value: stats.total, label: isAr ? 'إجمالي التقييمات' : 'Total Ratings', color: 'text-info', bg: 'bg-info/10' },
                    { icon: Users, value: stats.withFeedback, label: isAr ? 'مع ملاحظات' : 'With Feedback', color: 'text-accent', bg: 'bg-accent/10' },
                  ].map((kpi, i) => (
                    <motion.div key={i} custom={i + 1} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg}`}>
                            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-bold truncate">{kpi.value}</p>
                            <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* NPS Breakdown */}
                <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
                  <Card className="rounded-2xl border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {isAr ? 'تحليل NPS — تصنيف المروّجين والمنتقدين' : 'NPS Analysis — Promoters & Detractors'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {[
                          { icon: ThumbsUp, label: isAr ? 'مروّجون (5★)' : 'Promoters (5★)', value: stats.promoters, pct: Math.round((stats.promoters / stats.total) * 100), color: 'success' },
                          { icon: Minus, label: isAr ? 'محايدون (4★)' : 'Passives (4★)', value: stats.passives, pct: Math.round((stats.passives / stats.total) * 100), color: 'warning' },
                          { icon: ThumbsDown, label: isAr ? 'منتقدون (1-3★)' : 'Detractors (1-3★)', value: stats.detractors, pct: Math.round((stats.detractors / stats.total) * 100), color: 'destructive' },
                        ].map((cat, i) => (
                          <div key={i} className={`p-4 rounded-2xl border bg-${cat.color}/5 border-${cat.color}/20`}>
                            <div className="flex items-center justify-between mb-2">
                              <cat.icon className={`h-5 w-5 text-${cat.color}`} />
                              <Badge variant="outline" className={`text-[10px] bg-${cat.color}/10 text-${cat.color} border-${cat.color}/20`}>
                                {cat.pct}%
                              </Badge>
                            </div>
                            <p className="text-2xl font-bold">{cat.value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{cat.label}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Rating Distribution */}
                  <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader><CardTitle className="text-sm">{isAr ? 'توزيع التقييمات' : 'Rating Distribution'}</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={distributionData}>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                            <Bar dataKey="value" name={isAr ? 'عدد التقييمات' : 'Count'} radius={[6, 6, 0, 0]}>
                              {distributionData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* NPS Pie */}
                  <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader><CardTitle className="text-sm">{isAr ? 'توزيع المروّجين/المحايدين/المنتقدين' : 'Promoters / Passives / Detractors'}</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie data={npsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                              {npsData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* CSAT Trend */}
                {stats.trend.length > 1 && (
                  <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader><CardTitle className="text-sm">{isAr ? 'اتجاه التقييمات بمرور الوقت' : 'Rating Trend Over Time'}</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={stats.trend}>
                            <defs>
                              <linearGradient id="gradCsat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(217, 72%, 50%)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 5]} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Area type="monotone" dataKey="avg" name={isAr ? 'متوسط التقييم' : 'Avg Rating'} stroke="hsl(217, 72%, 50%)" fill="url(#gradCsat)" strokeWidth={2} />
                            <Line type="monotone" dataKey="count" name={isAr ? 'عدد التقييمات' : 'Count'} stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Agent & Service Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {stats.agentStats.length > 0 && (
                    <motion.div custom={10} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{isAr ? 'تقييم الوكلاء' : 'Agent Ratings'}</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-3 max-h-[350px] overflow-auto">
                            {stats.agentStats.map((agent, i) => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                    {agent.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{agent.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{agent.count} {isAr ? 'تقييم' : 'ratings'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, si) => (
                                      <Star key={si} className={cn('h-3 w-3', si < Math.round(agent.avg) ? 'text-primary fill-primary' : 'text-muted')} />
                                    ))}
                                  </div>
                                  <Badge variant="outline" className={cn('text-xs', agent.avg >= 4 ? 'bg-success/15 text-success' : agent.avg >= 3 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive')}>
                                    {agent.avg}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {stats.serviceStats.length > 0 && (
                    <motion.div custom={11} variants={fadeUp} initial="hidden" animate="show">
                      <Card className="rounded-2xl border-border/50">
                        <CardHeader><CardTitle className="text-sm">{isAr ? 'تقييم حسب الخدمة' : 'Ratings by Service'}</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={Math.max(200, stats.serviceStats.length * 45)}>
                            <BarChart data={stats.serviceStats} layout="vertical">
                              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                              <Bar dataKey="avg" name={isAr ? 'متوسط التقييم' : 'Avg'} fill="hsl(217, 72%, 50%)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                {/* Recent Feedback */}
                {filteredRatings.filter((r: any) => r.feedback?.trim()).length > 0 && (
                  <motion.div custom={12} variants={fadeUp} initial="hidden" animate="show">
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader><CardTitle className="text-sm">{isAr ? 'آخر الملاحظات' : 'Latest Feedback'}</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-[300px] overflow-auto">
                          {filteredRatings
                            .filter((r: any) => r.feedback?.trim())
                            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .slice(0, 20)
                            .map((r: any) => {
                              const ticket = data?.tickets.find((t: any) => t.id === r.ticket_id);
                              return (
                                <div key={r.id} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={cn('h-3 w-3', i < r.rating ? 'text-primary fill-primary' : 'text-muted')} />
                                      ))}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{r.created_at?.slice(0, 10)}</span>
                                  </div>
                                  <p className="text-sm">{r.feedback}</p>
                                  {ticket && <p className="text-[10px] text-muted-foreground mt-1">{isAr ? 'تذكرة' : 'Ticket'} #{ticket.ticket_number}: {ticket.title}</p>}
                                </div>
                              );
                            })}
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
