import { memo, useMemo } from 'react';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import {
  LayoutDashboard, Inbox, Plus, LogOut, Building2, Users, Timer, BarChart3, BookOpen,
  FormInput, ShieldCheck, Award, Globe, Settings, Mail, Columns, Star, ShieldAlert,
  Webhook, Zap, MessageSquare, FileSearch, ShieldCheck as ShieldCheckIcon, Send, Bell,
  Sparkles, Plug, Rocket, Activity, BookMarked, Map,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLanguage } from '@/i18n';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo-icon.png';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const AppSidebar = memo(function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { profile, role, signOut } = useAuth();
  const sysSettings = useSystemSettings();
  const tenantBranding = useTenantBranding();
  const { t, lang } = useLanguage();

  const logoSrc = tenantBranding.logo_url || sysSettings.logo_url || logoImg;
  const sysName = tenantBranding.tenant_name || sysSettings.system_name || 'Ticket-X';
  const sysSub = sysSettings.system_subtitle || 'SMART HELPDESK';

  const roleLabels: Record<string, string> = {
    admin: t.roles.admin,
    agent: t.roles.agent,
    requester: t.roles.requester,
    developer: t.roles.developer,
  };

  const roleBadgeColors: Record<string, string> = {
    admin: 'bg-primary/15 text-primary border-primary/20',
    agent: 'bg-info/15 text-info border-info/20',
    requester: 'bg-success/15 text-success border-success/20',
    developer: 'bg-warning/15 text-warning border-warning/20',
  };

  const mainItems = useMemo(() => [
    { title: t.sidebar.dashboard, url: '/', icon: LayoutDashboard },
    { title: t.sidebar.tickets, url: '/tickets', icon: Inbox },
    { title: t.sidebar.newTicket, url: '/tickets/new', icon: Plus },
    { title: t.sidebar.notificationsInbox, url: '/notifications', icon: Bell },
    { title: t.sidebar.knowledgeBase, url: '/knowledge-base', icon: BookOpen },
    { title: lang === 'ar' ? 'دليل النظام' : 'System Guide', url: '/system-guide', icon: BookMarked },
  ], [t, lang]);

  const requesterItems = useMemo(() => [
    { title: t.sidebar.followUpBoard, url: '/portal', icon: LayoutDashboard },
    { title: t.sidebar.myTickets, url: '/portal/tickets', icon: Inbox },
    { title: t.sidebar.newTicket, url: '/portal/new', icon: Plus },
    { title: t.sidebar.notificationsInbox, url: '/notifications', icon: Bell },
    { title: t.sidebar.knowledgeBase, url: '/portal/kb', icon: BookOpen },
    { title: lang === 'ar' ? 'دليل النظام' : 'System Guide', url: '/system-guide', icon: BookMarked },
  ], [t, lang]);

  const developerItems = useMemo(() => [
    { title: t.sidebar.developerBoard, url: '/developer', icon: LayoutDashboard },
    { title: t.sidebar.tickets, url: '/tickets', icon: Inbox },
    { title: t.sidebar.newTicket, url: '/tickets/new', icon: Plus },
    { title: t.sidebar.notificationsInbox, url: '/notifications', icon: Bell },
    { title: t.sidebar.approvalBoard, url: '/admin/approval-kanban', icon: Columns },
    { title: t.sidebar.knowledgeBase, url: '/knowledge-base', icon: BookOpen },
    { title: lang === 'ar' ? 'دليل النظام' : 'System Guide', url: '/system-guide', icon: BookMarked },
  ], [t, lang]);

  const adminItems = useMemo(() => [
    { title: t.sidebar.executiveDashboard, url: '/admin/executive', icon: BarChart3 },
    { title: t.sidebar.serviceCatalog, url: '/admin/services', icon: BookOpen },
    { title: t.sidebar.serviceFields, url: '/admin/service-fields', icon: FormInput },
    { title: t.sidebar.approvalStages, url: '/admin/approval-stages', icon: ShieldCheck },
    { title: lang === 'ar' ? 'صحة الاعتمادات' : 'Approval Health', url: '/admin/approval-health', icon: Activity },
    { title: lang === 'ar' ? 'قوالب الاعتماد' : 'Approval Templates', url: '/admin/approval-templates', icon: Sparkles },
    { title: t.sidebar.approvalReports, url: '/admin/approval-reports', icon: BarChart3 },
    { title: t.sidebar.approvalBoard, url: '/admin/approval-kanban', icon: Columns },
    { title: t.sidebar.departments, url: '/admin/departments', icon: Building2 },
    { title: t.sidebar.users, url: '/admin/users', icon: Users },
    { title: t.sidebar.agentPerformance, url: '/admin/agent-performance', icon: Award },
    { title: t.sidebar.slaSettings, url: '/admin/sla', icon: Timer },
    { title: t.sidebar.reports, url: '/admin/reports', icon: BarChart3 },
    { title: t.sidebar.csatAnalytics, url: '/admin/csat-analytics', icon: Star },
    { title: t.sidebar.slaCompliance, url: '/admin/sla-compliance', icon: ShieldAlert },
    { title: t.sidebar.externalApi, url: '/admin/external-api', icon: Globe },
    { title: t.sidebar.webhooks, url: '/admin/webhooks', icon: Webhook },
    { title: t.sidebar.automation, url: '/admin/automation', icon: Zap },
    { title: t.sidebar.slackIntegration, url: '/admin/slack', icon: MessageSquare },
    { title: lang === 'ar' ? 'القنوات المتعددة' : 'Omni-Channel', url: '/admin/channels', icon: Globe },
    { title: lang === 'ar' ? 'منشئ التقارير' : 'Report Builder', url: '/admin/report-builder', icon: BarChart3 },
    { title: lang === 'ar' ? 'إدارة المستأجرين' : 'Tenants', url: '/admin/tenants', icon: Building2 },
    { title: lang === 'ar' ? 'رسائل WhatsApp' : 'WhatsApp', url: '/admin/whatsapp', icon: MessageSquare },
    { title: lang === 'ar' ? 'تكامل كلاسيرا' : 'Classera Integration', url: '/admin/classera', icon: Plug },
    { title: lang === 'ar' ? '🔌 منصة التكامل الموحدة' : '🔌 Integration Hub', url: '/admin/integrations', icon: Plug },
    { title: lang === 'ar' ? 'الفوترة والاشتراكات' : 'Billing', url: '/admin/billing', icon: Users },
    { title: lang === 'ar' ? 'معالج التفعيل' : 'Onboarding', url: '/admin/onboarding', icon: Rocket },
    { title: lang === 'ar' ? 'مراقبة النظام' : 'System Health', url: '/admin/system-health', icon: Activity },
    { title: lang === 'ar' ? 'خارطة طريق التطوير' : 'Roadmap', url: '/admin/roadmap', icon: Map },
    
    { title: t.sidebar.auditLog, url: '/admin/audit-log', icon: FileSearch },
    { title: t.sidebar.securityGovernance, url: '/admin/security', icon: ShieldCheckIcon },
    { title: t.sidebar.securityNotifications, url: '/admin/security-settings', icon: Send },
    { title: t.sidebar.emailManagement, url: '/admin/email', icon: Mail },
    { title: t.sidebar.systemSettings, url: '/admin/settings', icon: Settings },
  ], [t]);

  const MenuLink = ({ item }: { item: { url: string; title: string; icon: any } }) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.url === '/'}
          className="group/link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 relative overflow-hidden"
          activeClassName="bg-primary/10 text-primary font-semibold shadow-sm"
        >
          {/* Active indicator line */}
          <div className="absolute ltr:left-0 rtl:right-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-full bg-primary transition-all duration-300 group-[.bg-primary\\/10]/link:h-5" />
          <item.icon className="h-[18px] w-[18px] shrink-0 transition-all duration-200 group-hover/link:scale-110" />
          {!collapsed && <span className="text-[13px] font-medium">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" side={lang === 'ar' ? 'right' : 'left'}>
      {/* Header with subtle gradient */}
      <SidebarHeader className="relative overflow-hidden border-b border-sidebar-border bg-sidebar">
        {/* Decorative gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />
        <div className="px-4 py-4 relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 overflow-hidden p-1.5 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 shadow-sm">
                <img src={logoSrc} alt={sysName} className="h-full w-full object-contain" />
              </div>
              {/* Online indicator dot */}
              <div className="absolute -bottom-0.5 -right-0.5 rtl:-left-0.5 rtl:right-auto w-3 h-3 rounded-full bg-success border-2 border-sidebar" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold text-sidebar-foreground tracking-tight truncate leading-tight">{sysName}</h2>
                <p className="text-[9px] font-bold tracking-[0.22em] uppercase text-sidebar-foreground/50 mt-0.5">
                  {sysSub}
                </p>
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3 py-3 custom-scrollbar bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.2em] font-bold px-3 mb-2 flex items-center gap-1.5">
            <span className="w-4 h-px bg-sidebar-foreground/15" />
            {t.sidebar.menu}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {(role === 'requester' ? requesterItems : role === 'developer' ? developerItems : mainItems).map((item) => (
                <MenuLink key={item.url} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === 'admin' && (
          <SidebarGroup>
            <div className="mx-3 my-3">
              <div className="h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
            </div>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.2em] font-bold px-3 mb-2 flex items-center gap-1.5">
              <span className="w-4 h-px bg-sidebar-foreground/15" />
              {t.sidebar.administration}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {adminItems.map((item) => (
                  <MenuLink key={item.url} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar">
        {!collapsed && profile && (
          <div className="p-3 space-y-3">
            <div
              className="flex items-center gap-3 cursor-pointer rounded-xl p-3 hover:bg-sidebar-accent/50 transition-all duration-200 group"
              onClick={() => window.location.href = '/profile'}
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shrink-0 gradient-primary shadow-sm group-hover:shadow-md transition-shadow">
                  {profile.full_name?.charAt(0) || 'م'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 rtl:-left-0.5 rtl:right-auto w-2.5 h-2.5 rounded-full bg-success border-2 border-sidebar" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-sidebar-foreground truncate">{profile.full_name}</p>
                {role && (
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border mt-0.5 ${roleBadgeColors[role] || ''}`}>
                    <Sparkles className="h-2.5 w-2.5" />
                    {roleLabels[role]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                <LanguageSwitcher />
                <ThemeToggle size="icon" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg h-8"
                onClick={() => signOut()}
              >
                <LogOut className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                {t.common.signOut}
              </Button>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-2 p-2">
            <LanguageSwitcher />
            <ThemeToggle size="icon" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={lang === 'ar' ? 'left' : 'right'}>{t.common.signOut}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
});
