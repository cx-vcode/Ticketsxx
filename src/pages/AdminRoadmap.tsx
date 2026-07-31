import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLanguage } from '@/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, CheckCircle2, Clock, Circle, Target, TrendingUp, Zap, Shield,
  Globe, Brain, BarChart3, Users, Puzzle, ChevronDown, ChevronRight,
  Download, Filter, Calendar, Star, ArrowRight, Sparkles, Activity,
  MessageSquare, Layers, Lock, CreditCard, Palette, Code2, Bot,
  LineChart, FileText, Plug, Server, Eye, Workflow
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

type PhaseStatus = 'completed' | 'in_progress' | 'planned';
type TaskCategory = 'technical' | 'business' | 'marketing' | 'security';

interface RoadmapTask {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  status: PhaseStatus;
  category: TaskCategory;
  icon: any;
  priority: 'high' | 'medium' | 'low';
}

interface RoadmapPhase {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  weeksAr: string;
  weeksEn: string;
  status: PhaseStatus;
  progress: number;
  color: string;
  icon: any;
  tasks: RoadmapTask[];
  kpisAr: string[];
  kpisEn: string[];
}

const phases: RoadmapPhase[] = [
  {
    id: 'phase1',
    titleAr: 'التأسيس والتحسين',
    titleEn: 'Foundation & Enhancement',
    subtitleAr: 'تحسين تجربة المستخدم والأداء والاستقرار',
    subtitleEn: 'Improve UX, performance, and stability',
    weeksAr: 'الأسابيع 1-4',
    weeksEn: 'Weeks 1-4',
    status: 'completed',
    progress: 100,
    color: 'hsl(var(--success))',
    icon: Rocket,
    kpisAr: ['تقليل زمن التحميل بنسبة 40%', 'رضا المستخدم > 90%', 'صفر أخطاء حرجة'],
    kpisEn: ['Reduce load time by 40%', 'User satisfaction > 90%', 'Zero critical bugs'],
    tasks: [
      { id: 't1-1', titleAr: 'تحسين واجهة المستخدم', titleEn: 'UI/UX Enhancement', descAr: 'تصميم عصري مع Dark Mode وتحسين التنقل والـ Sidebar', descEn: 'Modern design with Dark Mode and improved navigation', status: 'completed', category: 'technical', icon: Palette, priority: 'high' },
      { id: 't1-2', titleAr: 'نظام الإشعارات المتقدم', titleEn: 'Advanced Notifications', descAr: 'إشعارات لحظية مع صوت تنبيه وصندوق وارد مخصص', descEn: 'Real-time notifications with sound alerts and dedicated inbox', status: 'completed', category: 'technical', icon: Activity, priority: 'high' },
      { id: 't1-3', titleAr: 'نظام الأدوار والصلاحيات', titleEn: 'Roles & Permissions', descAr: 'أربعة أدوار (مدير، وكيل، مقدم طلب، مطور) مع RLS', descEn: 'Four roles (admin, agent, requester, developer) with RLS', status: 'completed', category: 'security', icon: Shield, priority: 'high' },
      { id: 't1-4', titleAr: 'دعم اللغة العربية والإنجليزية', titleEn: 'Arabic & English Support', descAr: 'واجهة ثنائية اللغة مع دعم كامل لـ RTL', descEn: 'Bilingual interface with full RTL support', status: 'completed', category: 'technical', icon: Globe, priority: 'high' },
      { id: 't1-5', titleAr: 'دليل النظام التفاعلي', titleEn: 'Interactive System Guide', descAr: 'دليل شامل مع 24 قسم وفيديوهات توضيحية ونصائح احترافية', descEn: 'Comprehensive guide with 24 sections, videos, and pro tips', status: 'completed', category: 'business', icon: FileText, priority: 'medium' },
      { id: 't1-6', titleAr: 'تحسين أداء التطبيق', titleEn: 'Performance Optimization', descAr: 'Lazy loading وCode splitting وتقليل حجم الحزم', descEn: 'Lazy loading, code splitting, and bundle size reduction', status: 'completed', category: 'technical', icon: Zap, priority: 'high' },
    ]
  },
  {
    id: 'phase2',
    titleAr: 'الذكاء الاصطناعي المتقدم',
    titleEn: 'Advanced AI Capabilities',
    subtitleAr: 'تعزيز النظام بقدرات ذكاء اصطناعي متطورة',
    subtitleEn: 'Enhance the system with advanced AI capabilities',
    weeksAr: 'الأسابيع 5-10',
    weeksEn: 'Weeks 5-10',
    status: 'in_progress',
    progress: 65,
    color: 'hsl(var(--primary))',
    icon: Brain,
    kpisAr: ['دقة التصنيف التلقائي > 85%', 'تقليل وقت الاستجابة 50%', 'رضا CSAT > 4.2'],
    kpisEn: ['Auto-classification accuracy > 85%', 'Response time reduction 50%', 'CSAT > 4.2'],
    tasks: [
      { id: 't2-1', titleAr: 'تحليل المشاعر الذكي', titleEn: 'Sentiment Analysis', descAr: 'تحليل مشاعر العملاء تلقائياً من نصوص التذاكر', descEn: 'Automatic customer sentiment analysis from ticket text', status: 'completed', category: 'technical', icon: Brain, priority: 'high' },
      { id: 't2-2', titleAr: 'التصنيف التلقائي للتذاكر', titleEn: 'Auto Ticket Classification', descAr: 'تصنيف ذكي حسب الخدمة والأولوية والقسم', descEn: 'Smart classification by service, priority, and department', status: 'completed', category: 'technical', icon: Workflow, priority: 'high' },
      { id: 't2-3', titleAr: 'اقتراحات الحلول الذكية', titleEn: 'Smart Solution Suggestions', descAr: 'اقتراح حلول من قاعدة المعرفة وسجل التذاكر السابقة', descEn: 'Suggest solutions from KB and previous tickets', status: 'in_progress', category: 'technical', icon: Sparkles, priority: 'high' },
      { id: 't2-4', titleAr: 'مساعد AI للوكلاء', titleEn: 'AI Copilot for Agents', descAr: 'مساعد ذكي يقترح ردود وإجراءات للوكلاء', descEn: 'Smart assistant suggesting replies and actions for agents', status: 'in_progress', category: 'technical', icon: Bot, priority: 'high' },
      { id: 't2-5', titleAr: 'Chatbot ذكي للعملاء', titleEn: 'Smart Customer Chatbot', descAr: 'روبوت محادثة ذكي يجيب على الأسئلة ويفتح تذاكر', descEn: 'Smart chatbot that answers questions and opens tickets', status: 'in_progress', category: 'technical', icon: MessageSquare, priority: 'medium' },
      { id: 't2-6', titleAr: 'تلخيص التذاكر تلقائياً', titleEn: 'Auto Ticket Summarization', descAr: 'توليد ملخصات ذكية للتذاكر الطويلة', descEn: 'Generate smart summaries for long tickets', status: 'completed', category: 'technical', icon: FileText, priority: 'medium' },
      { id: 't2-7', titleAr: 'البحث الذكي بالـ AI', titleEn: 'AI-Powered Smart Search', descAr: 'محرك بحث ذكي يفهم السياق والمعنى', descEn: 'Smart search engine that understands context', status: 'in_progress', category: 'technical', icon: Eye, priority: 'medium' },
    ]
  },
  {
    id: 'phase3',
    titleAr: 'التكاملات والقنوات المتعددة',
    titleEn: 'Integrations & Omni-Channel',
    subtitleAr: 'ربط النظام بالمنصات الخارجية وتوسيع قنوات التواصل',
    subtitleEn: 'Connect with external platforms and expand communication channels',
    weeksAr: 'الأسابيع 11-16',
    weeksEn: 'Weeks 11-16',
    status: 'in_progress',
    progress: 35,
    color: 'hsl(var(--info))',
    icon: Plug,
    kpisAr: ['3+ قنوات تواصل فعالة', '99.9% وقت تشغيل API', 'تكامل كلاسيرا مكتمل'],
    kpisEn: ['3+ active channels', '99.9% API uptime', 'Classera integration complete'],
    tasks: [
      { id: 't3-1', titleAr: 'تكامل WhatsApp Business', titleEn: 'WhatsApp Business Integration', descAr: 'إرسال واستقبال رسائل عبر واتساب مع ربط تلقائي بالتذاكر', descEn: 'Send/receive messages via WhatsApp with auto-ticket linking', status: 'in_progress', category: 'technical', icon: MessageSquare, priority: 'high' },
      { id: 't3-2', titleAr: 'تكامل Slack', titleEn: 'Slack Integration', descAr: 'إشعارات وإدارة التذاكر من داخل Slack', descEn: 'Notifications and ticket management from within Slack', status: 'completed', category: 'technical', icon: MessageSquare, priority: 'medium' },
      { id: 't3-3', titleAr: 'تكامل كلاسيرا', titleEn: 'Classera Integration', descAr: 'مزامنة ثنائية الاتجاه مع منصة كلاسيرا التعليمية', descEn: 'Bi-directional sync with Classera education platform', status: 'in_progress', category: 'business', icon: Plug, priority: 'high' },
      { id: 't3-4', titleAr: 'API Gateway للمطورين', titleEn: 'Developer API Gateway', descAr: 'واجهة برمجية RESTful مع توثيق Swagger وحدود استخدام', descEn: 'RESTful API with Swagger docs and rate limiting', status: 'planned', category: 'technical', icon: Code2, priority: 'high' },
      { id: 't3-5', titleAr: 'نظام Webhooks المتقدم', titleEn: 'Advanced Webhooks', descAr: 'إرسال أحداث لحظية للأنظمة الخارجية مع إعادة المحاولة', descEn: 'Real-time events to external systems with retry logic', status: 'completed', category: 'technical', icon: Zap, priority: 'medium' },
      { id: 't3-6', titleAr: 'البريد الإلكتروني الذكي', titleEn: 'Smart Email Management', descAr: 'استقبال وإرسال رسائل بريد مع قوالب احترافية', descEn: 'Receive and send emails with professional templates', status: 'in_progress', category: 'technical', icon: Globe, priority: 'medium' },
    ]
  },
  {
    id: 'phase4',
    titleAr: 'التحليلات والتقارير المتقدمة',
    titleEn: 'Advanced Analytics & Reports',
    subtitleAr: 'لوحات تحكم تنفيذية وتقارير تنبؤية بالذكاء الاصطناعي',
    subtitleEn: 'Executive dashboards and AI-powered predictive reports',
    weeksAr: 'الأسابيع 17-22',
    weeksEn: 'Weeks 17-22',
    status: 'planned',
    progress: 10,
    color: 'hsl(var(--warning))',
    icon: LineChart,
    kpisAr: ['5+ أنواع تقارير جديدة', 'دقة التنبؤ > 80%', 'تقليل وقت إعداد التقارير 70%'],
    kpisEn: ['5+ new report types', 'Prediction accuracy > 80%', 'Report preparation time reduced 70%'],
    tasks: [
      { id: 't4-1', titleAr: 'لوحة تحكم تنفيذية متقدمة', titleEn: 'Advanced Executive Dashboard', descAr: 'رسوم بيانية تفاعلية مع مقارنات زمنية وتحليلات عميقة', descEn: 'Interactive charts with time comparisons and deep analytics', status: 'in_progress', category: 'technical', icon: BarChart3, priority: 'high' },
      { id: 't4-2', titleAr: 'تقارير تنبؤية بالذكاء الاصطناعي', titleEn: 'AI Predictive Reports', descAr: 'توقع حجم التذاكر وتحديد الاتجاهات والأنماط', descEn: 'Predict ticket volume and identify trends and patterns', status: 'planned', category: 'technical', icon: TrendingUp, priority: 'high' },
      { id: 't4-3', titleAr: 'منشئ التقارير المخصصة', titleEn: 'Custom Report Builder', descAr: 'سحب وإفلات لتصميم تقارير مخصصة حسب الحاجة', descEn: 'Drag-and-drop custom report designer', status: 'planned', category: 'technical', icon: Layers, priority: 'medium' },
      { id: 't4-4', titleAr: 'تحليلات CSAT المعمقة', titleEn: 'Deep CSAT Analytics', descAr: 'تحليل رضا العملاء حسب الخدمة والوكيل والفترة', descEn: 'Customer satisfaction analysis by service, agent, and period', status: 'planned', category: 'business', icon: Star, priority: 'medium' },
      { id: 't4-5', titleAr: 'تقارير أداء الوكلاء', titleEn: 'Agent Performance Reports', descAr: 'مؤشرات أداء تفصيلية لكل وكيل مع مقارنات', descEn: 'Detailed KPIs per agent with comparisons', status: 'planned', category: 'business', icon: Users, priority: 'medium' },
      { id: 't4-6', titleAr: 'تصدير التقارير PDF/Excel', titleEn: 'Export Reports PDF/Excel', descAr: 'تصدير جميع التقارير بتنسيقات احترافية', descEn: 'Export all reports in professional formats', status: 'planned', category: 'technical', icon: Download, priority: 'low' },
    ]
  },
  {
    id: 'phase5',
    titleAr: 'SaaS والتوسع العالمي',
    titleEn: 'SaaS & Global Expansion',
    subtitleAr: 'تحويل النظام لمنصة SaaS متعددة المستأجرين',
    subtitleEn: 'Transform into a multi-tenant SaaS platform',
    weeksAr: 'الأسابيع 23-30',
    weeksEn: 'Weeks 23-30',
    status: 'planned',
    progress: 5,
    color: 'hsl(var(--accent-foreground))',
    icon: Globe,
    kpisAr: ['10+ مستأجرين نشطين', 'وقت تفعيل < 5 دقائق', 'إيرادات شهرية متكررة'],
    kpisEn: ['10+ active tenants', 'Onboarding time < 5 min', 'Monthly recurring revenue'],
    tasks: [
      { id: 't5-1', titleAr: 'نظام Multi-Tenant متكامل', titleEn: 'Full Multi-Tenant System', descAr: 'عزل بيانات كل مؤسسة مع إدارة مركزية', descEn: 'Data isolation per organization with central management', status: 'planned', category: 'technical', icon: Server, priority: 'high' },
      { id: 't5-2', titleAr: 'White-Labeling كامل', titleEn: 'Full White-Labeling', descAr: 'تخصيص كامل للهوية البصرية (شعار، ألوان، دومين)', descEn: 'Full branding customization (logo, colors, domain)', status: 'planned', category: 'business', icon: Palette, priority: 'high' },
      { id: 't5-3', titleAr: 'نظام الفوترة والاشتراكات', titleEn: 'Billing & Subscriptions', descAr: 'خطط اشتراك مرنة مع دفع إلكتروني وفواتير', descEn: 'Flexible subscription plans with online payment', status: 'planned', category: 'business', icon: CreditCard, priority: 'high' },
      { id: 't5-4', titleAr: 'Marketplace للإضافات', titleEn: 'Plugin Marketplace', descAr: 'متجر إضافات لتوسيع وظائف النظام', descEn: 'Plugin store to extend system functionality', status: 'planned', category: 'business', icon: Puzzle, priority: 'medium' },
      { id: 't5-5', titleAr: 'تحسينات أمنية متقدمة', titleEn: 'Advanced Security', descAr: 'SSO، 2FA، تشفير متقدم، ومراقبة تهديدات', descEn: 'SSO, 2FA, advanced encryption, and threat monitoring', status: 'planned', category: 'security', icon: Lock, priority: 'high' },
      { id: 't5-6', titleAr: 'برنامج شركاء وموزعين', titleEn: 'Partner & Reseller Program', descAr: 'بوابة شركاء مع عمولات ودعم مخصص', descEn: 'Partner portal with commissions and dedicated support', status: 'planned', category: 'marketing', icon: Users, priority: 'medium' },
    ]
  }
];

