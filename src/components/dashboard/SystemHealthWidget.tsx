import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, Zap, Server, Users } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

interface HealthMetric {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  value: string;
  icon: typeof Activity;
}

export const SystemHealthWidget = memo(function SystemHealthWidget() {
  const { lang } = useLanguage();

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    staleTime: 1000 * 60 * 2,
  });

  const { data: slaBreachCount = 0 } = useQuery({
    queryKey: ['sla-breach-count'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_resolution_due_at', now)
        .not('sla_resolution_due_at', 'is', null);
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: activeAgents = 0 } = useQuery({
    queryKey: ['active-agents-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      return count || 0;
    },
    staleTime: 1000 * 60 * 10,
  });

  const metrics = useMemo((): HealthMetric[] => {
    const openTickets = (tickets as any[]).filter((t: any) => !['resolved', 'closed'].includes(t.status)).length;
    const avgLoad = activeAgents > 0 ? Math.round(openTickets / activeAgents) : 0;

    return [
      {
        label: lang === 'ar' ? 'خروقات SLA' : 'SLA Breaches',
        status: slaBreachCount === 0 ? 'healthy' : slaBreachCount <= 3 ? 'warning' : 'critical',
        value: slaBreachCount.toString(),
        icon: Clock,
      },
      {
        label: lang === 'ar' ? 'حمل العمل' : 'Workload',
        status: avgLoad <= 5 ? 'healthy' : avgLoad <= 10 ? 'warning' : 'critical',
        value: `${avgLoad} ${lang === 'ar' ? 'تذكرة/وكيل' : 'tickets/agent'}`,
        icon: Users,
      },
      {
        label: lang === 'ar' ? 'التذاكر النشطة' : 'Active Tickets',
        status: openTickets <= 20 ? 'healthy' : openTickets <= 50 ? 'warning' : 'critical',
        value: openTickets.toString(),
        icon: Zap,
      },
      {
        label: lang === 'ar' ? 'الوكلاء المتاحون' : 'Available Agents',
        status: activeAgents >= 3 ? 'healthy' : activeAgents >= 1 ? 'warning' : 'critical',
        value: activeAgents.toString(),
        icon: Server,
      },
    ];
  }, [tickets, slaBreachCount, activeAgents, lang]);

  const overallHealth = useMemo(() => {
    const criticalCount = metrics.filter(m => m.status === 'critical').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    if (criticalCount > 0) return 'critical';
    if (warningCount > 1) return 'warning';
    return 'healthy';
  }, [metrics]);

  const statusConfig = {
    healthy: { color: 'text-success', bg: 'bg-success/10 border-success/20', icon: CheckCircle2, label: lang === 'ar' ? 'صحة ممتازة' : 'All Systems Healthy' },
    warning: { color: 'text-warning', bg: 'bg-warning/10 border-warning/20', icon: AlertTriangle, label: lang === 'ar' ? 'يحتاج مراقبة' : 'Needs Attention' },
    critical: { color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', icon: XCircle, label: lang === 'ar' ? 'حرج' : 'Critical' },
  };

  const overall = statusConfig[overallHealth];
  const OverallIcon = overall.icon;

  return (
    <Card className="rounded-2xl border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {lang === 'ar' ? 'صحة النظام' : 'System Health'}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] border ${overall.bg} ${overall.color}`}>
            <OverallIcon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
            {overall.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric, i) => {
          const config = statusConfig[metric.status];
          const MetricIcon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
                  <MetricIcon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <span className="text-xs font-medium text-foreground">{metric.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${config.color}`}>{metric.value}</span>
                <div className={`w-2 h-2 rounded-full ${
                  metric.status === 'healthy' ? 'bg-success' : metric.status === 'warning' ? 'bg-warning' : 'bg-destructive'
                } ${metric.status === 'critical' ? 'animate-pulse' : ''}`} />
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
});
