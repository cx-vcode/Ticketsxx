import { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Plus, Users, Ticket, Crown, CheckCircle2, XCircle, Settings,
  Sparkles, Eye, Upload, UserPlus, Palette, Globe, Shield
} from 'lucide-react';
import { TenantBrandingPreview } from '@/components/tenants/TenantBrandingPreview';
import { TenantMembersPanel } from '@/components/tenants/TenantMembersPanel';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const planColors: Record<string, string> = {
  free: 'bg-muted/50 text-muted-foreground',
  pro: 'bg-primary/10 text-primary',
  enterprise: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const planLabels: Record<string, { ar: string; en: string }> = {
  free: { ar: 'مجاني', en: 'Free' },
  pro: { ar: 'احترافي', en: 'Pro' },
  enterprise: { ar: 'مؤسسات', en: 'Enterprise' },
};

export default function AdminTenants() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAr = lang === 'ar';
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'free',
    primary_color: '#6366f1', accent_color: '#8b5cf6',
    max_users: 10, max_tickets_per_month: 500,
  });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('tenants').insert({
        ...form, owner_id: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowCreate(false);
      setForm({ name: '', slug: '', plan: 'free', primary_color: '#6366f1', accent_color: '#8b5cf6', max_users: 10, max_tickets_per_month: 500 });
      toast.success(isAr ? 'تم إنشاء المستأجر بنجاح' : 'Tenant created successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleTenant = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('tenants').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const updateTenantBranding = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { error } = await supabase.from('tenants').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(isAr ? 'تم تحديث العلامة التجارية' : 'Branding updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <PageLayout>
      <PageHeader title={isAr ? 'إدارة المستأجرين' : 'Tenant Management'} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }} className="max-w-7xl mx-auto space-y-6">

          {/* KPI Row */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: isAr ? 'إجمالي المستأجرين' : 'Total Tenants', value: tenants.length, icon: Building2, color: 'text-primary' },
              { label: isAr ? 'نشط' : 'Active', value: tenants.filter((t: any) => t.is_active).length, icon: CheckCircle2, color: 'text-success' },
              { label: isAr ? 'خطط مدفوعة' : 'Paid Plans', value: tenants.filter((t: any) => t.plan !== 'free').length, icon: Crown, color: 'text-amber-500' },
              { label: isAr ? 'إجمالي السعة' : 'Total Capacity', value: tenants.reduce((s: number, t: any) => s + (t.max_users || 0), 0), icon: Users, color: 'text-info' },
            ].map((kpi, i) => (
              <Card key={i} className="rounded-2xl border-border/50 shadow-card">
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

          {/* Tenants Grid + Detail Panel */}
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Tenants List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{isAr ? 'المستأجرون' : 'Tenants'}</h2>
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl">
                      <Plus className="h-4 w-4" />
                      {isAr ? 'مستأجر جديد' : 'New Tenant'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir={isAr ? 'rtl' : 'ltr'} className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{isAr ? 'إنشاء مستأجر جديد' : 'Create New Tenant'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{isAr ? 'اسم المستأجر' : 'Tenant Name'}</Label>
                          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>{isAr ? 'المعرف (Slug)' : 'Slug'}</Label>
                          <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className="rounded-xl" dir="ltr" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{isAr ? 'الخطة' : 'Plan'}</Label>
                        <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v }))}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">{isAr ? 'مجاني' : 'Free'}</SelectItem>
                            <SelectItem value="pro">{isAr ? 'احترافي' : 'Pro'}</SelectItem>
                            <SelectItem value="enterprise">{isAr ? 'مؤسسات' : 'Enterprise'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{isAr ? 'اللون الأساسي' : 'Primary Color'}</Label>
                          <div className="flex gap-2">
                            <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))} className="w-10 h-10 rounded-lg border cursor-pointer" />
                            <Input value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))} className="rounded-xl flex-1" dir="ltr" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{isAr ? 'لون التمييز' : 'Accent Color'}</Label>
                          <div className="flex gap-2">
                            <input type="color" value={form.accent_color} onChange={e => setForm(p => ({ ...p, accent_color: e.target.value }))} className="w-10 h-10 rounded-lg border cursor-pointer" />
                            <Input value={form.accent_color} onChange={e => setForm(p => ({ ...p, accent_color: e.target.value }))} className="rounded-xl flex-1" dir="ltr" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{isAr ? 'أقصى عدد مستخدمين' : 'Max Users'}</Label>
                          <Input type="number" value={form.max_users} onChange={e => setForm(p => ({ ...p, max_users: +e.target.value }))} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>{isAr ? 'تذاكر/شهر' : 'Tickets/Month'}</Label>
                          <Input type="number" value={form.max_tickets_per_month} onChange={e => setForm(p => ({ ...p, max_tickets_per_month: +e.target.value }))} className="rounded-xl" />
                        </div>
                      </div>
                      <Button className="w-full rounded-xl" onClick={() => createTenant.mutate()} disabled={!form.name || !form.slug || createTenant.isPending}>
                        <Sparkles className="h-4 w-4 me-2" />
                        {isAr ? 'إنشاء المستأجر' : 'Create Tenant'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="rounded-2xl animate-pulse"><CardContent className="p-6 h-48" /></Card>
                  ))}
                </div>
              ) : tenants.length === 0 ? (
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="p-12 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{isAr ? 'لا يوجد مستأجرون بعد' : 'No tenants yet'}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tenants.map((tenant: any, i: number) => (
                    <motion.div
                      key={tenant.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
                    >
                      <Card
                        className={`rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group cursor-pointer ${selectedTenant?.id === tenant.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setSelectedTenant(tenant)}
                      >
                        <div className="h-1.5 w-full" style={{ background: `linear-gradient(to right, ${tenant.primary_color}, ${tenant.accent_color})` }} />
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: tenant.primary_color }}>
                                {tenant.logo_url ? (
                                  <img src={tenant.logo_url} alt={tenant.name} className="h-full w-full object-contain rounded-xl" />
                                ) : tenant.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">{tenant.name}</h3>
                                <p className="text-[10px] text-muted-foreground font-mono">{tenant.slug}</p>
                              </div>
                            </div>
                            <Switch
                              checked={tenant.is_active}
                              onCheckedChange={(checked) => {
                                toggleTenant.mutate({ id: tenant.id, is_active: checked });
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] ${planColors[tenant.plan] || planColors.free}`}>
                              <Crown className="h-2.5 w-2.5 me-0.5" />
                              {planLabels[tenant.plan]?.[isAr ? 'ar' : 'en'] || tenant.plan}
                            </Badge>
                            {tenant.is_active ? (
                              <Badge variant="outline" className="text-[9px] border-success/30 text-success bg-success/5">
                                <CheckCircle2 className="h-2.5 w-2.5 me-0.5" />
                                {isAr ? 'نشط' : 'Active'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">
                                <XCircle className="h-2.5 w-2.5 me-0.5" />
                                {isAr ? 'معطل' : 'Disabled'}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-muted/40 p-2 text-center">
                              <p className="text-lg font-bold text-foreground">{tenant.max_users}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Users className="h-2.5 w-2.5" /> {isAr ? 'مستخدم' : 'Users'}
                              </p>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-2 text-center">
                              <p className="text-lg font-bold text-foreground">{tenant.max_tickets_per_month}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Ticket className="h-2.5 w-2.5" /> {isAr ? 'تذكرة/شهر' : 'Tix/mo'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: tenant.primary_color }} />
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: tenant.accent_color }} />
                            <span className="text-[10px] text-muted-foreground flex-1">{isAr ? 'ألوان العلامة التجارية' : 'Brand Colors'}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Detail Panel */}
            <div className="lg:col-span-1">
              {selectedTenant ? (
                <motion.div
                  key={selectedTenant.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="sticky top-20"
                >
                  <Card className="rounded-2xl border-border/50 shadow-card overflow-hidden">
                    <div className="h-2 w-full" style={{ background: `linear-gradient(to right, ${selectedTenant.primary_color}, ${selectedTenant.accent_color})` }} />
                    <CardContent className="p-0">
                      <Tabs defaultValue="branding" dir={isAr ? 'rtl' : 'ltr'}>
                        <TabsList className="w-full rounded-none border-b bg-muted/30">
                          <TabsTrigger value="branding" className="flex-1 text-xs gap-1">
                            <Palette className="h-3 w-3" />
                            {isAr ? 'الهوية' : 'Branding'}
                          </TabsTrigger>
                          <TabsTrigger value="members" className="flex-1 text-xs gap-1">
                            <Users className="h-3 w-3" />
                            {isAr ? 'الأعضاء' : 'Members'}
                          </TabsTrigger>
                          <TabsTrigger value="features" className="flex-1 text-xs gap-1">
                            <Shield className="h-3 w-3" />
                            {isAr ? 'الميزات' : 'Features'}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="branding" className="p-4 space-y-4 m-0">
                          <TenantBrandingPreview
                            tenant={selectedTenant}
                            onUpdate={(data) => updateTenantBranding.mutate({ id: selectedTenant.id, data })}
                            isUpdating={updateTenantBranding.isPending}
                            isAr={isAr}
                          />
                        </TabsContent>

                        <TabsContent value="members" className="p-4 m-0">
                          <TenantMembersPanel tenantId={selectedTenant.id} isAr={isAr} />
                        </TabsContent>

                        <TabsContent value="features" className="p-4 space-y-3 m-0">
                          {Object.entries((selectedTenant.features as Record<string, boolean>) || {}).map(([key, enabled]) => (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-xs text-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <Switch
                                checked={!!enabled}
                                onCheckedChange={(checked) => {
                                  const features = { ...(selectedTenant.features || {}), [key]: checked };
                                  updateTenantBranding.mutate({ id: selectedTenant.id, data: { features } });
                                  setSelectedTenant({ ...selectedTenant, features });
                                }}
                              />
                            </div>
                          ))}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <Card className="rounded-2xl border-border/50 border-dashed">
                  <CardContent className="p-8 text-center">
                    <Eye className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {isAr ? 'اختر مستأجراً لعرض التفاصيل' : 'Select a tenant to view details'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        </motion.div>
      </main>
    </PageLayout>
  );
}
