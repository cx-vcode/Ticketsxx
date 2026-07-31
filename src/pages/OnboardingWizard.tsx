import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle, Circle, Building2, Users, Palette, Plug, ShieldCheck,
  ArrowLeft, ArrowRight, Rocket, BookOpen, Settings, Bell, Zap,
} from 'lucide-react';

const STEPS = [
  { id: 'org', title: 'إعداد المؤسسة', titleEn: 'Organization Setup', icon: Building2, description: 'تكوين بيانات المؤسسة والهوية الأساسية' },
  { id: 'branding', title: 'الهوية البصرية', titleEn: 'Branding', icon: Palette, description: 'تخصيص الألوان والشعار والعلامة التجارية' },
  { id: 'users', title: 'إدارة المستخدمين', titleEn: 'User Management', icon: Users, description: 'إضافة المستخدمين وتوزيع الأدوار' },
  { id: 'integrations', title: 'التكاملات', titleEn: 'Integrations', icon: Plug, description: 'ربط الأنظمة الخارجية ومديولات كلاسيرا' },
  { id: 'sla', title: 'سياسات SLA', titleEn: 'SLA Policies', icon: ShieldCheck, description: 'تحديد مستويات الخدمة وأوقات الاستجابة' },
  { id: 'notifications', title: 'الإشعارات', titleEn: 'Notifications', icon: Bell, description: 'تكوين قنوات الإشعارات والتنبيهات' },
  { id: 'launch', title: 'الإطلاق', titleEn: 'Launch', icon: Rocket, description: 'مراجعة نهائية وتفعيل النظام' },
];

function StepContent({ stepId }: { stepId: string }) {
  const { data: tenants = [] } = useQuery({
    queryKey: ['onboard-tenants'],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('*').eq('is_active', true);
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['onboard-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').limit(20);
      return data || [];
    },
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ['onboard-integrations'],
    queryFn: async () => {
      const { data } = await supabase.from('integration_configs').select('*');
      return data || [];
    },
  });

  const { data: slaPolicies = [] } = useQuery({
    queryKey: ['onboard-sla'],
    queryFn: async () => {
      const { data } = await supabase.from('sla_policies').select('*');
      return data || [];
    },
  });

  const checkItems = (items: { label: string; done: boolean }[]) => (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
          {item.done ? (
            <CheckCircle className="h-5 w-5 text-success shrink-0" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
          )}
          <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
          {item.done && <Badge variant="secondary" className="mr-auto text-xs">مكتمل</Badge>}
        </div>
      ))}
    </div>
  );

  switch (stepId) {
    case 'org':
      return checkItems([
        { label: 'إنشاء مستأجر رئيسي للمؤسسة', done: tenants.length > 0 },
        { label: 'تحديد خطة الاشتراك (Free / Pro / Enterprise)', done: tenants.some(t => t.plan === 'enterprise') },
        { label: 'تعيين مالك المؤسسة (Owner)', done: tenants.some(t => t.owner_id) },
        { label: 'تحديد حدود الاستخدام (المستخدمين والتذاكر)', done: tenants.some(t => (t.max_users || 0) > 10) },
      ]);
    case 'branding':
      return checkItems([
        { label: 'تحميل شعار المؤسسة', done: tenants.some(t => t.logo_url) },
        { label: 'تخصيص الألوان الرئيسية', done: tenants.some(t => t.primary_color && t.primary_color !== '#6366f1') },
        { label: 'إعداد أيقونة المتصفح (Favicon)', done: tenants.some(t => t.favicon_url) },
        { label: 'تكوين النطاق المخصص (اختياري)', done: tenants.some(t => t.custom_domain) },
      ]);
    case 'users':
      return checkItems([
        { label: 'إضافة مسؤول النظام (Admin)', done: users.length > 0 },
        { label: 'إضافة فريق الدعم الفني (Agents)', done: users.length >= 3 },
        { label: 'إضافة المطورين (Developers)', done: users.length >= 5 },
        { label: 'تعيين الأقسام للمستخدمين', done: users.length >= 2 },
      ]);
    case 'integrations':
      return checkItems([
        { label: 'تفعيل تكامل LMS (نظام إدارة التعلم)', done: integrations.some(i => i.module_code === 'LMS' && i.is_active) },
        { label: 'تفعيل تكامل ERP (نظام تخطيط الموارد)', done: integrations.some(i => i.module_code === 'ERP' && i.is_active) },
        { label: 'تفعيل تكامل SIS (نظام معلومات الطلاب)', done: integrations.some(i => i.module_code === 'SIS' && i.is_active) },
        { label: 'اختبار المزامنة الثنائية', done: integrations.some(i => i.sync_status === 'synced') },
      ]);
    case 'sla':
      return checkItems([
        { label: 'تحديد SLA للأولوية العاجلة', done: slaPolicies.some(s => s.priority === 'urgent') },
        { label: 'تحديد SLA للأولوية العالية', done: slaPolicies.some(s => s.priority === 'high') },
        { label: 'تحديد SLA للأولوية المتوسطة', done: slaPolicies.some(s => s.priority === 'medium') },
        { label: 'تحديد SLA للأولوية المنخفضة', done: slaPolicies.some(s => s.priority === 'low') },
      ]);
    case 'notifications':
      return checkItems([
        { label: 'تفعيل إشعارات البريد الإلكتروني', done: true },
        { label: 'تفعيل الإشعارات الداخلية', done: true },
        { label: 'تكوين تنبيهات SLA', done: slaPolicies.length > 0 },
        { label: 'إعداد قناة WhatsApp (اختياري)', done: false },
      ]);
    case 'launch':
      return (
        <div className="text-center space-y-6 py-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <Rocket className="h-10 w-10 text-success" />
          </div>
          <h3 className="text-xl font-bold text-foreground">النظام جاهز للإطلاق! 🎉</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            تم إكمال جميع الخطوات الأساسية. يمكنك الآن البدء باستقبال التذاكر وإدارة الدعم الفني.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button className="gap-2"><Zap className="h-4 w-4" /> تفعيل النظام</Button>
            <Button variant="outline" className="gap-2"><BookOpen className="h-4 w-4" /> دليل البدء السريع</Button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-bold text-foreground">معالج التفعيل</h1>
                <p className="text-xs text-muted-foreground">إعداد النظام خطوة بخطوة</p>
              </div>
            </div>
            <NotificationsPopover />
          </header>

          <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Progress bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">التقدم الكلي</span>
                  <Badge variant="secondary">{Math.round(progress)}%</Badge>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>

            {/* Steps navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${
                    idx === currentStep
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : idx < currentStep
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                  {step.title}
                </button>
              ))}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      {(() => { const Icon = STEPS[currentStep].icon; return <div className="p-2 rounded-xl bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div> })()}
                      <div>
                        <CardTitle>{STEPS[currentStep].title}</CardTitle>
                        <CardDescription>{STEPS[currentStep].description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <StepContent stepId={STEPS[currentStep].id} />
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ArrowRight className="h-4 w-4" /> السابق
              </Button>
              <Button
                onClick={() => setCurrentStep(s => Math.min(STEPS.length - 1, s + 1))}
                disabled={currentStep === STEPS.length - 1}
                className="gap-2"
              >
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
