import { useState, useEffect, useCallback } from 'react';
import { PageLayout, PageHeader, PageContainer, SectionHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import {
  MessageSquare, Send, CheckCircle, XCircle, Hash, Bell, Zap, AlertTriangle,
  Link2, Unlink, RefreshCw, Activity, Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/i18n';
import { EmptyState, ErrorState, AdminTableSkeleton } from '@/components/common';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';

interface ChannelMapping {
  event: string;
  channel: string;
  enabled: boolean;
}

interface DeliveryLog {
  id: string;
  channel: string;
  message: string;
  status: 'success' | 'failed';
  error?: string;
  at: string;
}

const STORAGE_KEY_MAPPINGS = 'slack_event_mappings_v1';
const STORAGE_KEY_LOGS = 'slack_delivery_logs_v1';

const defaultMappings: ChannelMapping[] = [
  { event: 'ticket.created', channel: '#tickets', enabled: true },
  { event: 'ticket.urgent', channel: '#urgent-alerts', enabled: true },
  { event: 'ticket.status_changed', channel: '#tickets', enabled: false },
  { event: 'ticket.external', channel: '#integrations', enabled: false },
];

export default function AdminSlackIntegration() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [testChannel, setTestChannel] = useState('#general');
  const [testMessage, setTestMessage] = useState(t('🔔 رسالة تجريبية من نظام التذاكر', '🔔 Test message from ticketing system'));
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [connection, setConnection] = useState<any>(null);
  const [loadingConn, setLoadingConn] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);

  const [mappings, setMappings] = useState<ChannelMapping[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MAPPINGS);
      return raw ? JSON.parse(raw) : defaultMappings;
    } catch { return defaultMappings; }
  });

  const [logs, setLogs] = useState<DeliveryLog[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const loadConnection = useCallback(async () => {
    setLoadingConn(true);
    setConnError(null);
    try {
      const { data, error } = await supabase
        .from('integration_connections' as any)
        .select('*')
        .eq('provider', 'slack')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setConnection(data);
    } catch (err: any) {
      setConnError(err.message);
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => { loadConnection(); }, [loadConnection]);

  const persistMappings = (next: ChannelMapping[]) => {
    setMappings(next);
    localStorage.setItem(STORAGE_KEY_MAPPINGS, JSON.stringify(next));
  };

  const persistLogs = (next: DeliveryLog[]) => {
    const trimmed = next.slice(0, 50);
    setLogs(trimmed);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(trimmed));
  };

  const sendTestMessage = async () => {
    setSending(true);
    setLastResult(null);
    const startedAt = new Date().toISOString();
    try {
      const { data, error } = await supabase.functions.invoke('send-slack-notification', {
        body: {
          channel: testChannel,
          message: testMessage,
          ticket: {
            ticket_number: 9999,
            title: t('تذكرة تجريبية', 'Test ticket'),
            priority: 'high',
            status: 'new',
            source_system: 'PORTAL',
          },
        },
      });
      if (error) throw error;
      if (data?.success) {
        setLastResult({ success: true });
        persistLogs([{ id: crypto.randomUUID(), channel: testChannel, message: testMessage, status: 'success', at: startedAt }, ...logs]);
        toast({ title: t('تم الإرسال بنجاح ✅', 'Sent successfully ✅') });
      } else {
        throw new Error(data?.error || t('فشل الإرسال', 'Send failed'));
      }
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
      persistLogs([{ id: crypto.randomUUID(), channel: testChannel, message: testMessage, status: 'failed', error: err.message, at: startedAt }, ...logs]);
      toast({ title: t('فشل الإرسال', 'Send failed'), description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <PageLayout>
      <PageHeader title={t('تكامل Slack', 'Slack Integration')} icon={<MessageSquare className="h-4 w-4" />} />
      <PageContainer>
        {/* Connection Status */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#4A154B] flex items-center justify-center shadow-lg">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground flex items-center gap-2">
                      Slack Workspace
                      {loadingConn ? (
                        <Badge variant="outline" className="text-[10px]">{t('جارٍ التحقق...', 'Checking...')}</Badge>
                      ) : connection ? (
                        <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                          <CheckCircle className="h-2.5 w-2.5 me-1" />{t('متصل', 'Connected')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                          <Unlink className="h-2.5 w-2.5 me-1" />{t('غير متصل', 'Not connected')}
                        </Badge>
                      )}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {connection
                        ? t(`متصل عبر ${connection.account_name || 'Slack'}`, `Connected via ${connection.account_name || 'Slack'}`)
                        : t('قم بربط Slack من صفحة التكاملات لإرسال الإشعارات', 'Connect Slack from Integrations page to send notifications')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadConnection} className="rounded-xl">
                    <RefreshCw className="h-3.5 w-3.5 me-1" />{t('تحديث', 'Refresh')}
                  </Button>
                  <Button size="sm" asChild className="rounded-xl">
                    <a href="/admin/integrations">
                      <Link2 className="h-3.5 w-3.5 me-1" />{t('إدارة الاتصال', 'Manage Connection')}
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('إرسالات ناجحة', 'Successful'), value: successCount, icon: CheckCircle, color: 'text-success' },
            { label: t('فاشلة', 'Failed'), value: failedCount, icon: XCircle, color: 'text-destructive' },
            { label: t('قنوات مُعرَّفة', 'Mapped Events'), value: mappings.filter(m => m.enabled).length, icon: Hash, color: 'text-primary' },
            { label: t('إجمالي السجلات', 'Total Logs'), value: logs.length, icon: Activity, color: 'text-info' },
          ].map((k, i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center ${k.color}`}>
                  <k.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="test" className="rounded-lg">{t('اختبار الإرسال', 'Test Send')}</TabsTrigger>
            <TabsTrigger value="routing" className="rounded-lg">{t('توجيه الأحداث', 'Event Routing')}</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg">{t('سجل الإرسال', 'Delivery Logs')}</TabsTrigger>
          </TabsList>

          <TabsContent value="test">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  {t('إرسال رسالة تجريبية', 'Send Test Message')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">{t('القناة', 'Channel')}</Label>
                    <div className="relative mt-1">
                      <Hash className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input dir="ltr" value={testChannel} onChange={e => setTestChannel(e.target.value)} placeholder="#general" className="pe-8 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t('الرسالة', 'Message')}</Label>
                    <Textarea value={testMessage} onChange={e => setTestMessage(e.target.value)} rows={2} className="mt-1 text-xs rounded-xl" />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={sendTestMessage} disabled={sending || !connection} size="sm" className="rounded-xl">
                    <Send className="h-3.5 w-3.5 me-1" />
                    {sending ? t('جاري الإرسال...', 'Sending...') : t('إرسال', 'Send')}
                  </Button>
                  {!connection && !loadingConn && (
                    <span className="text-xs text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />{t('يجب ربط Slack أولاً', 'Connect Slack first')}
                    </span>
                  )}
                  {lastResult && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {lastResult.success ? (
                        <><CheckCircle className="h-4 w-4 text-success" /><span className="text-success">{t('تم الإرسال', 'Delivered')}</span></>
                      ) : (
                        <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">{lastResult.error}</span></>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routing">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  {t('توجيه الأحداث إلى قنوات', 'Route Events to Channels')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mappings.map((m, idx) => (
                  <div key={m.event} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono">{m.event}</p>
                    </div>
                    <Input
                      dir="ltr"
                      value={m.channel}
                      onChange={e => {
                        const next = [...mappings];
                        next[idx] = { ...m, channel: e.target.value };
                        persistMappings(next);
                      }}
                      placeholder="#channel"
                      className="w-40 h-8 text-xs rounded-lg"
                    />
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={(v) => {
                        const next = [...mappings];
                        next[idx] = { ...m, enabled: v };
                        persistMappings(next);
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2 text-center">
                  💡 {t('الإعدادات تُحفظ تلقائياً وتُستخدم بواسطة قواعد الأتمتة', 'Settings auto-save and are consumed by automation rules')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="rounded-2xl">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t('آخر 50 محاولة إرسال', 'Last 50 Delivery Attempts')}
                </CardTitle>
                {logs.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => persistLogs([])} className="text-xs h-7 rounded-lg">
                    {t('مسح السجل', 'Clear logs')}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title={t('لا توجد سجلات', 'No logs yet')}
                    description={t('ستظهر محاولات الإرسال هنا', 'Delivery attempts will appear here')}
                  />
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{t('الحالة', 'Status')}</TableHead>
                          <TableHead className="text-xs">{t('القناة', 'Channel')}</TableHead>
                          <TableHead className="text-xs">{t('الرسالة', 'Message')}</TableHead>
                          <TableHead className="text-xs text-end">{t('الوقت', 'Time')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {log.status === 'success' ? (
                                <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                                  <CheckCircle className="h-2.5 w-2.5 me-1" />OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  <XCircle className="h-2.5 w-2.5 me-1" />FAIL
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{log.channel}</TableCell>
                            <TableCell className="text-xs max-w-xs truncate">
                              {log.error ? <span className="text-destructive">{log.error}</span> : log.message}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground text-end">
                              {formatDistanceToNow(new Date(log.at), { addSuffix: true, locale: isAr ? arLocale : undefined })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageLayout>
  );
}
