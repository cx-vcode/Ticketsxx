import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageContainer, PageHeader, SectionHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plug, Search, CheckCircle2, XCircle, Loader2, Plus, Settings2, TestTube2, Activity, ArrowRightLeft, Code2 } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/common';
import { cn } from '@/lib/utils';

type Provider = {
  id: string; code: string; name: string; display_name_ar: string | null;
  description: string | null; description_ar: string | null;
  category: string; logo_url: string | null; brand_color: string | null;
  auth_type: string; supports_inbound: boolean; supports_outbound: boolean;
  available_events: string[]; available_actions: string[];
  is_active: boolean; is_premium: boolean;
};

type Connection = {
  id: string; provider_id: string; name: string; description: string | null;
  status: string; is_active: boolean; sync_direction: string;
  config: any; credentials: any; trigger_events: string[];
  last_sync_at: string | null; last_error_message: string | null;
  total_synced: number; total_failed: number;
};

const statusBadge = (status: string, active: boolean) => {
  if (!active) return { label: 'متوقّف', cls: 'bg-muted text-muted-foreground border-border' };
  if (status === 'connected') return { label: 'متصل', cls: 'bg-success/15 text-success border-success/30' };
  if (status === 'error') return { label: 'خطأ', cls: 'bg-destructive/15 text-destructive border-destructive/30' };
  return { label: 'في الانتظار', cls: 'bg-warning/15 text-warning border-warning/30' };
};

