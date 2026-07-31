import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Plug, CheckCircle, XCircle, RefreshCw, ArrowLeftRight, ArrowDown, ArrowUp,
  Activity, BookOpen, DollarSign, Users, GraduationCap, ShoppingBag,
  School, LayoutDashboard, UserCog, Globe, Copy, ExternalLink,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const moduleIcons: Record<string, any> = {
  LMS: BookOpen, ERP: DollarSign, SIS: GraduationCap, CPAY: DollarSign,
  EDUMALLS: ShoppingBag, SMART_SCHOOL: School, DASHBOARD: LayoutDashboard,
  HR: UserCog, PORTAL: Globe,
};

const moduleColors: Record<string, string> = {
  LMS: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  ERP: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  SIS: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  CPAY: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  EDUMALLS: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  SMART_SCHOOL: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  DASHBOARD: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  HR: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  PORTAL: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
};

const syncDirectionLabels: Record<string, { label: string; icon: any }> = {
  inbound: { label: 'استقبال فقط', icon: ArrowDown },
  outbound: { label: 'إرسال فقط', icon: ArrowUp },
  bidirectional: { label: 'ثنائي الاتجاه', icon: ArrowLeftRight },
};

export default function AdminClasseraIntegrations() {
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [apiEndpoint, setApiEndpoint] = useState('');

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['integration-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .order('module_code');
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('integration_configs')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-configs'] });
      toast({ title: 'تم تحديث حالة المديول ✅' });
    },
  });

  const updateEndpointMutation = useMutation({
    mutationFn: async ({ id, api_endpoint }: { id: string; api_endpoint: string }) => {
      const { error } = await supabase
        .from('integration_configs')
        .update({ api_endpoint, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-configs'] });
      toast({ title: 'تم حفظ رابط API ✅' });
      setSelectedModule(null);
    },
  });

  const activeCount = modules.filter((m: any) => m.is_active).length;
  const totalTickets = modules.reduce((sum: number, m: any) => sum + (m.tickets_received || 0), 0);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classera-webhook`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'تم نسخ الرابط ✅' });
  };

  return (
    <PageLayout>
      <PageHeader title="تكامل مديولات كلاسيرا" icon={<Plug className="h-5 w-5" />} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Card className="rounded-2xl">
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">المديولات المفعّلة</p>
                          <p className="text-3xl font-bold text-primary">{activeCount}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">من أصل {modules.length} مديول</p>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card className="rounded-2xl">
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">إجمالي التذاكر المستلمة</p>
                          <p className="text-3xl font-bold text-foreground">{totalTickets}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center">
                          <Activity className="h-6 w-6 text-success" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card className="rounded-2xl">
                    <CardContent className="pt-5">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">رابط Webhook الموحد</p>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-muted px-2 py-1 rounded-lg flex-1 truncate" dir="ltr">
                            {webhookUrl}
                          </code>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyUrl}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="modules" dir="rtl">
                <TabsList className="rounded-xl mb-4">
                  <TabsTrigger value="modules" className="rounded-lg text-xs">المديولات</TabsTrigger>
                  <TabsTrigger value="docs" className="rounded-lg text-xs">وثائق API</TabsTrigger>
                </TabsList>

                <TabsContent value="modules">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map((mod: any, i: number) => {
                      const Icon = moduleIcons[mod.module_code] || Globe;
                      const colorClass = moduleColors[mod.module_code] || 'bg-muted text-muted-foreground';
                      const syncInfo = syncDirectionLabels[mod.sync_direction] || syncDirectionLabels.inbound;
                      const SyncIcon = syncInfo.icon;

                      return (
                        <div key={mod.id}>
                          <Card className={`rounded-2xl transition-all duration-300 hover:shadow-lg ${mod.is_active ? 'border-primary/30' : 'opacity-75'}`}>
                            <CardContent className="pt-5 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${colorClass}`}>
                                    <Icon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-sm">{mod.module_name}</h3>
                                    <Badge variant="outline" className="text-[10px] mt-1">{mod.module_code}</Badge>
                                  </div>
                                </div>
                                <Switch
                                  checked={mod.is_active}
                                  onCheckedChange={(checked) => toggleMutation.mutate({ id: mod.id, is_active: checked })}
                                />
                              </div>

                              <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <SyncIcon className="h-3.5 w-3.5" />
                                  <span>{syncInfo.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground">
                                    <span className="font-bold text-foreground">{mod.tickets_received || 0}</span> تذكرة
                                  </span>
                                </div>
                              </div>

                              {mod.sync_status === 'error' && (
                                <div className="text-[10px] text-destructive bg-destructive/10 rounded-lg px-2 py-1">
                                  {mod.error_message || 'خطأ في المزامنة'}
                                </div>
                              )}

                              {mod.last_sync_at && (
                                <p className="text-[10px] text-muted-foreground">
                                  آخر مزامنة: {new Date(mod.last_sync_at).toLocaleString('ar-SA')}
                                </p>
                              )}

                              <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline" size="sm" className="text-xs flex-1 rounded-lg"
                                      onClick={() => { setSelectedModule(mod); setApiEndpoint(mod.api_endpoint || ''); }}
                                    >
                                      <ExternalLink className="h-3 w-3 me-1" />
                                      إعدادات
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>إعدادات {mod.module_name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 mt-4">
                                      <div>
                                        <label className="text-sm font-medium">رابط API للمديول (Callback URL)</label>
                                        <Input
                                          dir="ltr"
                                          placeholder="https://api.classera.com/module/webhook"
                                          value={apiEndpoint}
                                          onChange={(e) => setApiEndpoint(e.target.value)}
                                          className="mt-1"
                                        />
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                          الرابط الذي سيتم إرسال تحديثات التذاكر إليه في نظام كلاسيرا
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">رابط استقبال التذاكر</label>
                                        <div className="flex gap-2 mt-1">
                                          <Input dir="ltr" readOnly value={webhookUrl} className="text-xs" />
                                          <Button variant="outline" size="icon" onClick={copyUrl}><Copy className="h-3.5 w-3.5" /></Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                          أرسل هذا الرابط لفريق كلاسيرا لإعداده في المديول
                                        </p>
                                      </div>
                                      <Button
                                        className="w-full"
                                        onClick={() => updateEndpointMutation.mutate({ id: mod.id, api_endpoint: apiEndpoint })}
                                        disabled={updateEndpointMutation.isPending}
                                      >
                                        حفظ الإعدادات
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="docs">
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-sm">وثائق التكامل مع كلاسيرا</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Create Ticket */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Badge className="bg-success/20 text-success border-0">POST</Badge>
                          إنشاء تذكرة جديدة
                        </h3>
                        <pre className="bg-muted/70 rounded-xl p-4 text-xs overflow-x-auto border" dir="ltr">
{`POST ${webhookUrl}

Headers:
  Content-Type: application/json
  apikey: YOUR_ANON_KEY
  x-api-key: YOUR_EXTERNAL_API_KEY

Body:
{
  "source_system": "LMS",
  "title": "مشكلة في الفصل الافتراضي",
  "description": "لا يمكن الدخول للفصل الافتراضي",
  "priority": "high",
  "requester_email": "teacher@school.edu.sa",
  "requester_name": "أحمد المعلم",
  "external_reference": "LMS-CLASS-2026-001",
  "service_name": "الفصول الافتراضية",
  "external_payload": {
    "class_id": "CLS-001",
    "school_id": "SCH-100"
  }
}`}
                        </pre>
                      </div>

                      {/* Update Status */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Badge className="bg-blue-500/20 text-blue-600 border-0">POST</Badge>
                          تحديث حالة تذكرة
                        </h3>
                        <pre className="bg-muted/70 rounded-xl p-4 text-xs overflow-x-auto border" dir="ltr">
{`POST ${webhookUrl}/update-status

Body:
{
  "external_reference": "LMS-CLASS-2026-001",
  "status": "resolved",
  "resolution_summary": "تم إصلاح المشكلة"
}`}
                        </pre>
                      </div>

                      {/* Get Status */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Badge className="bg-amber-500/20 text-amber-600 border-0">POST</Badge>
                          الاستعلام عن حالة تذكرة
                        </h3>
                        <pre className="bg-muted/70 rounded-xl p-4 text-xs overflow-x-auto border" dir="ltr">
{`POST ${webhookUrl}/get-status

Body:
{
  "external_reference": "LMS-CLASS-2026-001"
}`}
                        </pre>
                      </div>

                      {/* Health Check */}
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-600 border-0">POST</Badge>
                          فحص صحة الاتصال
                        </h3>
                        <pre className="bg-muted/70 rounded-xl p-4 text-xs overflow-x-auto border" dir="ltr">
{`POST ${webhookUrl}/health

Body: {}

Response:
{
  "status": "ok",
  "supported_modules": ["LMS","ERP","SIS","CPAY",...]
}`}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
    </PageLayout>
  );
}
