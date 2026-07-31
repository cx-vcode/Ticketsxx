import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { motion } from 'framer-motion';
import {
  Activity, CheckCircle, AlertTriangle, XCircle, Server, Database,
  Wifi, Clock, TrendingUp, Zap, RefreshCw, Shield,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format, subHours } from 'date-fns';
import { ar } from 'date-fns/locale';

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'operational': return <CheckCircle className="h-5 w-5 text-success" />;
    case 'degraded': return <AlertTriangle className="h-5 w-5 text-warning" />;
    case 'down': return <XCircle className="h-5 w-5 text-destructive" />;
    default: return <Activity className="h-5 w-5 text-muted-foreground" />;
  }
};

const statusLabel: Record<string, string> = {
  operational: 'يعمل بشكل طبيعي',
  degraded: 'أداء منخفض',
  down: 'متوقف',
};

const statusColor: Record<string, string> = {
  operational: 'bg-success/10 text-success border-success/20',
  degraded: 'bg-warning/10 text-warning border-warning/20',
  down: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function SystemHealthMonitoring() {
  const { data: integrations = [] } = useQuery({
    queryKey: ['health-integrations'],
    queryFn: async () => {
      const { data } = await supabase.from('integration_configs').select('*');
      return data || [];
    },
  });

  const { data: recentTickets = [] } = useQuery({
    queryKey: ['health-recent-tickets'],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data } = await supabase.from('tickets').select('id, created_at, status').gte('created_at', since);
      return data || [];
    },
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['health-webhook-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Generate mock uptime data for visualization
  const uptimeData = Array.from({ length: 24 }, (_, i) => ({
    hour: format(subHours(new Date(), 23 - i), 'HH:mm'),
    uptime: 95 + Math.random() * 5,
    requests: Math.floor(50 + Math.random() * 200),
  }));

  const services = [
    { name: 'خادم التطبيق', icon: Server, status: 'operational', uptime: '99.97%' },
    { name: 'قاعدة البيانات', icon: Database, status: 'operational', uptime: '99.99%' },
    { name: 'API الخارجي', icon: Wifi, status: integrations.some(i => i.error_message) ? 'degraded' : 'operational', uptime: '99.85%' },
    { name: 'نظام الإشعارات', icon: Zap, status: 'operational', uptime: '99.92%' },
    { name: 'المزامنة الثنائية', icon: RefreshCw, status: integrations.some(i => i.sync_status === 'error') ? 'degraded' : 'operational', uptime: '99.80%' },
    { name: 'نظام الأمان', icon: Shield, status: 'operational', uptime: '100%' },
  ];

  const overallStatus = services.every(s => s.status === 'operational') ? 'operational' : services.some(s => s.status === 'down') ? 'down' : 'degraded';
  const activeIntegrations = integrations.filter(i => i.is_active).length;
  const webhookSuccessRate = webhookLogs.length > 0 ? Math.round((webhookLogs.filter(l => l.success).length / webhookLogs.length) * 100) : 100;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-bold text-foreground">مراقبة صحة النظام</h1>
                <p className="text-xs text-muted-foreground">متابعة حالة جميع الخدمات والتكاملات</p>
              </div>
            </div>
            <NotificationsPopover />
          </header>

          <div className="p-6 space-y-6">
            {/* Overall Status Banner */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`border-2 ${overallStatus === 'operational' ? 'border-success/30' : 'border-warning/30'}`}>
                <CardContent className="flex items-center gap-4 py-6">
                  <div className={`p-3 rounded-2xl ${overallStatus === 'operational' ? 'bg-success/10' : 'bg-warning/10'}`}>
                    <StatusIcon status={overallStatus} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-foreground">
                      {overallStatus === 'operational' ? 'جميع الأنظمة تعمل بشكل طبيعي ✅' : 'بعض الأنظمة تحتاج اهتماماً ⚠️'}
                    </h2>
                    <p className="text-sm text-muted-foreground">آخر تحديث: {format(new Date(), 'dd MMM yyyy HH:mm', { locale: ar })}</p>
                  </div>
                  <Badge className={statusColor[overallStatus]}>{statusLabel[overallStatus]}</Badge>
                </CardContent>
              </Card>
            </motion.div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'التذاكر (24 ساعة)', value: recentTickets.length, icon: TrendingUp, color: 'text-primary' },
                { label: 'التكاملات النشطة', value: `${activeIntegrations}/${integrations.length}`, icon: Wifi, color: 'text-success' },
                { label: 'نجاح Webhooks', value: `${webhookSuccessRate}%`, icon: Zap, color: webhookSuccessRate >= 95 ? 'text-success' : 'text-warning' },
                { label: 'متوسط وقت الاستجابة', value: '145ms', icon: Clock, color: 'text-info' },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Card>
                    <CardContent className="flex items-center gap-4 py-5">
                      <div className="p-2.5 rounded-xl bg-muted/50">
                        <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Services Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> حالة الخدمات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((service, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <service.icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{service.name}</p>
                        <p className="text-xs text-muted-foreground">وقت التشغيل: {service.uptime}</p>
                      </div>
                      <StatusIcon status={service.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Uptime Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">وقت التشغيل (آخر 24 ساعة)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={uptimeData}>
                      <defs>
                        <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis domain={[90, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="uptime" stroke="hsl(var(--success))" fill="url(#uptimeGrad)" name="% وقت التشغيل" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Requests Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">الطلبات في الساعة</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={uptimeData}>
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="عدد الطلبات" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Integration Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> صحة التكاملات</CardTitle>
              </CardHeader>
              <CardContent>
                {integrations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد تكاملات مكوّنة</p>
                ) : (
                  <div className="space-y-3">
                    {integrations.map(integration => (
                      <div key={integration.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/50">
                        <StatusIcon status={integration.is_active ? (integration.error_message ? 'degraded' : 'operational') : 'down'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{integration.module_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{integration.module_code} — {integration.sync_direction}</p>
                        </div>
                        <div className="text-left text-xs space-y-1">
                          <p className="text-muted-foreground">استقبال: {integration.tickets_received}</p>
                          <p className="text-muted-foreground">مزامنة: {integration.tickets_synced_back}</p>
                        </div>
                        <Badge className={integration.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {integration.is_active ? 'نشط' : 'معطل'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Webhook Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> آخر أنشطة Webhooks</CardTitle>
              </CardHeader>
              <CardContent>
                {webhookLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {webhookLogs.slice(0, 10).map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 text-sm">
                        {log.success ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                        <span className="font-medium text-foreground">{log.event_type}</span>
                        <span className="text-muted-foreground">HTTP {log.response_status}</span>
                        <span className="mr-auto text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm dd/MM')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
