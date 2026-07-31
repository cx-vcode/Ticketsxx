import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout, PageHeader, PageContainer, SectionHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, AdminTableSkeleton } from '@/components/common';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Zap, Plus, Trash2, ArrowDown, CheckCircle, XCircle, Sparkles, Library } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/i18n';

interface Condition { field: string; operator: string; value: string; }
interface Action { type: string; value?: string; message?: string; channel?: string; title?: string; recipient_email?: string; }

export default function AdminAutomation() {
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const dateLocale = isAr ? ar : enUS;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([{ field: '', operator: 'equals', value: '' }]);
  const [actions, setActions] = useState<Action[]>([{ type: '' }]);

  const TRIGGER_EVENTS = [
    { value: 'ticket.created', label: t.admin.triggers.ticketCreated },
    { value: 'ticket.status_changed', label: t.admin.triggers.statusChanged },
    { value: 'ticket.assigned', label: t.admin.triggers.assigned },
    { value: 'ticket.priority_changed', label: t.admin.triggers.priorityChanged },
  ];

  const CONDITION_FIELDS = [
    { value: 'priority', label: t.admin.conditionFields.priority },
    { value: 'status', label: t.admin.conditionFields.status },
    { value: 'source_system', label: t.admin.conditionFields.sourceSystem },
    { value: 'title', label: t.admin.conditionFields.title },
  ];

  const OPERATORS = [
    { value: 'equals', label: t.admin.operators.equals },
    { value: 'not_equals', label: t.admin.operators.notEquals },
    { value: 'contains', label: t.admin.operators.contains },
  ];

  const ACTION_TYPES = [
    { value: 'change_priority', label: t.admin.actionTypes.changePriority },
    { value: 'change_status', label: t.admin.actionTypes.changeStatus },
    { value: 'assign_agent', label: t.admin.actionTypes.assignAgent },
    { value: 'assign_department', label: t.admin.actionTypes.assignDepartment },
    { value: 'send_notification', label: t.admin.actionTypes.sendNotification },
    { value: 'send_email', label: t.admin.actionTypes.sendEmail },
    { value: 'webhook', label: t.admin.actionTypes.webhook },
    { value: 'send_slack', label: t.admin.actionTypes.sendSlack },
  ];

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const validConditions = conditions.filter(c => c.field && c.value);
      const validActions = actions.filter(a => a.type);
      const { error } = await supabase.from('automation_rules').insert([{
        name,
        description: description || null,
        trigger_event: trigger,
        conditions: validConditions as any,
        actions: validActions as any,
        created_by: user!.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      setOpen(false);
      resetForm();
      toast({ title: t.admin.ruleCreated });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('automation_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      toast({ title: t.admin.ruleDeleted });
    },
  });

  const resetForm = () => {
    setName(''); setDescription(''); setTrigger('');
    setConditions([{ field: '', operator: 'equals', value: '' }]);
    setActions([{ type: '' }]);
  };

  // Workflow templates library
  const TEMPLATES = [
    {
      id: 'urgent-escalate',
      icon: '🚨',
      name: isAr ? 'تصعيد التذاكر العاجلة' : 'Escalate Urgent Tickets',
      desc: isAr ? 'عند إنشاء تذكرة بأولوية urgent، أرسل إشعار Slack وبريد للمدير.' : 'When an urgent ticket is created, notify Slack and email manager.',
      payload: {
        name: isAr ? 'تصعيد العاجل' : 'Escalate Urgent',
        description: isAr ? 'إشعار فوري للتذاكر العاجلة' : 'Instant notification for urgent tickets',
        trigger: 'ticket.created',
        conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
        actions: [
          { type: 'send_slack', channel: '#urgent-tickets', message: '🚨 Urgent ticket created' },
          { type: 'send_notification', title: isAr ? 'تذكرة عاجلة' : 'Urgent ticket', message: isAr ? 'تم إنشاء تذكرة عاجلة جديدة' : 'A new urgent ticket has been created' },
        ],
      },
    },
    {
      id: 'auto-assign-billing',
      icon: '💳',
      name: isAr ? 'توجيه تذاكر الفوترة' : 'Route Billing Tickets',
      desc: isAr ? 'عند إنشاء تذكرة بكلمة "فوترة"، حوّلها لقسم المالية.' : 'When a ticket title contains "billing", route to finance dept.',
      payload: {
        name: isAr ? 'توجيه الفوترة' : 'Route Billing',
        description: '',
        trigger: 'ticket.created',
        conditions: [{ field: 'title', operator: 'contains', value: isAr ? 'فوترة' : 'billing' }],
        actions: [{ type: 'assign_department', value: '<DEPARTMENT_ID>' }],
      },
    },
    {
      id: 'auto-close-resolved',
      icon: '✅',
      name: isAr ? 'إغلاق التذاكر المحلولة' : 'Auto-close Resolved',
      desc: isAr ? 'عند تغيير الحالة إلى resolved، أرسل بريد شكر للعميل.' : 'When status changes to resolved, send thank-you email.',
      payload: {
        name: isAr ? 'شكر العميل بعد الحل' : 'Thank customer after resolve',
        description: '',
        trigger: 'ticket.status_changed',
        conditions: [{ field: 'status', operator: 'equals', value: 'resolved' }],
        actions: [{ type: 'send_email', title: isAr ? 'تم حل تذكرتك' : 'Your ticket is resolved', message: isAr ? 'شكراً لاستخدامك خدمتنا' : 'Thank you for using our service' }],
      },
    },
    {
      id: 'webhook-on-create',
      icon: '🔗',
      name: isAr ? 'Webhook عند الإنشاء' : 'Webhook on Create',
      desc: isAr ? 'أرسل كل التذاكر الجديدة إلى نظام خارجي عبر Webhook.' : 'Push every new ticket to an external system via Webhook.',
      payload: {
        name: isAr ? 'مزامنة التذاكر الجديدة' : 'Sync new tickets',
        description: '',
        trigger: 'ticket.created',
        conditions: [],
        actions: [{ type: 'webhook' }],
      },
    },
  ];

  const applyTemplate = (tpl: any) => {
    const p = tpl.payload;
    setName(p.name);
    setDescription(p.description || '');
    setTrigger(p.trigger);
    setConditions(p.conditions.length ? p.conditions : [{ field: '', operator: 'equals', value: '' }]);
    setActions(p.actions);
    setOpen(true);
    toast({ title: isAr ? `تم تحميل القالب: ${tpl.name}` : `Template loaded: ${tpl.name}` });
  };

  const updateCondition = (i: number, key: keyof Condition, val: string) => {
    setConditions(c => c.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  };

  const updateAction = (i: number, key: string, val: string) => {
    setActions(a => a.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  };

  const dialogTrigger = (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t.admin.addRule}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader><DialogTitle>{t.admin.createRule}</DialogTitle></DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t.admin.ruleName}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t.admin.ruleNamePlaceholder} /></div>
            <div><Label>{t.admin.ruleDesc}</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t.admin.ruleDescPlaceholder} /></div>
          </div>


                    <div className="p-3 rounded-xl border bg-primary/5">
                      <Label className="text-xs font-bold text-primary mb-2 block">⚡ {t.admin.triggerLabel}</Label>
                      <Select value={trigger} onValueChange={setTrigger}>
                        <SelectTrigger><SelectValue placeholder={t.admin.selectEvent} /></SelectTrigger>
                        <SelectContent>
                          {TRIGGER_EVENTS.map(te => <SelectItem key={te.value} value={te.value}>{te.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground" />

                    <div className="p-3 rounded-xl border bg-accent/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-bold">🔍 {t.admin.conditionsLabel}</Label>
                        <Button variant="ghost" size="sm" onClick={() => setConditions(c => [...c, { field: '', operator: 'equals', value: '' }])}>
                          <Plus className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t.admin.addCondition}
                        </Button>
                      </div>
                      {conditions.map((cond, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <Select value={cond.field} onValueChange={v => updateCondition(i, 'field', v)}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder={t.admin.fieldLabel} /></SelectTrigger>
                            <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={cond.operator} onValueChange={v => updateCondition(i, 'operator', v)}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input className="flex-1" value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)} placeholder={t.admin.valueLabel} />
                          {conditions.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setConditions(c => c.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <ArrowDown className="h-5 w-5 mx-auto text-muted-foreground" />

                    <div className="p-3 rounded-xl border bg-success/5">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-bold text-success">🚀 {t.admin.actionsLabel}</Label>
                        <Button variant="ghost" size="sm" onClick={() => setActions(a => [...a, { type: '' }])}>
                          <Plus className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t.admin.addAction}
                        </Button>
                      </div>
                      {actions.map((act, i) => (
                        <div key={i} className="mb-3 p-2 rounded-lg border bg-background">
                          <div className="flex items-center gap-2 mb-2">
                            <Select value={act.type} onValueChange={v => updateAction(i, 'type', v)}>
                              <SelectTrigger className="flex-1"><SelectValue placeholder={t.admin.actionType} /></SelectTrigger>
                              <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                            </Select>
                            {actions.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActions(a => a.filter((_, idx) => idx !== i))}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {(act.type === 'change_priority') && (
                            <Input value={act.value || ''} onChange={e => updateAction(i, 'value', e.target.value)} placeholder={t.admin.actionPlaceholders.priority} className="text-xs" />
                          )}
                          {(act.type === 'change_status') && (
                            <Input value={act.value || ''} onChange={e => updateAction(i, 'value', e.target.value)} placeholder={t.admin.actionPlaceholders.status} className="text-xs" />
                          )}
                          {(act.type === 'assign_agent' || act.type === 'assign_department') && (
                            <Input value={act.value || ''} onChange={e => updateAction(i, 'value', e.target.value)}
                              placeholder={act.type === 'assign_agent' ? t.admin.actionPlaceholders.agentId : t.admin.actionPlaceholders.deptId} dir="ltr" className="text-xs" />
                          )}
                          {act.type === 'send_notification' && (
                            <div className="space-y-2">
                              <Input value={act.title || ''} onChange={e => updateAction(i, 'title', e.target.value)} placeholder={t.admin.actionPlaceholders.notificationTitle} className="text-xs" />
                              <Textarea value={act.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} placeholder={t.admin.actionPlaceholders.notificationMessage} className="text-xs" rows={2} />
                            </div>
                          )}
                          {act.type === 'send_email' && (
                            <div className="space-y-2">
                              <Input value={act.recipient_email || ''} onChange={e => updateAction(i, 'recipient_email', e.target.value)} placeholder={t.admin.actionPlaceholders.emailRecipient} dir="ltr" className="text-xs" />
                              <Input value={act.title || ''} onChange={e => updateAction(i, 'title', e.target.value)} placeholder={t.admin.actionPlaceholders.emailSubject} className="text-xs" />
                              <Textarea value={act.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} placeholder={t.admin.actionPlaceholders.emailBody} className="text-xs" rows={2} />
                            </div>
                          )}
                          {act.type === 'send_slack' && (
                            <div className="space-y-2">
                              <Input value={act.channel || ''} onChange={e => updateAction(i, 'channel', e.target.value)} placeholder={t.admin.actionPlaceholders.slackChannel} dir="ltr" className="text-xs" />
                              <Textarea value={act.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} placeholder={t.admin.actionPlaceholders.slackMessage} className="text-xs" rows={2} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button className="w-full" disabled={!name || !trigger || actions.every(a => !a.type)}
                      onClick={() => createMutation.mutate()}>
                      {t.admin.createRule}
                    </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.automationTitle}
        icon={<Zap className="h-4 w-4" />}
        actions={dialogTrigger}
      />
      <PageContainer maxWidth="lg">
        <Tabs defaultValue="rules" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="rules" className="rounded-lg text-xs">{t.admin.rulesTab}</TabsTrigger>
            <TabsTrigger value="templates" className="rounded-lg text-xs gap-1.5"><Library className="h-3.5 w-3.5" />{isAr ? 'القوالب' : 'Templates'}</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg text-xs">{t.admin.logsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-3 mt-4">
            {isLoading ? (
              <AdminTableSkeleton rows={4} />
            ) : rules.length === 0 ? (
              <EmptyState
                icon={Zap}
                title={t.admin.noRules}
                description={isAr ? 'ابدأ من قالب جاهز أو أنشئ قاعدة جديدة من الصفر.' : 'Start from a ready template or create a new rule from scratch.'}
                action={dialogTrigger}
              />
            ) : (
              rules.map((rule: any) => (
                <Card key={rule.id} className="rounded-2xl border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Zap className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-semibold text-sm">{rule.name}</h3>
                        <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px] rounded-lg">{rule.is_active ? t.admin.ruleActive : t.admin.ruleInactive}</Badge>
                        <Badge variant="outline" className="text-[10px] rounded-lg">{TRIGGER_EVENTS.find(te => te.value === rule.trigger_event)?.label || rule.trigger_event}</Badge>
                      </div>
                      {rule.description && <p className="text-xs text-muted-foreground mb-1">{rule.description}</p>}
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                        <span>{t.admin.conditions}: {(rule.conditions as any[])?.length || 0}</span>
                        <span>{t.admin.ruleActions}: {(rule.actions as any[])?.length || 0}</span>
                        <span>{t.admin.executionCount}: {rule.execution_count} {t.admin.executionTimes}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.is_active} onCheckedChange={v => toggleMutation.mutate({ id: rule.id, is_active: v })} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <SectionHeader
              title={isAr ? 'مكتبة القوالب الجاهزة' : 'Workflow Templates Library'}
              description={isAr ? 'ابدأ من قالب مُجرَّب وعدّله حسب احتياجك.' : 'Start from a battle-tested template and tweak it.'}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEMPLATES.map((tpl, i) => (
                <motion.div key={tpl.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="rounded-2xl border-border/50 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group h-full" onClick={() => applyTemplate(tpl)}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{tpl.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{tpl.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tpl.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <Badge variant="outline" className="text-[10px] rounded-lg">{tpl.payload.trigger}</Badge>
                        <Badge variant="secondary" className="text-[10px] rounded-lg">{tpl.payload.actions.length} {isAr ? 'إجراء' : 'actions'}</Badge>
                      </div>
                      <Button size="sm" variant="ghost" className="w-full rounded-lg text-xs gap-1.5 mt-2 group-hover:bg-primary/10">
                        <Plus className="h-3.5 w-3.5" />
                        {isAr ? 'استخدام القالب' : 'Use template'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2 mt-4">
            {logs.length === 0 ? (
              <EmptyState icon={CheckCircle} variant="compact" title={isAr ? 'لا توجد سجلات تنفيذ' : 'No execution logs yet'} />
            ) : logs.map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 text-xs border border-border/50 rounded-xl px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                {log.success ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                <Badge variant="outline" className="text-[10px] rounded-lg">{log.trigger_event}</Badge>
                <span className="text-muted-foreground flex-1 truncate font-mono">{format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: dateLocale })}</span>
                {log.error_message && <span className="text-destructive text-[10px] truncate max-w-[200px]">{log.error_message}</span>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageLayout>
  );
}
