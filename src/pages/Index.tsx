import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchTicketStats, fetchDepartments, fetchReportData, TicketStatus } from '@/lib/api';
import { PageLayout, PageHeader } from '@/components/layout';
import { TicketListItem } from '@/components/TicketListItem';
import { Input } from '@/components/ui/input';
import {
  Inbox, Clock, CheckCircle2, AlertTriangle, Search, Plus,
  Users, BarChart3, Shield, Timer, TrendingUp, BookOpen,
  Zap, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';
import { DashboardSkeleton } from '@/components/SkeletonLoaders';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardCharts } from '@/components/DashboardCharts';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { useLanguage } from '@/i18n';
import { DashboardKPICards } from '@/components/dashboard/DashboardKPICards';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { DashboardQuickActions } from '@/components/dashboard/DashboardQuickActions';
import { DashboardTicketList } from '@/components/dashboard/DashboardTicketList';
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed';
import { AICopilotWidget } from '@/components/dashboard/AICopilotWidget';
import { SystemHealthWidget } from '@/components/dashboard/SystemHealthWidget';
import { EscalationMatrix } from '@/components/dashboard/EscalationMatrix';

export default function Dashboard() {
  const { role, profile } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState(7);

  useRealtimeTickets();

  const datePresets = [
    { label: t.dashboard.last7Days, days: 7 },
    { label: t.dashboard.last30Days, days: 30 },
    { label: t.dashboard.last90Days, days: 90 },
  ];

  const rangeFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dateRange);
    return d.toISOString().slice(0, 10);
  }, [dateRange]);
  const rangeTo = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: stats } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: fetchTicketStats,
  });

  const { data: report } = useQuery({
    queryKey: ['reports', rangeFrom, rangeTo],
    queryFn: () => fetchReportData({ from: rangeFrom, to: rangeTo }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesSearch = !searchQuery || ticket.title.includes(searchQuery) || ticket.ticket_number.toString().includes(searchQuery);
    const matchesDept = deptFilter === 'all' || ticket.department_id === deptFilter;
    return matchesStatus && matchesSearch && matchesDept;
  });

  const unresolvedCount = (stats?.new ?? 0) + (stats?.open ?? 0) + (stats?.in_progress ?? 0) + (stats?.waiting_on_customer ?? 0) + (stats?.reopened ?? 0);
  const pendingCount = (stats?.new ?? 0) + (stats?.waiting_on_customer ?? 0);

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

  const isAdmin = role === 'admin' || role === 'agent' || role === 'developer';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '☀️ ' + (lang === 'ar' ? 'صباح الخير' : 'Good Morning') 
    : hour < 18 ? '🌤️ ' + (lang === 'ar' ? 'مساء الخير' : 'Good Afternoon') 
    : '🌙 ' + (lang === 'ar' ? 'مساء الخير' : 'Good Evening');

  const statusFilters: { label: string; value: TicketStatus | 'all' }[] = [
    { label: t.common.all, value: 'all' },
    { label: t.tickets.new, value: 'new' },
    { label: t.tickets.open, value: 'open' },
    { label: t.tickets.inProgress, value: 'in_progress' },
    { label: t.tickets.waitingOnCustomer, value: 'waiting_on_customer' },
    { label: t.tickets.resolved, value: 'resolved' },
    { label: t.tickets.closed, value: 'closed' },
  ];

  const headerActions = (
    <>
      <div className="relative hidden md:block">
        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t.common.search}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="ltr:pl-9 rtl:pr-9 h-9 w-56 text-xs rounded-xl bg-muted/60 border-0 focus:bg-background focus:ring-1 focus:ring-primary/30"
        />
      </div>
      <Button
        className="gradient-primary text-primary-foreground gap-2 text-sm rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
        onClick={() => navigate('/tickets/new')}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">{t.sidebar.newTicket}</span>
      </Button>
    </>
  );

  const dateBadge = (
    <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
      {datePresets.map(p => (
        <button
          key={p.days}
          onClick={() => setDateRange(p.days)}
          className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
            dateRange === p.days ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const isInitialLoad = ticketsLoading && !stats;

  return (
    <PageLayout>
      <PageHeader
        title={t.dashboard.title}
        icon={<BarChart3 className="h-5 w-5" />}
        badge={dateBadge}
        actions={headerActions}
      />

      {isInitialLoad ? (
        <main className="flex-1 overflow-auto bg-muted/20" role="main">
          <DashboardSkeleton />
        </main>
      ) : (

      <main className="flex-1 overflow-auto bg-muted/20 relative" role="main">
        {/* Subtle mesh background */}
        <div className="absolute inset-0 gradient-mesh pointer-events-none opacity-60" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative p-4 md:p-6 lg:p-8 space-y-6"
        >
          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                {greeting}<span className="text-muted-foreground font-semibold">،</span> <span className="text-gradient">{profile?.full_name || ''}</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{t.dashboard.title}</p>
            </div>
            {isAdmin && (
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-success/10 border border-success/20 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span className="text-[11px] font-bold tracking-wide text-success">{lang === 'ar' ? 'مباشر' : 'LIVE'}</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* KPI Cards */}
          <DashboardKPICards
            stats={stats}
            report={report}
            tickets={tickets}
            unresolvedCount={unresolvedCount}
            pendingCount={pendingCount}
          />

          {/* Overview Section */}
          <DashboardOverview
            stats={stats}
            report={report}
          />

          {/* AI Copilot + Activity Feed + System Health */}
          {isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AICopilotWidget />
              <LiveActivityFeed />
              <SystemHealthWidget />
            </div>
          )}

          {/* Escalation Matrix */}
          {isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <EscalationMatrix />
            </div>
          )}

          {/* Quick Actions */}
          {isAdmin && <DashboardQuickActions />}

          {/* Charts */}
          {isAdmin && <DashboardCharts report={report} trendData={trendData} />}

          {/* Ticket List */}
          <DashboardTicketList
            tickets={filteredTickets}
            ticketsLoading={ticketsLoading}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            statusFilters={statusFilters}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            departments={departments}
            isAdmin={isAdmin}
          />
        </motion.div>
      </main>
      )}
    </PageLayout>
  );
}