const statusConfig: Record<PhaseStatus, { labelAr: string; labelEn: string; color: string; icon: any }> = {
  completed: { labelAr: 'مكتمل', labelEn: 'Completed', color: 'bg-success/15 text-success border-success/20', icon: CheckCircle2 },
  in_progress: { labelAr: 'قيد التنفيذ', labelEn: 'In Progress', color: 'bg-primary/15 text-primary border-primary/20', icon: Clock },
  planned: { labelAr: 'مخطط', labelEn: 'Planned', color: 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20', icon: Circle },
};

const categoryConfig: Record<TaskCategory, { labelAr: string; labelEn: string; color: string }> = {
  technical: { labelAr: 'تقني', labelEn: 'Technical', color: 'bg-primary/10 text-primary' },
  business: { labelAr: 'تجاري', labelEn: 'Business', color: 'bg-success/10 text-success' },
  marketing: { labelAr: 'تسويقي', labelEn: 'Marketing', color: 'bg-warning/10 text-warning' },
  security: { labelAr: 'أمني', labelEn: 'Security', color: 'bg-destructive/10 text-destructive' },
};

export default function AdminRoadmap() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<string>('all');
  const [expandedPhases, setExpandedPhases] = useState<string[]>(['phase2']);

  const totalTasks = phases.reduce((a, p) => a + p.tasks.length, 0);
  const completedTasks = phases.reduce((a, p) => a + p.tasks.filter(t => t.status === 'completed').length, 0);
  const inProgressTasks = phases.reduce((a, p) => a + p.tasks.filter(t => t.status === 'in_progress').length, 0);
  const overallProgress = Math.round((completedTasks / totalTasks) * 100);

  const filteredPhases = useMemo(() => {
    if (activeTab === 'all') return phases;
    return phases.map(p => ({
      ...p,
      tasks: p.tasks.filter(t => t.category === activeTab)
    })).filter(p => p.tasks.length > 0);
  }, [activeTab]);

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = phases.map((phase, idx) => `
      <div class="phase" style="page-break-inside: avoid; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #1a365d, #2563eb); color: white; padding: 20px; border-radius: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0 0 4px 0; font-size: 20px;">${isAr ? `المرحلة ${idx + 1}: ${phase.titleAr}` : `Phase ${idx + 1}: ${phase.titleEn}`}</h2>
          <p style="margin: 0; opacity: 0.85; font-size: 13px;">${isAr ? phase.subtitleAr : phase.subtitleEn} — ${isAr ? phase.weeksAr : phase.weeksEn}</p>
          <div style="margin-top: 10px; background: rgba(255,255,255,0.2); border-radius: 8px; height: 8px;">
            <div style="background: #34d399; height: 100%; border-radius: 8px; width: ${phase.progress}%;"></div>
          </div>
          <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.8;">${phase.progress}% ${isAr ? 'مكتمل' : 'Complete'}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: ${isAr ? 'right' : 'left'}; border: 1px solid #e2e8f0;">${isAr ? 'المهمة' : 'Task'}</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #e2e8f0; width: 80px;">${isAr ? 'الفئة' : 'Category'}</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #e2e8f0; width: 90px;">${isAr ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            ${phase.tasks.map(t => `
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">
                  <strong>${isAr ? t.titleAr : t.titleEn}</strong><br/>
                  <span style="color: #64748b; font-size: 11px;">${isAr ? t.descAr : t.descEn}</span>
                </td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">
                  ${isAr ? categoryConfig[t.category].labelAr : categoryConfig[t.category].labelEn}
                </td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">
                  ${t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⏳'} ${isAr ? statusConfig[t.status].labelAr : statusConfig[t.status].labelEn}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${phase.kpisAr.length > 0 ? `
          <div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="font-size: 12px; color: #475569;">🎯 ${isAr ? 'مؤشرات الأداء' : 'KPIs'}:</strong>
            <ul style="margin: 6px 0 0; padding-${isAr ? 'right' : 'left'}: 20px; font-size: 12px; color: #64748b;">
              ${(isAr ? phase.kpisAr : phase.kpisEn).map(k => `<li>${k}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/>
      <title>${isAr ? 'خارطة طريق التطوير - Ticket-X' : 'Development Roadmap - Ticket-X'}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; padding: 0; margin: 0; }
        .cover { text-align: center; padding: 120px 40px; page-break-after: always; }
        .cover h1 { font-size: 36px; color: #1a365d; margin-bottom: 8px; }
        .cover p { font-size: 16px; color: #64748b; }
        .stats { display: flex; justify-content: center; gap: 40px; margin-top: 40px; }
        .stat { text-align: center; }
        .stat .num { font-size: 32px; font-weight: bold; color: #2563eb; }
        .stat .label { font-size: 12px; color: #94a3b8; }
      </style>
    </head><body>
      <div class="cover">
        <h1>🚀 ${isAr ? 'خارطة طريق التطوير' : 'Development Roadmap'}</h1>
        <p>Ticket-X — ${isAr ? 'منصة الدعم الفني الذكية' : 'Smart Helpdesk Platform'}</p>
        <div class="stats">
          <div class="stat"><div class="num">${phases.length}</div><div class="label">${isAr ? 'مراحل' : 'Phases'}</div></div>
          <div class="stat"><div class="num">${totalTasks}</div><div class="label">${isAr ? 'مهمة' : 'Tasks'}</div></div>
          <div class="stat"><div class="num">${overallProgress}%</div><div class="label">${isAr ? 'التقدم العام' : 'Progress'}</div></div>
        </div>
        <p style="margin-top:60px;font-size:12px;color:#94a3b8;">${new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      ${content}
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <PageLayout>
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <PageHeader title={isAr ? 'خارطة طريق التطوير' : 'Development Roadmap'} />

        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { labelAr: 'إجمالي المهام', labelEn: 'Total Tasks', value: totalTasks, icon: Target, color: 'text-primary' },
            { labelAr: 'مكتمل', labelEn: 'Completed', value: completedTasks, icon: CheckCircle2, color: 'text-success' },
            { labelAr: 'قيد التنفيذ', labelEn: 'In Progress', value: inProgressTasks, icon: Clock, color: 'text-warning' },
            { labelAr: 'التقدم العام', labelEn: 'Overall', value: `${overallProgress}%`, icon: TrendingUp, color: 'text-primary' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{isAr ? stat.labelAr : stat.labelEn}</p>
                      <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </div>
                    <stat.icon className={`h-8 w-8 ${stat.color} opacity-20`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Overall Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{isAr ? 'التقدم الإجمالي للمشروع' : 'Overall Project Progress'}</span>
              <span className="text-sm font-bold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {isAr ? `${completedTasks} من ${totalTasks} مهمة مكتملة` : `${completedTasks} of ${totalTasks} tasks completed`}
            </p>
          </CardContent>
        </Card>

        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all" className="text-xs">{isAr ? 'الكل' : 'All'}</TabsTrigger>
              <TabsTrigger value="technical" className="text-xs">{isAr ? 'تقني' : 'Technical'}</TabsTrigger>
              <TabsTrigger value="business" className="text-xs">{isAr ? 'تجاري' : 'Business'}</TabsTrigger>
              <TabsTrigger value="security" className="text-xs">{isAr ? 'أمني' : 'Security'}</TabsTrigger>
              <TabsTrigger value="marketing" className="text-xs">{isAr ? 'تسويقي' : 'Marketing'}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {isAr ? 'تحميل PDF' : 'Export PDF'}
          </Button>
        </div>

        {/* Timeline Phases */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {filteredPhases.map((phase, index) => {
              const PhaseIcon = phase.icon;
              const StatusIcon = statusConfig[phase.status].icon;
              const isExpanded = expandedPhases.includes(phase.id);

              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, x: isAr ? 30 : -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card className={`border-2 transition-colors ${phase.status === 'in_progress' ? 'border-primary/30 shadow-md' : 'border-border'}`}>
                    <Collapsible open={isExpanded} onOpenChange={() => togglePhase(phase.id)}>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg">
                          <div className="flex items-center gap-4">
                            {/* Phase number circle */}
                            <div className={`flex items-center justify-center w-12 h-12 rounded-2xl shrink-0 ${
                              phase.status === 'completed' ? 'bg-success/15' : phase.status === 'in_progress' ? 'bg-primary/15' : 'bg-muted'
                            }`}>
                              <PhaseIcon className={`h-6 w-6 ${
                                phase.status === 'completed' ? 'text-success' : phase.status === 'in_progress' ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>

                            <div className="flex-1 text-start min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base">
                                  {isAr ? `المرحلة ${index + 1}: ${phase.titleAr}` : `Phase ${index + 1}: ${phase.titleEn}`}
                                </CardTitle>
                                <Badge variant="outline" className={statusConfig[phase.status].color}>
                                  <StatusIcon className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                  {isAr ? statusConfig[phase.status].labelAr : statusConfig[phase.status].labelEn}
                                </Badge>
                              </div>
                              <CardDescription className="mt-1">{isAr ? phase.subtitleAr : phase.subtitleEn}</CardDescription>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{isAr ? phase.weeksAr : phase.weeksEn}</span>
                                <span>{phase.tasks.length} {isAr ? 'مهمة' : 'tasks'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="hidden sm:flex flex-col items-end gap-1">
                                <span className="text-sm font-bold">{phase.progress}%</span>
                                <Progress value={phase.progress} className="w-24 h-2" />
                              </div>
                              {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          <Separator />
                          {/* Tasks grid */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            {phase.tasks.map((task) => {
                              const TaskIcon = task.icon;
                              return (
                                <motion.div
                                  key={task.id}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`p-3 rounded-xl border transition-colors ${
                                    task.status === 'completed' ? 'bg-success/5 border-success/15' :
                                    task.status === 'in_progress' ? 'bg-primary/5 border-primary/15' :
                                    'bg-muted/30 border-border'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`p-1.5 rounded-lg shrink-0 ${
                                      task.status === 'completed' ? 'bg-success/10' : task.status === 'in_progress' ? 'bg-primary/10' : 'bg-muted'
                                    }`}>
                                      <TaskIcon className={`h-4 w-4 ${
                                        task.status === 'completed' ? 'text-success' : task.status === 'in_progress' ? 'text-primary' : 'text-muted-foreground'
                                      }`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold">{isAr ? task.titleAr : task.titleEn}</p>
                                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${categoryConfig[task.category].color}`}>
                                          {isAr ? categoryConfig[task.category].labelAr : categoryConfig[task.category].labelEn}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">{isAr ? task.descAr : task.descEn}</p>
                                    </div>
                                    {task.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />}
                                    {task.status === 'in_progress' && <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5 animate-pulse" />}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* KPIs */}
                          {phase.kpisAr.length > 0 && (
                            <div className="p-3 rounded-xl bg-muted/50 border">
                              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                                <Target className="h-3.5 w-3.5" />
                                {isAr ? 'مؤشرات الأداء الرئيسية' : 'Key Performance Indicators'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(isAr ? phase.kpisAr : phase.kpisEn).map((kpi, i) => (
                                  <Badge key={i} variant="outline" className="text-xs font-normal">
                                    {kpi}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Strategic Vision */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/[0.02] border-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">{isAr ? 'الرؤية الاستراتيجية' : 'Strategic Vision'}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isAr
                ? 'يهدف Ticket-X إلى التحول لمنصة SaaS عالمية رائدة في مجال الدعم الفني الذكي، مع التركيز على تمكين المؤسسات التعليمية والحكومية من إدارة خدماتها بكفاءة عالية. تستهدف الخطة الوصول إلى 100+ مؤسسة خلال السنة الأولى مع تحقيق معايير أمنية عالمية متوافقة مع نظام حماية البيانات الشخصية السعودي (PDPL).'
                : 'Ticket-X aims to become a leading global SaaS platform for smart helpdesk management, focusing on empowering educational and government institutions to manage their services efficiently. The plan targets 100+ organizations in the first year while achieving world-class security standards compliant with Saudi PDPL regulations.'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