const ProviderCard = memo(function ProviderCard({ provider, connectionCount, onConnect }: {
  provider: Provider; connectionCount: number; onConnect: () => void;
}) {
  const { lang } = useLanguage();
  const desc = lang === 'ar' ? (provider.description_ar || provider.description) : provider.description;
  const name = lang === 'ar' ? (provider.display_name_ar || provider.name) : provider.name;
  return (
    <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur hover:shadow-lg hover:shadow-primary/5 transition-all group">
      <CardHeader className="flex flex-row items-start gap-3 pb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: provider.brand_color || 'hsl(var(--primary))' }}
        >
          {provider.code === 'slack' && '#'}
          {provider.code === 'microsoft_teams' && 'T'}
          {provider.code === 'jira' && 'J'}
          {!['slack', 'microsoft_teams', 'jira'].includes(provider.code) && provider.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {name}
            {provider.is_premium && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">PRO</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{provider.category.replace('_', ' ')}</p>
        </div>
        {connectionCount > 0 && (
          <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">
            {connectionCount} متّصل
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[40px]">{desc}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {provider.supports_inbound && <Badge variant="outline" className="text-[10px]">📥 Inbound</Badge>}
          {provider.supports_outbound && <Badge variant="outline" className="text-[10px]">📤 Outbound</Badge>}
          <Badge variant="outline" className="text-[10px] capitalize">{provider.auth_type}</Badge>
        </div>
        <Button onClick={onConnect} size="sm" className="w-full rounded-xl group-hover:bg-primary group-hover:text-primary-foreground">
          <Plus className="w-4 h-4 me-1.5" /> ربط جديد
        </Button>
      </CardContent>
    </Card>
  );
});

function ConnectionWizard({ provider, open, onClose, onSaved, editing }: {
  provider: Provider | null; open: boolean; onClose: () => void; onSaved: () => void;
  editing?: Connection | null;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(editing?.name || '');
  const [direction, setDirection] = useState(editing?.sync_direction || 'bidirectional');
  const [config, setConfig] = useState<Record<string, string>>(editing?.config || {});
  const [credentials, setCredentials] = useState<Record<string, string>>(editing?.credentials || {});
  const [events, setEvents] = useState<string[]>(editing?.trigger_events || []);
  const [advanced, setAdvanced] = useState(false);
  const [advancedJson, setAdvancedJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!provider) return null;

  const handleSave = async (activate: boolean) => {
    setSaving(true);
    try {
      let payload: any = {
        provider_id: provider.id,
        name: name || provider.name,
        sync_direction: direction,
        config, credentials, trigger_events: events,
        is_active: activate,
        status: activate ? 'connected' : 'inactive',
      };
      if (advanced && advancedJson) {
        try { payload = { ...payload, ...JSON.parse(advancedJson) }; }
        catch { toast.error('JSON غير صالح'); setSaving(false); return; }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصرح');

      if (editing) {
        const { error } = await supabase.from('integration_connections').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integration_connections').insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
      toast.success(editing ? 'تم تحديث الاتصال' : 'تم إنشاء الاتصال بنجاح');
      onSaved(); onClose();
      setStep(1); setName(''); setConfig({}); setCredentials({}); setEvents([]);
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!editing) { toast.error('احفظ الاتصال أولاً ثم اختبره'); return; }
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('integrations-test', {
        body: { connection_id: editing.id },
      });
      if (error) throw error;
      if (data?.success) {
        setTestResult({ ok: true, msg: 'الاتصال يعمل بنجاح! تحقّق من المنصة الخارجية لرؤية رسالة الاختبار.' });
      } else {
        setTestResult({ ok: false, msg: data?.error || 'فشل الاختبار' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || 'فشل الاختبار' });
    } finally {
      setTesting(false);
    }
  };

  const renderConfigFields = () => {
    if (provider.code === 'slack') {
      return (
        <div className="space-y-3">
          <div>
            <Label>القناة الافتراضية (مثل: #general أو C0123)</Label>
            <Input value={config.default_channel || ''} onChange={(e) => setConfig({ ...config, default_channel: e.target.value })} placeholder="#general" />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/40">
            💡 سيتم استخدام Lovable Connector لـ Slack — لا حاجة لـ API Token يدوي. اربط حسابك من خلال الإعدادات أولاً.
          </div>
        </div>
      );
    }
    if (provider.code === 'microsoft_teams') {
      return (
        <div className="space-y-3">
          <div>
            <Label>Team ID</Label>
            <Input value={config.team_id || ''} onChange={(e) => setConfig({ ...config, team_id: e.target.value })} placeholder="GUID" />
          </div>
          <div>
            <Label>Channel ID</Label>
            <Input value={config.channel_id || ''} onChange={(e) => setConfig({ ...config, channel_id: e.target.value })} placeholder="19:..." />
          </div>
        </div>
      );
    }
    if (provider.code === 'jira') {
      return (
        <div className="space-y-3">
          <div>
            <Label>Jira Base URL</Label>
            <Input value={config.base_url || ''} onChange={(e) => setConfig({ ...config, base_url: e.target.value })} placeholder="https://your-domain.atlassian.net" />
          </div>
          <div>
            <Label>Project Key</Label>
            <Input value={config.project_key || ''} onChange={(e) => setConfig({ ...config, project_key: e.target.value })} placeholder="TKT" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={credentials.email || ''} onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} placeholder="you@company.com" />
          </div>
          <div>
            <Label>API Token</Label>
            <Input type="password" value={credentials.api_token || ''} onChange={(e) => setCredentials({ ...credentials, api_token: e.target.value })} placeholder="••••••••" />
            <p className="text-[11px] text-muted-foreground mt-1">احصل عليه من id.atlassian.com/manage-profile/security/api-tokens</p>
          </div>
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground">لا يوجد إعدادات إضافية لهذا المزوّد.</p>;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" />
            {editing ? 'تعديل الاتصال' : `ربط ${provider.display_name_ar || provider.name}`}
          </DialogTitle>
          <DialogDescription>
            خطوة {step} من 4 — {step === 1 ? 'البيانات الأساسية' : step === 2 ? 'بيانات الاعتماد' : step === 3 ? 'الأحداث والمزامنة' : 'مراجعة واختبار'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-all',
              s <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>اسم الاتصال *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${provider.name} - فريق الدعم`} />
            </div>
            <div>
              <Label>اتجاه المزامنة</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">📤 صادر فقط (نرسل لهم)</SelectItem>
                  <SelectItem value="inbound">📥 وارد فقط (نستقبل منهم)</SelectItem>
                  <SelectItem value="bidirectional">🔄 ثنائي الاتجاه</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {renderConfigFields()}
            <div className="flex items-center gap-2 pt-3 border-t border-border/40">
              <Switch checked={advanced} onCheckedChange={setAdvanced} id="adv-mode" />
              <Label htmlFor="adv-mode" className="flex items-center gap-1.5 cursor-pointer">
                <Code2 className="w-4 h-4" /> الوضع المتقدم (JSON)
              </Label>
            </div>
            {advanced && (
              <Textarea
                value={advancedJson}
                onChange={(e) => setAdvancedJson(e.target.value)}
                placeholder='{"config": {...}, "credentials": {...}}'
                rows={6}
                className="font-mono text-xs"
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>الأحداث المُفعّلة</Label>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pe-2">
              {provider.available_events.map((ev) => (
                <label key={ev} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 hover:bg-accent/30 cursor-pointer transition-colors">
                  <input type="checkbox" checked={events.includes(ev)} onChange={(e) => {
                    setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev));
                  }} className="rounded" />
                  <span className="text-sm font-mono">{ev}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-border/40 space-y-2 text-sm">
              <div><span className="text-muted-foreground">المزوّد:</span> <strong>{provider.name}</strong></div>
              <div><span className="text-muted-foreground">الاسم:</span> <strong>{name}</strong></div>
              <div><span className="text-muted-foreground">الاتجاه:</span> <strong>{direction}</strong></div>
              <div><span className="text-muted-foreground">الأحداث:</span> <strong>{events.length}</strong></div>
            </div>
            {editing && (
              <Button variant="outline" onClick={handleTest} disabled={testing} className="w-full">
                {testing ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <TestTube2 className="w-4 h-4 me-2" />}
                اختبار الاتصال الآن
              </Button>
            )}
            {testResult && (
              <div className={cn('p-3 rounded-lg border text-sm flex items-start gap-2',
                testResult.ok ? 'bg-success/10 border-success/30 text-success' : 'bg-destructive/10 border-destructive/30 text-destructive')}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>السابق</Button>}
          {step < 4 && <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>التالي</Button>}
          {step === 4 && (
            <>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>حفظ كمسودة</Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                حفظ وتفعيل
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ConnectionRow = memo(function ConnectionRow({ conn, provider, onEdit, onToggle, onDelete, onTest }: {
  conn: Connection; provider?: Provider; onEdit: () => void; onToggle: () => void; onDelete: () => void; onTest: () => void;
}) {
  const sb = statusBadge(conn.status, conn.is_active);
  return (
    <Card className="rounded-2xl border-border/60 hover:border-primary/30 transition-all">
      <CardContent className="p-4 flex items-center gap-4 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
          style={{ backgroundColor: provider?.brand_color || 'hsl(var(--primary))' }}
        >
          {provider?.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm">{conn.name}</h3>
            <Badge className={sb.cls}>{sb.label}</Badge>
            <Badge variant="outline" className="text-[10px]">
              <ArrowRightLeft className="w-3 h-3 me-1" />{conn.sync_direction}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {provider?.name} · مزامن: {conn.total_synced} · فشل: {conn.total_failed}
          </p>
          {conn.last_error_message && (
            <p className="text-[11px] text-destructive mt-1 truncate" title={conn.last_error_message}>
              ⚠️ {conn.last_error_message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onTest} className="h-9"><TestTube2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-9"><Settings2 className="w-4 h-4" /></Button>
          <Switch checked={conn.is_active} onCheckedChange={onToggle} />
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-9 text-destructive hover:text-destructive">
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export default function AdminIntegrations() {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('marketplace');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);

  const { data: providers, isLoading: pl, isError: pe, refetch: rp } = useQuery({
    queryKey: ['integration_providers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integration_providers')
        .select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data as Provider[];
    },
  });

  const { data: connections, isLoading: cl, isError: ce, refetch: rc } = useQuery({
    queryKey: ['integration_connections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integration_connections')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Connection[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ['integration_sync_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('integration_sync_logs')
        .select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const filteredProviders = (providers || []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.display_name_ar || '').includes(search) || p.category.includes(search.toLowerCase())
  );

  const connectionsByProvider = (connections || []).reduce((acc, c) => {
    acc[c.provider_id] = (acc[c.provider_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleConnect = (provider: Provider) => {
    setSelectedProvider(provider); setEditingConn(null); setWizardOpen(true);
  };
  const handleEdit = (conn: Connection) => {
    const prov = providers?.find((p) => p.id === conn.provider_id) || null;
    setSelectedProvider(prov); setEditingConn(conn); setWizardOpen(true);
  };
  const handleToggle = async (conn: Connection) => {
    const { error } = await supabase.from('integration_connections')
      .update({ is_active: !conn.is_active }).eq('id', conn.id);
    if (error) toast.error(error.message);
    else { toast.success(!conn.is_active ? 'تم التفعيل' : 'تم الإيقاف'); qc.invalidateQueries({ queryKey: ['integration_connections'] }); }
  };
  const handleDelete = async (conn: Connection) => {
    if (!confirm(`حذف الاتصال "${conn.name}"؟`)) return;
    const { error } = await supabase.from('integration_connections').delete().eq('id', conn.id);
    if (error) toast.error(error.message);
    else { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['integration_connections'] }); }
  };
  const handleTest = async (conn: Connection) => {
    toast.loading('جارٍ الاختبار...', { id: 'test' });
    try {
      const { data, error } = await supabase.functions.invoke('integrations-test', { body: { connection_id: conn.id } });
      if (error) throw error;
      if (data?.success) toast.success('الاتصال يعمل! ✅', { id: 'test' });
      else toast.error(data?.error || 'فشل الاختبار', { id: 'test' });
      qc.invalidateQueries({ queryKey: ['integration_connections'] });
    } catch (e: any) {
      toast.error(e.message, { id: 'test' });
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="منصة التكامل الموحدة"
        icon={<Plug className="w-5 h-5" />}
      />
      <PageContainer>
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="marketplace">السوق</TabsTrigger>
            <TabsTrigger value="connections">
              الاتصالات {connections && connections.length > 0 && <Badge className="ms-2 h-5">{connections.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="logs">السجلات</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ابحث عن منصة..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10" />
            </div>
            {pl ? <LoadingSpinner /> : pe ? <ErrorState onRetry={() => rp()} /> :
              filteredProviders.length === 0 ? <EmptyState icon={Plug} title="لا توجد نتائج" description="جرّب بحثًا آخر" /> :
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProviders.map((p) => (
                  <ProviderCard key={p.id} provider={p} connectionCount={connectionsByProvider[p.id] || 0} onConnect={() => handleConnect(p)} />
                ))}
              </div>
            }
          </TabsContent>

          <TabsContent value="connections" className="space-y-3">
            <SectionHeader title="الاتصالات النشطة" description="جميع التكاملات المُهيّأة في النظام" icon={<Activity className="w-4 h-4" />} />
            {cl ? <LoadingSpinner /> : ce ? <ErrorState onRetry={() => rc()} /> :
              !connections || connections.length === 0 ?
              <EmptyState icon={Plug} title="لا توجد اتصالات بعد" description="اذهب إلى السوق لإضافة أول تكامل" /> :
              connections.map((c) => (
                <ConnectionRow
                  key={c.id} conn={c}
                  provider={providers?.find((p) => p.id === c.provider_id)}
                  onEdit={() => handleEdit(c)}
                  onToggle={() => handleToggle(c)}
                  onDelete={() => handleDelete(c)}
                  onTest={() => handleTest(c)}
                />
              ))
            }
          </TabsContent>

          <TabsContent value="logs" className="space-y-2">
            <SectionHeader title="آخر 50 عملية مزامنة" description="سجل تفصيلي لكل عملية تبادل بيانات" icon={<Activity className="w-4 h-4" />} />
            {!logs || logs.length === 0 ? <EmptyState icon={Activity} title="لا توجد سجلات بعد" description="ستظهر هنا فور حدوث أول عملية مزامنة" /> :
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <Card key={log.id} className="rounded-xl border-border/40">
                    <CardContent className="p-3 flex items-center gap-3 text-sm flex-wrap">
                      {log.status === 'success' ?
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> :
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                      <Badge variant="outline" className="text-[10px]">{log.direction}</Badge>
                      <span className="font-mono text-xs">{log.event_type}</span>
                      {log.http_status && <Badge variant="outline" className="text-[10px]">HTTP {log.http_status}</Badge>}
                      {log.duration_ms && <span className="text-[11px] text-muted-foreground">{log.duration_ms}ms</span>}
                      <span className="text-[11px] text-muted-foreground ms-auto">{new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                      {log.error_message && (
                        <p className="text-[11px] text-destructive w-full truncate" title={log.error_message}>{log.error_message}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            }
          </TabsContent>
        </Tabs>

        <ConnectionWizard
          provider={selectedProvider}
          open={wizardOpen}
          onClose={() => { setWizardOpen(false); setEditingConn(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['integration_connections'] }); }}
          editing={editingConn}
        />
      </PageContainer>
    </PageLayout>
  );
}
