import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowUpRight, AlertTriangle, Clock, Users, Shield } from 'lucide-react';

interface EscalationRule {
  priority: string;
  timeThreshold: string;
  action: string;
  level: number;
}

export const EscalationMatrix = memo(function EscalationMatrix() {
  const { lang } = useLanguage();

  const { data: overdueTickets = [] } = useQuery({
    queryKey: ['overdue-escalations'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('tickets')
        .select('id, code, title, priority, status, sla_resolution_due_at, assigned_agent_id, created_at, services(name)')
        .not('status', 'in', '("resolved","closed")')
        .lt('sla_resolution_due_at', now)
        .not('sla_resolution_due_at', 'is', null)
        .order('sla_resolution_due_at', { ascending: true })
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const escalationRules: EscalationRule[] = useMemo(() => [
    {
      priority: lang === 'ar' ? 'عاجل' : 'Urgent',
      timeThreshold: lang === 'ar' ? '1 ساعة' : '1 hour',
      action: lang === 'ar' ? 'تصعيد للمدير + إشعار فوري' : 'Escalate to manager + instant alert',
      level: 3,
    },
    {
      priority: lang === 'ar' ? 'عالي' : 'High',
      timeThreshold: lang === 'ar' ? '4 ساعات' : '4 hours',
      action: lang === 'ar' ? 'تصعيد لقائد الفريق' : 'Escalate to team lead',
      level: 2,
    },
    {
      priority: lang === 'ar' ? 'متوسط' : 'Medium',
      timeThreshold: lang === 'ar' ? '8 ساعات' : '8 hours',
      action: lang === 'ar' ? 'إعادة تعيين تلقائي' : 'Auto-reassign',
      level: 1,
    },
    {
      priority: lang === 'ar' ? 'منخفض' : 'Low',
      timeThreshold: lang === 'ar' ? '24 ساعة' : '24 hours',
      action: lang === 'ar' ? 'إشعار بريدي' : 'Email notification',
      level: 0,
    },
  ], [lang]);

  const levelColors = ['bg-info/10 text-info', 'bg-warning/10 text-warning', 'bg-orange-500/10 text-orange-500', 'bg-destructive/10 text-destructive'];
  const priorityColors: Record<string, string> = {
    urgent: 'bg-destructive/10 text-destructive border-destructive/20',
    high: 'bg-warning/10 text-warning border-warning/20',
    medium: 'bg-info/10 text-info border-info/20',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            {lang === 'ar' ? 'مصفوفة التصعيد' : 'Escalation Matrix'}
          </CardTitle>
          {overdueTickets.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
              <AlertTriangle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
              {overdueTickets.length} {lang === 'ar' ? 'تحتاج تصعيد' : 'need escalation'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rules */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === 'ar' ? 'قواعد التصعيد' : 'Escalation Rules'}
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {escalationRules.map((rule, i) => (
              <motion.div
                key={rule.priority}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30"
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${levelColors[rule.level]}`}>
                  L{rule.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{rule.priority}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {rule.timeThreshold}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{rule.action}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Active Escalations */}
        {overdueTickets.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
              {lang === 'ar' ? 'تذاكر متأخرة' : 'Overdue Tickets'}
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {overdueTickets.map((ticket: any, i: number) => (
                <motion.a
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{ticket.code}: {ticket.title}</p>
                    <p className="text-[9px] text-muted-foreground">{(ticket as any).services?.name || ''}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${priorityColors[ticket.priority]}`}>
                    {ticket.priority}
                  </Badge>
                </motion.a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
