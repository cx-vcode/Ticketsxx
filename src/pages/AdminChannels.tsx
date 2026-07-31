import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader, PageContainer, SectionHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';
import {
  MessageSquare, Mail, Globe, Plus, Settings, Activity,
  ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock,
  Smartphone, Zap, TrendingUp, MessageCircle, Bot, Hash, RefreshCw,
  Send, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState, ErrorState, AdminTableSkeleton } from '@/components/common';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

interface ChannelDef {
  id: string;
  name: string;
  icon: any;
  color: string;
  gradient: string;
  provider: string; // matches integration_connections.provider
  sourceSystem?: string; // optional matching source_system enum
}

const channelCatalog: ChannelDef[] = [
  { id: 'whatsapp', name: 'WhatsApp Business', icon: MessageCircle, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/10 to-emerald-600/5', provider: 'whatsapp' },
  { id: 'teams',    name: 'Microsoft Teams',   icon: Hash,          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',       gradient: 'from-blue-500/10 to-blue-600/5',       provider: 'teams' },
  { id: 'email',    name: 'Email',             icon: Mail,          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',    gradient: 'from-amber-500/10 to-amber-600/5',     provider: 'email' },
  { id: 'portal',   name: 'Customer Portal',   icon: Globe,         color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', gradient: 'from-purple-500/10 to-purple-600/5',   provider: 'portal',   sourceSystem: 'PORTAL' },
  { id: 'sms',      name: 'SMS / Twilio',      icon: Smartphone,    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',       gradient: 'from-rose-500/10 to-rose-600/5',       provider: 'sms' },
  { id: 'chatbot',  name: 'AI Chatbot',        icon: Bot,           color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',       gradient: 'from-cyan-500/10 to-cyan-600/5',       provider: 'chatbot' },
];

export default function AdminChannels() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [showSetup, setShowSetup] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [setupForm, setSetupForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [connections, setConnections] = useState<any[]>([]);
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [connRes, ticketsRes, recentRes] = await Promise.all([
        supabase.from('integration_connections' as any).select('*'),
        supabase.from('tickets').select('source_system'),
        supabase.from('tickets').select('id, ticket_number, title, source_system, status, created_at')
          .order('created_at', { ascending: false }).limit(8),
      ]);
      if (connRes.error) throw connRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      if (recentRes.error) throw recentRes.error;

      setConnections(connRes.data || []);
      const counts: Record<string, number> = {};
      (ticketsRes.data || []).forEach((row: any) => {
        const src = row.source_system || 'PORTAL';
        counts[src] = (counts[src] || 0) + 1;
      });
      setTicketCounts(counts);
      setRecentTickets(recentRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const channelData = useMemo(() => channelCatalog.map(c => {
    const conn = connections.find(x => x.provider === c.provider);
    const incoming = c.sourceSystem ? (ticketCounts[c.sourceSystem] || 0) : 0;
    return {
      ...c,
      connection: conn,
      isActive: conn?.status === 'connected' || conn?.is_active === true,
      incoming,
      outgoing: 0,
    };
  }), [connections, ticketCounts]);

  const totalIncoming = Object.values(ticketCounts).reduce((s, n) => s + n, 0);
  const activeCount = channelData.filter(c => c.isActive).length;

  const saveChannel = async () => {
    if (!selectedChannel) {
      toast.error(t('اختر نوع القناة', 'Select a channel type'));
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase
        .from('integration_connections' as any)
        .insert({
          provider: selectedChannel,
          account_name: setupForm.account_name || channelCatalog.find(c => c.id === selectedChannel)?.name,
          status: 'connected',
          is_active: true,
          credentials: setupForm,
          created_by: user?.id,
        } as any);
      if (insErr) throw insErr;
      toast.success(t('تم حفظ إعدادات القناة', 'Channel saved successfully'));
      setShowSetup(false);
      setSelectedChannel('');
      setSetupForm({});
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const disconnectChannel = async (id: string) => {
    if (!confirm(t('هل أنت متأكد من فصل هذه القناة؟', 'Disconnect this channel?'))) return;
    const { error } = await supabase.from('integration_connections' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('تم فصل القناة', 'Channel disconnected'));
      loadData();
    }
  };

  const setupSchema: Record<string, { label: string; key: string; type?: string }[]> = {
    whatsapp: [
      { label: 'Phone Number ID', key: 'phone_number_id' },
      { label: 'Access Token', key: 'access_token', type: 'password' },
      { label: 'Webhook Verify Token', key: 'verify_token' },
    ],
    teams: [
      { label: 'Azure Bot App ID', key: 'app_id' },
      { label: 'App Secret', key: 'app_secret', type: 'password' },
      { label: 'Webhook URL', key: 'webhook_url' },
    ],
    sms: [
      { label: 'Twilio Account SID', key: 'account_sid' },
      { label: 'Auth Token', key: 'auth_token', type: 'password' },
      { label: 'From Number', key: 'from_number' },
    ],
    chatbot: [
      { label: 'Bot Name', key: 'bot_name' },
      { label: 'API Key', key: 'api_key', type: 'password' },
    ],
    email: [
      { label: 'IMAP Host', key: 'imap_host' },
      { label: 'Username', key: 'username' },
      { label: 'Password', key: 'password', type: 'password' },
    ],
  };

  return (
    <PageLayout>
      <PageHeader title={t('القنوات المتعددة', 'Omni-Channel')} icon={<MessageSquare className="h-4 w-4" />} />
      <PageContainer>
        {/* KPIs */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('القنوات النشطة', 'Active Channels'), value: activeCount, icon: Activity, color: 'text-success' },
            { label: t('إجمالي التذاكر الواردة', 'Total Incoming'), value: totalIncoming, icon: ArrowDownLeft, color: 'text-info' },
            { label: t('قنوات قابلة للربط', 'Available Channels'), value: channelCatalog.length, icon: Globe, color: 'text-primary' },
            { label: t('بانتظار التهيئة', 'Pending Setup'), value: channelCatalog.length - activeCount, icon: Clock, color: 'text-warning' },
          ].map((kpi, i) => (
            <Card key={i} className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-all duration-300">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        <SectionHeader
          title={t('قنوات الاتصال', 'Communication Channels')}
          description={t('قم بربط وإدارة قنواتك المتعددة من مكان واحد', 'Connect and manage all your channels in one place')}
          icon={<Globe className="h-4 w-4" />}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl">
                <RefreshCw className="h-3.5 w-3.5 me-1" />{t('تحديث', 'Refresh')}
              </Button>
              <Dialog open={showSetup} onOpenChange={setShowSetup}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 rounded-xl">
                    <Plus className="h-4 w-4" />
                    {t('إضافة قناة', 'Add Channel')}
                  </Button>
                </DialogTrigger>
                <DialogContent dir={isAr ? 'rtl' : 'ltr'}>
                  <DialogHeader>
                    <DialogTitle>{t('إعداد قناة جديدة', 'Setup New Channel')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>{t('نوع القناة', 'Channel Type')}</Label>
                      <Select value={selectedChannel} onValueChange={(v) => { setSelectedChannel(v); setSetupForm({}); }}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder={t('اختر القناة', 'Select channel')} /></SelectTrigger>
                        <SelectContent>
                          {channelCatalog.filter(c => c.id !== 'portal').map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedChannel && setupSchema[selectedChannel]?.map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type={field.type || 'text'}
                          value={setupForm[field.key] || ''}
                          onChange={e => setSetupForm({ ...setupForm, [field.key]: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSetup(false)} className="rounded-xl">
                      {t('إلغاء', 'Cancel')}
                    </Button>
                    <Button onClick={saveChannel} disabled={saving || !selectedChannel} className="rounded-xl">
                      <Zap className="h-4 w-4 me-2" />
                      {saving ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ وتفعيل', 'Save & Activate')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          }
        />

        {error ? (
          <ErrorState description={error} onRetry={loadData} />
        ) : loading ? (
          <AdminTableSkeleton rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channelData.map((ch, i) => (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group">
                    <div className={`h-1 w-full bg-gradient-to-r ${ch.gradient}`} />
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${ch.color} flex items-center justify-center`}>
                            <ch.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-foreground">{ch.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {ch.isActive ? (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-success/30 text-success bg-success/5">
                                  <CheckCircle2 className="h-2.5 w-2.5 me-0.5" />
                                  {t('نشط', 'Active')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
                                  <XCircle className="h-2.5 w-2.5 me-0.5" />
                                  {t('غير مفعل', 'Inactive')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {ch.connection && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => disconnectChannel(ch.connection.id)}
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-muted/40 p-2.5 text-center">
                          <p className="text-lg font-bold text-foreground">{ch.incoming}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <ArrowDownLeft className="h-2.5 w-2.5" /> {t('وارد', 'In')}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-2.5 text-center">
                          <p className="text-lg font-bold text-foreground">{ch.outgoing}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                            <ArrowUpRight className="h-2.5 w-2.5" /> {t('صادر', 'Out')}
                          </p>
                        </div>
                      </div>

                      {!ch.isActive && ch.id !== 'portal' && (
                        <Button
                          variant="outline" size="sm"
                          onClick={() => { setSelectedChannel(ch.id); setShowSetup(true); }}
                          className="w-full rounded-xl text-xs"
                        >
                          <Plus className="h-3 w-3 me-1" />
                          {t('ربط الآن', 'Connect now')}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Recent activity from real tickets */}
            <Card className="rounded-2xl border-border/50 shadow-card overflow-hidden mt-6">
              <CardHeader className="border-b border-border/40">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {t('آخر التذاكر عبر القنوات', 'Recent Cross-Channel Tickets')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentTickets.length === 0 ? (
                  <EmptyState icon={MessageSquare} title={t('لا توجد تذاكر حديثة', 'No recent tickets')} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">{t('العنوان', 'Title')}</TableHead>
                        <TableHead className="text-xs">{t('القناة', 'Channel')}</TableHead>
                        <TableHead className="text-xs">{t('الحالة', 'Status')}</TableHead>
                        <TableHead className="text-xs text-end">{t('الوقت', 'Time')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTickets.map(tk => (
                        <TableRow key={tk.id}>
                          <TableCell className="font-mono text-xs">{tk.ticket_number}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{tk.title}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{tk.source_system}</Badge></TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{tk.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground text-end">
                            {formatDistanceToNow(new Date(tk.created_at), { addSuffix: true, locale: isAr ? arLocale : undefined })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageContainer>
    </PageLayout>
  );
}
