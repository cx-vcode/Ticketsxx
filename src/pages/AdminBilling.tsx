import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { CreditCard, Check, Crown, Zap, Building2, ArrowUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const plans = [
  {
    id: 'free',
    name: 'Free',
    nameAr: 'مجاني',
    price: 0,
    icon: Zap,
    color: 'border-muted',
    features: [
      '10 مستخدمين',
      '500 تذكرة/شهر',
      'مساعد ذكي أساسي',
      'دعم بالبريد الإلكتروني',
    ],
    limits: { max_users: 10, max_tickets: 500 },
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'احترافي',
    price: 499,
    icon: Crown,
    color: 'border-primary',
    popular: true,
    features: [
      '100 مستخدم',
      '5,000 تذكرة/شهر',
      'مساعد ذكي متقدم',
      'قنوات متعددة (WhatsApp, Email)',
      'تقارير مخصصة',
      'SLA متقدم',
      'دعم أولوية',
    ],
    limits: { max_users: 100, max_tickets: 5000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameAr: 'مؤسسي',
    price: 1999,
    icon: Building2,
    color: 'border-chart-2',
    features: [
      'مستخدمون غير محدودين',
      'تذاكر غير محدودة',
      'مساعد ذكي متقدم + تنبؤات',
      'جميع القنوات',
      'تقارير تنفيذية',
      'White-Label كامل',
      'تكامل API مخصص',
      'مدير حساب مخصص',
      'SLA ضمان 99.9%',
    ],
    limits: { max_users: null, max_tickets: null },
  },
];

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  const { data: tenants = [] } = useQuery({
    queryKey: ['billing-tenants'],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('*').order('name');
      return data || [];
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ tenantId, plan }: { tenantId: string; plan: string }) => {
      const planConfig = plans.find(p => p.id === plan);
      const { error } = await supabase
        .from('tenants')
        .update({
          plan,
          max_users: planConfig?.limits.max_users,
          max_tickets_per_month: planConfig?.limits.max_tickets,
          features: plan === 'enterprise'
            ? { ai_copilot: true, omni_channel: true, custom_reports: true, white_label: true, predictive: true }
            : plan === 'pro'
              ? { ai_copilot: true, omni_channel: true, custom_reports: true, white_label: false, predictive: false }
              : { ai_copilot: true, omni_channel: false, custom_reports: false },
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-tenants'] });
      toast({ title: 'تم ترقية الخطة بنجاح ✅' });
      setUpgradeTarget(null);
    },
    onError: () => toast({ title: 'حدث خطأ', variant: 'destructive' }),
  });

  const planDistribution = plans.map(p => ({
    ...p,
    count: tenants.filter((t: any) => t.plan === p.id).length,
  }));

  return (
    <PageLayout>
      <PageHeader
        title="الفوترة والاشتراكات"
        icon={<CreditCard className="h-4 w-4" />}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan, i) => (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className={`rounded-2xl relative overflow-hidden ${plan.color} ${plan.popular ? 'border-2 shadow-lg' : ''}`}>
                      {plan.popular && (
                        <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold text-center py-1">
                          الأكثر شعبية
                        </div>
                      )}
                      <CardContent className={`pt-${plan.popular ? '8' : '6'} space-y-4`}>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <plan.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold">{plan.nameAr}</h3>
                            <Badge variant="outline" className="text-[10px]">{plan.name}</Badge>
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold">{plan.price === 0 ? 'مجاني' : plan.price}</span>
                          {plan.price > 0 && <span className="text-sm text-muted-foreground">ر.س / شهر</span>}
                        </div>

                        <ul className="space-y-2">
                          {plan.features.map((f, j) => (
                            <li key={j} className="flex items-center gap-2 text-xs">
                              <Check className="h-3.5 w-3.5 text-success shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>

                        <p className="text-[10px] text-muted-foreground">
                          {planDistribution[i].count} مستأجر على هذه الخطة
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Tenant Plans Management */}
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    خطط المستأجرين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">المؤسسة</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">الخطة الحالية</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">المستخدمون</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">التذاكر/شهر</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((t: any) => {
                          const currentPlan = plans.find(p => p.id === t.plan);
                          const planColors: Record<string, string> = {
                            free: 'bg-muted text-muted-foreground',
                            pro: 'bg-primary/20 text-primary',
                            enterprise: 'bg-chart-2/20 text-chart-2',
                          };
                          return (
                            <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2.5 px-3 font-medium">{t.name}</td>
                              <td className="py-2.5 px-3">
                                <Badge className={`text-[10px] border-0 ${planColors[t.plan] || ''}`}>
                                  {currentPlan?.nameAr || t.plan}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">{t.max_users || '∞'}</td>
                              <td className="py-2.5 px-3">{t.max_tickets_per_month || '∞'}</td>
                              <td className="py-2.5 px-3">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-xs rounded-lg h-7">
                                      <ArrowUp className="h-3 w-3 me-1" />
                                      ترقية
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>ترقية خطة {t.name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 mt-4">
                                      <p className="text-sm text-muted-foreground">
                                        الخطة الحالية: <strong>{currentPlan?.nameAr}</strong>
                                      </p>
                                      <Select value={upgradeTarget || ''} onValueChange={setUpgradeTarget}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="اختر الخطة الجديدة" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {plans.filter(p => p.id !== t.plan).map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                              {p.nameAr} - {p.price === 0 ? 'مجاني' : `${p.price} ر.س/شهر`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        className="w-full"
                                        disabled={!upgradeTarget || upgradeMutation.isPending}
                                        onClick={() => upgradeTarget && upgradeMutation.mutate({ tenantId: t.id, plan: upgradeTarget })}
                                      >
                                        تأكيد الترقية
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
      </main>
    </PageLayout>
  );
}
