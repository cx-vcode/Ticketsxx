import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchSystems, fetchServices, statusLabels, priorityLabels, Ticket } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { motion } from 'framer-motion';
import {
  Loader2, Code2, Bug, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Inbox, Zap, ArrowLeft
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 55%)',
  'hsl(45, 80%, 50%)',
  'hsl(340, 65%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(280, 55%, 55%)',
];

export default function DeveloperDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['systems'],
    queryFn: fetchSystems,
  });

  const { data: myAccess = [] } = useQuery({
    queryKey: ['developer-access', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('developer_access')
        .select('*, systems(name, code), services(name)')
        .eq('developer_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const assignedToMe = tickets.filter(t => t.assigned_agent_id === user?.id);
    const openTickets = tickets.filter(t => !['closed', 'resolved'].includes(t.status));
    const resolvedByMe = assignedToMe.filter(t => t.status === 'resolved' || t.status === 'closed');
    const urgentTickets = openTickets.filter(t => t.priority === 'urgent' || t.priority === 'high');

    // By status
    const byStatus: Record<string, number> = {};
    tickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    // By system
    const bySystem: Record<string, number> = {};
    tickets.forEach(t => {
      const sysName = t.services?.systems?.name || 'بدون نظام';
      bySystem[sysName] = (bySystem[sysName] || 0) + 1;
    });

    // By priority
    const byPriority: Record<string, number> = {};
    tickets.forEach(t => {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    });

    return {
      total: tickets.length,
      assignedToMe: assignedToMe.length,
      open: openTickets.length,
      resolved: resolvedByMe.length,
      urgent: urgentTickets.length,
      byStatus: Object.entries(byStatus).map(([k, v]) => ({ name: statusLabels[k as keyof typeof statusLabels] || k, value: v })),
      bySystem: Object.entries(bySystem).map(([k, v]) => ({ name: k, value: v })),
      byPriority: Object.entries(byPriority).map(([k, v]) => ({ name: priorityLabels[k as keyof typeof priorityLabels] || k, value: v })),
    };
  }, [tickets, user?.id]);

  const recentTickets = useMemo(() => {
    return tickets
      .filter(t => !['closed'].includes(t.status))
      .sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())
      .slice(0, 8);
  }, [tickets]);

  const priorityColors: Record<string, string> = {
    low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-600',
    open: 'bg-primary/10 text-primary',
    in_progress: 'bg-amber-500/10 text-amber-600',
    waiting_on_customer: 'bg-orange-500/10 text-orange-600',
    resolved: 'bg-emerald-500/10 text-emerald-600',
    closed: 'bg-muted text-muted-foreground',
    reopened: 'bg-destructive/10 text-destructive',
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur-md px-4 gap-3 shrink-0 sticky top-0 z-30"
          >
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-bold text-foreground">لوحة المطور</h1>
                <p className="text-xs text-muted-foreground">مرحباً {profile?.full_name || 'مطور'} 👨‍💻</p>
              </div>
            </div>
            <NotificationsPopover />
          </motion.header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6 max-w-7xl mx-auto">
              {/* Access Scope Banner */}
              {myAccess.length > 0 && (
                <motion.div variants={fadeUp} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">نطاق الوصول</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {myAccess.map((a: any) => (
                      <Badge key={a.id} variant="outline" className="text-xs">
                        {a.systems?.name || a.services?.name || 'غير محدد'}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* KPI Cards */}
              <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'إجمالي التذاكر', value: stats.total, icon: Inbox, color: 'text-primary' },
                  { label: 'معيّنة لي', value: stats.assignedToMe, icon: Code2, color: 'text-blue-500' },
                  { label: 'مفتوحة', value: stats.open, icon: Clock, color: 'text-amber-500' },
                  { label: 'تم حلها', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-500' },
                  { label: 'عاجلة', value: stats.urgent, icon: AlertTriangle, color: 'text-destructive' },
                ].map(kpi => (
                  <Card key={kpi.label} className="rounded-2xl border-border/50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2 rounded-xl bg-muted/50 ${kpi.color}`}>
                        <kpi.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tickets by System */}
                <motion.div variants={fadeUp}>
                  <Card className="rounded-2xl border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">التذاكر حسب النظام</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={stats.bySystem} layout="vertical" margin={{ right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Tickets by Priority */}
                <motion.div variants={fadeUp}>
                  <Card className="rounded-2xl border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">التذاكر حسب الأولوية</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={stats.byPriority}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {stats.byPriority.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Tickets by Status Chart */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-2xl border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">التذاكر حسب الحالة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.byStatus}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Active Tickets */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-2xl border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      آخر التذاكر النشطة
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} className="text-xs gap-1">
                      عرض الكل
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {recentTickets.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                          <Bug className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          لا توجد تذاكر نشطة
                        </div>
                      ) : (
                        recentTickets.map(ticket => (
                          <button
                            key={ticket.id}
                            onClick={() => navigate(`/tickets/${ticket.id}`)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-right"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                                <span className="text-sm font-medium text-foreground truncate">{ticket.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{ticket.services?.name || 'بدون خدمة'}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(ticket.last_activity_at), { addSuffix: true, locale: ar })}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={`text-[10px] ${priorityColors[ticket.priority] || ''}`}>
                                {priorityLabels[ticket.priority]}
                              </Badge>
                              <Badge className={`text-[10px] border-0 ${statusColors[ticket.status] || ''}`}>
                                {statusLabels[ticket.status]}
                              </Badge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
