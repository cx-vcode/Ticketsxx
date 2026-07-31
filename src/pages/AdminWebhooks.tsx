import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout, PageHeader, PageContainer, SectionHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, AdminTableSkeleton } from '@/components/common';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Webhook, Plus, Trash2, Eye, CheckCircle2, XCircle, Loader2, RefreshCw, Activity, AlertTriangle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function AdminWebhooks() {
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const dateLocale = isAr ? ar : enUS;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [logsWebhookId, setLogsWebhookId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: [] as string[] });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [logDetail, setLogDetail] = useState<any | null>(null);

  const EVENT_TYPES = [
    { value: 'ticket.created', label: t.admin.webhookEventsList.ticketCreated },
    { value: 'ticket.status_changed', label: t.admin.webhookEventsList.statusChanged },
    { value: 'ticket.assigned', label: t.admin.webhookEventsList.assigned },
    { value: 'ticket.priority_changed', label: t.admin.webhookEventsList.priorityChanged },
    { value: 'ticket.comment_added', label: t.admin.webhookEventsList.commentAdded },
    { value: 'ticket.resolved', label: t.admin.webhookEventsList.resolved },
    { value: 'ticket.closed', label: t.admin.webhookEventsList.closed },
  ];

  const { data: webhooks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('webhook_endpoints').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['webhook-logs', logsWebhookId],
    queryFn: async () => {
      if (!logsWebhookId) return [];
      const { data, error } = await supabase.from('webhook_logs').select('*').eq('webhook_id', logsWebhookId).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!logsWebhookId,
  });

  // KPIs
  const kpis = useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter((w: any) => w.is_active).length;
    const failing = webhooks.filter((w: any) => (w.failure_count || 0) > 0).length;
    return { total, active, failing };
  }, [webhooks]);

  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return logs;
    return logs.filter((l: any) => statusFilter === 'success' ? l.success : !l.success);
  }, [logs, statusFilter]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('webhook_endpoints').insert({
        name: form.name,
        url: form.url,
        secret: form.secret || null,
        events: form.events,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setOpen(false);
      setForm({ name: '', url: '', secret: '', events: [] });
      toast({ title: t.admin.webhookCreated });
    },
    onError: (e: any) => toast({ title: isAr ? 'تعذّر الإنشاء' : 'Create failed', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('webhook_endpoints').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: t.admin.webhookDeleted });
      setDeleteTarget(null);
    },
  });

  // Manual test ping
  const pingMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { data, error } = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          event_type: 'webhook.test',
          ticket: { id: 'test', ticket_number: 0, code: 'TEST-PING', title: isAr ? 'اختبار ويبهوك' : 'Webhook test', priority: 'low', status: 'new' },
          target_webhook_id: webhookId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: isAr ? '🚀 تم إرسال الاختبار' : '🚀 Test sent' });
      refetchLogs();
    },
    onError: (e: any) => toast({ title: isAr ? 'فشل الاختبار' : 'Test failed', description: e.message, variant: 'destructive' }),
  });

  // Retry a failed delivery (re-dispatches the original payload)
  const retryMutation = useMutation({
    mutationFn: async (log: any) => {
      const ticket = log.payload?.data || log.payload;
      const { data, error } = await supabase.functions.invoke('dispatch-webhook', {
        body: { event_type: log.event_type, ticket, target_webhook_id: log.webhook_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: isAr ? '🔁 أُعيدت المحاولة' : '🔁 Retried' });
      refetchLogs();
    },
    onError: (e: any) => toast({ title: isAr ? 'فشل إعادة المحاولة' : 'Retry failed', description: e.message, variant: 'destructive' }),
  });

  const toggleEvent = (ev: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  };

  const addDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-accent text-accent-foreground gap-2 text-sm shadow-lg shadow-primary/20 rounded-xl">
          <Plus className="h-4 w-4" />{t.admin.addWebhook}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader><DialogTitle>{t.admin.addWebhook}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.webhookName}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t.admin.webhookNamePlaceholder} className="rounded-xl h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.webhookUrl}</Label>
            <Input dir="ltr" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder={t.admin.webhookUrlPlaceholder} className="rounded-xl h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.webhookSecret}</Label>
            <Input dir="ltr" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder={t.admin.webhookSecretPlaceholder} className="rounded-xl h-9" />
            <p className="text-[10px] text-muted-foreground">{isAr ? 'يُستخدم لتوقيع HMAC-SHA256 في هيدر X-Signature' : 'Used to sign HMAC-SHA256 in X-Signature header'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t.admin.webhookEventsLabel}</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox checked={form.events.includes(ev.value)} onCheckedChange={() => toggleEvent(ev.value)} />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <Button className="w-full gradient-accent text-accent-foreground rounded-xl" disabled={!form.name || !form.url || form.events.length === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            {createMutation.isPending && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
            {t.admin.createWebhook}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.webhooksTitle}
        icon={<Webhook className="h-5 w-5" />}
        actions={addDialog}
      />
      <PageContainer maxWidth="lg">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isAr ? 'الإجمالي' : 'Total', value: kpis.total, icon: Webhook, color: 'text-primary bg-primary/10' },
            { label: isAr ? 'نشطة' : 'Active', value: kpis.active, icon: Activity, color: 'text-emerald-600 bg-emerald-500/10' },
            { label: isAr ? 'بها أخطاء' : 'Failing', value: kpis.failing, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="rounded-2xl border-border/50">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="endpoints" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="endpoints" className="rounded-lg text-xs">{t.admin.endpointsTab}</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg text-xs">{t.admin.deliveryLogsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-3 mt-4">
            {isLoading ? (
              <AdminTableSkeleton rows={4} />
            ) : error ? (
              <ErrorState onRetry={() => refetch()} />
            ) : webhooks.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title={t.admin.noWebhooks}
                description={isAr ? 'أضف نقطة نهاية لاستقبال أحداث النظام في الوقت الفعلي.' : 'Add an endpoint to receive system events in real time.'}
                action={addDialog}
              />
            ) : (
              <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="visible" className="space-y-3">
                {webhooks.map((wh: any) => (
                  <motion.div key={wh.id} variants={fadeUp}>
                    <Card className="rounded-2xl border-border/50 shadow-card group hover:border-primary/30 transition-colors">
                      <CardContent className="pt-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-sm">{wh.name}</h3>
                            <Badge variant={wh.is_active ? "default" : "secondary"} className="text-[10px] rounded-lg">
                              {wh.is_active ? t.admin.webhookActive : t.admin.webhookInactive}
                            </Badge>
                            {wh.failure_count > 0 && (
                              <Badge variant="destructive" className="text-[10px] rounded-lg gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {t.admin.failureCount}: {wh.failure_count}
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs text-muted-foreground block truncate" dir="ltr">{wh.url}</code>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(wh.events || []).map((ev: string) => (
                              <Badge key={ev} variant="outline" className="text-[10px] rounded-lg">{ev}</Badge>
                            ))}
                          </div>
                          {wh.last_triggered_at && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              {t.admin.lastTriggered}: {format(new Date(wh.last_triggered_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                            </p>
                          )}
                        </div>
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center gap-1.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => pingMutation.mutate(wh.id)} disabled={pingMutation.isPending}>
                                  {pingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">{isAr ? 'إرسال اختبار' : 'Send test'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setLogsWebhookId(wh.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">{t.admin.deliveryLogsTab}</TooltipContent>
                            </Tooltip>
                            <Switch checked={wh.is_active} onCheckedChange={v => toggleMutation.mutate({ id: wh.id, is_active: v })} />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteTarget(wh.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">{t.common.delete}</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-3 mt-4">
            <SectionHeader
              title={isAr ? 'سجل التسليم' : 'Delivery log'}
              description={isAr ? 'آخر 100 محاولة تسليم لكل ويبهوك' : 'Last 100 delivery attempts per webhook'}
              actions={
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
                      <SelectItem value="success">{isAr ? 'ناجحة' : 'Success'}</SelectItem>
                      <SelectItem value="failed">{isAr ? 'فاشلة' : 'Failed'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => refetchLogs()} disabled={!logsWebhookId}>
                    <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              }
            />
            {!logsWebhookId ? (
              <EmptyState
                icon={Eye}
                variant="compact"
                title={t.admin.selectWebhookFirst}
                description={isAr ? 'اختر ويبهوك من تبويب Endpoints لعرض السجلات.' : 'Pick a webhook from the Endpoints tab to view logs.'}
              />
            ) : logsLoading ? (
              <AdminTableSkeleton rows={5} />
            ) : filteredLogs.length === 0 ? (
              <EmptyState icon={Activity} variant="compact" title={isAr ? 'لا توجد محاولات تسليم' : 'No delivery attempts'} />
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log: any) => (
                  <motion.div
                    key={log.id}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-3 text-xs border border-border/50 rounded-xl px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors group"
                  >
                    {log.success ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <Badge variant="outline" className="text-[10px] rounded-lg shrink-0">{log.event_type}</Badge>
                    <Badge variant={log.success ? 'secondary' : 'destructive'} className="text-[10px] rounded-lg shrink-0">
                      {log.response_status || (log.success ? 'OK' : 'ERR')}
                    </Badge>
                    <span className="text-muted-foreground flex-1 truncate font-mono">{format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: dateLocale })}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 rounded-lg" onClick={() => setLogDetail(log)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {!log.success && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 rounded-lg text-primary" onClick={() => retryMutation.mutate(log)} disabled={retryMutation.isPending}>
                          <RefreshCw className={`h-3.5 w-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>

      {/* Log detail dialog */}
      <Dialog open={!!logDetail} onOpenChange={(v) => !v && setLogDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {logDetail?.success ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
              {isAr ? 'تفاصيل التسليم' : 'Delivery details'}
            </DialogTitle>
          </DialogHeader>
          {logDetail && (
            <div className="space-y-3 mt-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Event</Label><p className="font-mono">{logDetail.event_type}</p></div>
                <div><Label className="text-[10px]">HTTP Status</Label><p className="font-mono">{logDetail.response_status || '—'}</p></div>
              </div>
              <div>
                <Label className="text-[10px]">{isAr ? 'الحمولة المُرسلة' : 'Sent Payload'}</Label>
                <pre className="bg-muted/70 rounded-xl p-3 overflow-x-auto border mt-1 max-h-60" dir="ltr">
                  <code>{JSON.stringify(logDetail.payload, null, 2)}</code>
                </pre>
              </div>
              {logDetail.response_body && (
                <div>
                  <Label className="text-[10px]">{isAr ? 'استجابة الخادم' : 'Server Response'}</Label>
                  <pre className="bg-muted/70 rounded-xl p-3 overflow-x-auto border mt-1 max-h-40" dir="ltr">
                    <code>{logDetail.response_body}</code>
                  </pre>
                </div>
              )}
              {!logDetail.success && (
                <Button className="w-full rounded-xl" onClick={() => { retryMutation.mutate(logDetail); setLogDetail(null); }} disabled={retryMutation.isPending}>
                  <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                  {isAr ? 'إعادة المحاولة الآن' : 'Retry now'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.deleteWebhookConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.deleteWebhookDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
