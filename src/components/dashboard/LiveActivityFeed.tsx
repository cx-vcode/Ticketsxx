import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MessageSquare, UserCheck, AlertTriangle, CheckCircle2, Plus, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/i18n';
import { useNavigate } from 'react-router-dom';

interface ActivityEvent {
  id: string;
  type: 'created' | 'status_changed' | 'assigned' | 'comment_added' | 'resolved' | 'priority_changed';
  ticketId: string;
  ticketNumber: number;
  ticketTitle: string;
  userName: string;
  details?: string;
  timestamp: string;
}

const eventConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  created: { icon: Plus, color: 'text-primary', bgColor: 'bg-primary/10' },
  status_changed: { icon: Clock, color: 'text-info', bgColor: 'bg-info/10' },
  assigned: { icon: UserCheck, color: 'text-accent', bgColor: 'bg-accent/10' },
  comment_added: { icon: MessageSquare, color: 'text-success', bgColor: 'bg-success/10' },
  resolved: { icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  priority_changed: { icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10' },
};

export const LiveActivityFeed = memo(function LiveActivityFeed() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const dateLocale = lang === 'ar' ? ar : enUS;

  useEffect(() => {
    // Load recent notifications as initial events
    const loadRecent = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, ticket_id, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (data) {
        setEvents(data.map(n => ({
          id: n.id,
          type: (n.type as any) || 'status_changed',
          ticketId: n.ticket_id || '',
          ticketNumber: 0,
          ticketTitle: n.title,
          userName: '',
          details: n.message,
          timestamp: n.created_at,
        })));
      }
    };
    loadRecent();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('live-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as any;
          const newEvent: ActivityEvent = {
            id: n.id,
            type: n.type || 'status_changed',
            ticketId: n.ticket_id || '',
            ticketNumber: 0,
            ticketTitle: n.title,
            userName: '',
            details: n.message,
            timestamp: n.created_at,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl bg-card border border-border/50 overflow-hidden hover:shadow-card-hover transition-shadow duration-300"
    >
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{lang === 'ar' ? 'النشاط المباشر' : 'Live Activity'}</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[9px] font-semibold text-success">{lang === 'ar' ? 'مباشر' : 'Live'}</span>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-xs">{lang === 'ar' ? 'لا يوجد نشاط حالياً' : 'No activity yet'}</p>
            </div>
          ) : (
            events.map((event, i) => {
              const config = eventConfig[event.type] || eventConfig.status_changed;
              const Icon = config.icon;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
                  onClick={() => event.ticketId && navigate(`/tickets/${event.ticketId}`)}
                  className="flex items-start gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors duration-200 group"
                >
                  <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{event.ticketTitle}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{event.details}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: dateLocale })}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
