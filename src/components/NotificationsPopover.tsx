import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markNotificationRead } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n';

const typeIcons: Record<string, string> = {
  ticket_created: '🎫',
  assigned: '👤',
  comment_added: '💬',
  status_changed: '🔄',
  priority_changed: '⚡',
  weekly_report: '📊',
  approval_escalated: '⚠️',
  sla_warning: '⏰',
  automation: '🤖',
};

type NotificationI18nData = {
  title_ar?: string;
  title_en?: string;
  message_ar?: string;
  message_en?: string;
};

export function NotificationsPopover() {
  const { user } = useAuth();
  const { lang, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const copy = lang === 'ar'
    ? {
        title: 'الإشعارات',
        unread: 'غير مقروءة',
        markAll: 'قراءة الكل',
        empty: 'لا توجد إشعارات',
      }
    : {
        title: 'Notifications',
        unread: 'unread',
        markAll: 'Mark all read',
        empty: 'No notifications',
      };

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getLocalizedText = (n: any) => {
    const data = (n?.data || {}) as NotificationI18nData;
    const title = lang === 'ar'
      ? (data.title_ar || n.title)
      : (data.title_en || n.title);

    const message = lang === 'ar'
      ? (data.message_ar || n.message)
      : (data.message_en || n.message);

    return { title, message };
  };

  const handleClick = async (n: (typeof notifications)[0]) => {
    if (!user) return;

    if (!n.is_read) {
      await markNotificationRead(n.id);
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    }
    if (n.ticket_id) {
      navigate(`/tickets/${n.ticket_id}`);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  };

  const dateLocale = lang === 'ar' ? ar : enUS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -left-0.5 h-4 w-4 rounded-full gradient-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-3 border-b font-semibold text-sm flex items-center justify-between">
          <span>{copy.title}</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{unreadCount} {copy.unread}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={markAllRead}
                >
                  <Check className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {copy.markAll}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="max-h-[400px] overflow-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">{copy.empty}</p>
            </div>
          ) : (
            notifications.map((n, i) => {
              const { title, message } = getLocalizedText(n);
              return (
                <motion.button
                  key={n.id}
                  initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleClick(n)}
                  className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${
                    !n.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{typeIcons[n.type || ''] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5"
                      />
                    )}
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
