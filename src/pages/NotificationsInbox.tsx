import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markNotificationRead } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { formatDistanceToNow, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useEffect } from 'react';

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

export default function NotificationsInbox() {
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-inbox-realtime')
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

  const filteredNotifications = notifications.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (filterRead === 'unread' && n.is_read) return false;
    if (filterRead === 'read' && !n.is_read) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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

  const notificationTypes = [
    { value: 'all', label: t.notifications.allTypes },
    { value: 'ticket_created', label: t.notifications.types.ticketCreated },
    { value: 'assigned', label: t.notifications.types.assigned },
    { value: 'comment_added', label: t.notifications.types.commentAdded },
    { value: 'status_changed', label: t.notifications.types.statusChanged },
    { value: 'priority_changed', label: t.notifications.types.priorityChanged },
    { value: 'sla_warning', label: t.notifications.types.slaWarning },
    { value: 'approval_escalated', label: t.notifications.types.approvalEscalated },
    { value: 'weekly_report', label: t.notifications.types.weeklyReport },
  ];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="container mx-auto py-6 px-4 max-w-4xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bell className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{t.notifications.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} ${t.notifications.unreadCount}`
                    : t.notifications.allRead}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllRead}>
                <CheckCheck className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t.notifications.markAllRead}
              </Button>
            )}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t.notifications.filterByType} />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.value !== 'all' && (
                          <span className={isRTL ? 'ml-2' : 'mr-2'}>
                            {typeIcons[type.value] || '🔔'}
                          </span>
                        )}
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterRead} onValueChange={setFilterRead}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder={t.notifications.readStatus} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.notifications.allNotifications}</SelectItem>
                    <SelectItem value="unread">{t.notifications.unreadOnly}</SelectItem>
                    <SelectItem value="read">{t.notifications.readOnly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-lg">{t.notifications.empty}</p>
                  <p className="text-sm">{t.notifications.emptyDesc}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredNotifications.map((n, i) => {
                    const { title, message } = getLocalizedText(n);
                    return (
                      <motion.button
                        key={n.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => handleClick(n)}
                        className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-4 border-b last:border-0 hover:bg-muted/50 transition-colors ${
                          !n.is_read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-1">{typeIcons[n.type || ''] || '🔔'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{title}</p>
                              {!n.is_read && (
                                <Badge variant="default" className="text-[10px] h-5">
                                  {t.notifications.new}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{message}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(n.created_at), 'PPp', { locale: dateLocale })}
                              </p>
                            </div>
                          </div>
                          {!n.is_read && (
                            <span className="h-3 w-3 rounded-full bg-primary shrink-0 mt-2" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
