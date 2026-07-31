import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, Ticket, fetchMyRatings } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, differenceInHours, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import {
  CalendarIcon, Ticket as TicketIcon, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  BarChart3, Timer, Loader2, Star
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

const STATUS_COLORS: Record<string, string> = {
  new: 'hsl(217, 91%, 60%)',
  open: 'hsl(38, 92%, 50%)',
  in_progress: 'hsl(239, 84%, 67%)',
  waiting_on_customer: 'hsl(25, 95%, 53%)',
  resolved: 'hsl(142, 71%, 45%)',
  closed: 'hsl(220, 9%, 46%)',
  reopened: 'hsl(0, 84%, 60%)',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'hsl(215, 20%, 65%)',
  medium: 'hsl(217, 91%, 60%)',
  high: 'hsl(38, 92%, 50%)',
  urgent: 'hsl(0, 84%, 60%)',
};

interface CustomerDashboardProps {
  onTicketClick: (ticket: Ticket) => void;
}

export function CustomerDashboard({ onTicketClick }: CustomerDashboardProps) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { statusLabels, priorityLabels } = useLocalizedLabels();
  const dateLocale = lang === 'ar' ? ar : enUS;
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: myRatings = [] } = useQuery({
    queryKey: ['my-ratings', user?.id],
    queryFn: () => fetchMyRatings(user!.id),
    enabled: !!user,
  });

  const avgRating = useMemo(() => {
    if (myRatings.length === 0) return 0;
    return Math.round(myRatings.reduce((sum, r) => sum + r.rating, 0) / myRatings.length * 10) / 10;
  }, [myRatings]);

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return tickets;
    return tickets.filter(t_item => {
      const d = parseISO(t_item.created_at);
      if (dateFrom && dateTo) return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
      if (dateFrom) return d >= startOfDay(dateFrom);
      if (dateTo) return d <= endOfDay(dateTo);
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  // KPIs
  const total = filtered.length;
  const active = filtered.filter(t_item => !['closed', 'resolved'].includes(t_item.status)).length;
  const resolved = filtered.filter(t_item => t_item.status === 'resolved').length;
  const closed = filtered.filter(t_item => t_item.status === 'closed').length;
  const urgent = filtered.filter(t_item => t_item.priority === 'urgent' || t_item.priority === 'high').length;

  const avgResolutionHours = useMemo(() => {
    const resolvedTickets = filtered.filter(t_item => t_item.resolved_at);
    if (resolvedTickets.length === 0) return 0;
    const totalHours = resolvedTickets.reduce((sum, t_item) => {
      return sum + differenceInHours(parseISO(t_item.resolved_at!), parseISO(t_item.created_at));
    }, 0);
    return Math.round(totalHours / resolvedTickets.length);
  }, [filtered]);

  // Status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t_item => { counts[t_item.status] = (counts[t_item.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: statusLabels[status as keyof typeof statusLabels] || status,
      value: count,
      fill: STATUS_COLORS[status] || 'hsl(220, 9%, 46%)',
    }));
  }, [filtered, statusLabels]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(t_item => { counts[t_item.priority] = (counts[t_item.priority] || 0) + 1; });
    return Object.entries(counts).map(([priority, count]) => ({
      name: priorityLabels[priority as keyof typeof priorityLabels] || priority,
      value: count,
      fill: PRIORITY_COLORS[priority] || 'hsl(220, 9%, 46%)',
    }));
  }, [filtered, priorityLabels]);

  // Timeline (tickets per day)
  const timelineData = useMemo(() => {
    const days: Record<string, { created: number; resolved: number }> = {};
    filtered.forEach(t_item => {
      const day = format(parseISO(t_item.created_at), 'MM/dd');
      if (!days[day]) days[day] = { created: 0, resolved: 0 };
      days[day].created++;
    });
    filtered.filter(t_item => t_item.resolved_at).forEach(t_item => {
      const day = format(parseISO(t_item.resolved_at!), 'MM/dd');
      if (!days[day]) days[day] = { created: 0, resolved: 0 };
      days[day].resolved++;
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  }, [filtered]);

  // Recent tickets
  const recentTickets = useMemo(() =>
    [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [filtered]
  );

  const presets = [
    { label: t.portal.last7Days, days: 7 },
    { label: t.portal.last30Days, days: 30 },
    { label: t.portal.last90Days, days: 90 },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.portal.dashboardTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.portal.dashboardSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {presets.map(p => (
            <Button
              key={p.days}
              variant="outline"
              size="sm"
              className={cn("text-xs", dateFrom && Math.abs(subDays(new Date(), p.days).getTime() - dateFrom.getTime()) < 86400000 && "bg-primary text-primary-foreground")}
              onClick={() => { setDateFrom(subDays(new Date(), p.days)); setDateTo(new Date()); }}
            >
              {p.label}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t.common.from}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-xs">{t.common.to}</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : t.common.to}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title={t.portal.totalTickets} value={total} icon={<TicketIcon className="h-5 w-5" />} color="text-primary" bgColor="bg-primary/10" />
        <KpiCard title={t.portal.active} value={active} icon={<Clock className="h-5 w-5" />} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-500/10" />
        <KpiCard title={t.portal.resolvedLabel} value={resolved} icon={<CheckCircle2 className="h-5 w-5" />} color="text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-500/10" />
        <KpiCard title={t.portal.closed} value={closed} icon={<CheckCircle2 className="h-5 w-5" />} color="text-muted-foreground" bgColor="bg-muted" />
        <KpiCard title={t.portal.highUrgent} value={urgent} icon={<AlertTriangle className="h-5 w-5" />} color="text-red-600 dark:text-red-400" bgColor="bg-red-500/10" />
        <KpiCard title={t.portal.avgResolutionHours} value={avgResolutionHours} icon={<Timer className="h-5 w-5" />} color="text-indigo-600 dark:text-indigo-400" bgColor="bg-indigo-500/10" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline Chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t.portal.ticketTrends}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t.portal.noDataPeriod}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="created" name={t.portal.created} stroke="hsl(217, 91%, 60%)" fill="url(#colorCreated)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name={t.portal.resolvedLabel} stroke="hsl(142, 71%, 45%)" fill="url(#colorResolved)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t.portal.statusDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t.portal.noData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority Bar + Recent Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Priority Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              {t.portal.priorityDistribution}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t.portal.noData}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priorityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" name={t.portal.count} radius={[0, 6, 6, 0]}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {t.portal.recentTickets}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t.portal.noTickets}</p>
            ) : (
              <div className="divide-y divide-border">
                {recentTickets.map((ticket, i) => (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onTicketClick(ticket)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{ticket.code}</span>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0", getStatusBg(ticket.status))}>
                          {statusLabels[ticket.status]}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0", getPriorityBg(ticket.priority))}>
                          {priorityLabels[ticket.priority]}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(parseISO(ticket.created_at), 'dd MMM', { locale: dateLocale })}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CSAT Widget */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            {t.portal.csatTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground">{avgRating || '—'}</p>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={cn("h-4 w-4", s <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{t.portal.outOf5}</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = myRatings.filter(r => r.rating === star).length;
                const pct = myRatings.length > 0 ? (count / myRatings.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-3">{star}</span>
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-5 ltr:text-left rtl:text-right">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{myRatings.length}</p>
              <p className="text-[11px] text-muted-foreground">{t.portal.ratingsCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, icon, color, bgColor }: { title: string; value: number; icon: React.ReactNode; color: string; bgColor: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgColor, color)}>
              {icon}
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{title}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function getStatusBg(status: string) {
  const map: Record<string, string> = {
    new: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    open: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    in_progress: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    waiting_on_customer: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    closed: 'bg-muted text-muted-foreground',
    reopened: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  };
  return map[status] || '';
}

function getPriorityBg(priority: string) {
  const map: Record<string, string> = {
    low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
    medium: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    high: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    urgent: 'bg-red-500/15 text-red-600 dark:text-red-300',
  };
  return map[priority] || '';
}
