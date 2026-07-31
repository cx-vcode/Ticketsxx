import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { useRealtimeNotificationSound } from '@/hooks/useRealtimeNotificationSound';
import { ThemeProvider } from '@/hooks/useTheme';
import { SystemSettingsProvider } from '@/hooks/useSystemSettings';
import { LanguageProvider } from '@/i18n';
import { PageLoader } from '@/components/PageLoader';
import { CustomerChatbot } from '@/components/CustomerChatbot';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy-loaded pages
const Index = lazy(() => import('./pages/Index'));
const AuthPage = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NewTicket = lazy(() => import('./pages/NewTicket'));
const TicketsInbox = lazy(() => import('./pages/TicketsInbox'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const AdminDepartments = lazy(() => import('./pages/AdminDepartments'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminSLA = lazy(() => import('./pages/AdminSLA'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminServiceCatalog = lazy(() => import('./pages/AdminServiceCatalog'));
const AdminServiceFields = lazy(() => import('./pages/AdminServiceFields'));
const AdminApprovalStages = lazy(() => import('./pages/AdminApprovalStages'));
const AdminApprovalReports = lazy(() => import('./pages/AdminApprovalReports'));
const AdminApprovalKanban = lazy(() => import('./pages/AdminApprovalKanban'));
const AdminApprovalHealth = lazy(() => import('./pages/AdminApprovalHealth'));
const AdminApprovalTemplates = lazy(() => import('./pages/AdminApprovalTemplates'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AgentPerformance = lazy(() => import('./pages/AgentPerformance'));
const AdminExternalAPI = lazy(() => import('./pages/AdminExternalAPI'));
const AdminWebhooks = lazy(() => import('./pages/AdminWebhooks'));
const AdminAutomation = lazy(() => import('./pages/AdminAutomation'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard'));
const CSATAnalytics = lazy(() => import('./pages/CSATAnalytics'));
const SLACompliance = lazy(() => import('./pages/SLACompliance'));
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'));
const AdminSlackIntegration = lazy(() => import('./pages/AdminSlackIntegration'));
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'));
const AdminSecurityDashboard = lazy(() => import('./pages/AdminSecurityDashboard'));
const AdminSecuritySettings = lazy(() => import('./pages/AdminSecuritySettings'));
const AdminEmailManagement = lazy(() => import('./pages/AdminEmailManagement'));
const AdminChannels = lazy(() => import('./pages/AdminChannels'));
const AdminReportBuilder = lazy(() => import('./pages/AdminReportBuilder'));
const AdminTenants = lazy(() => import('./pages/AdminTenants'));
const AdminWhatsApp = lazy(() => import('./pages/AdminWhatsApp'));
const AdminClasseraIntegrations = lazy(() => import('./pages/AdminClasseraIntegrations'));
const AdminBilling = lazy(() => import('./pages/AdminBilling'));
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'));
const SystemHealthMonitoring = lazy(() => import('./pages/SystemHealthMonitoring'));
const SystemGuide = lazy(() => import('./pages/SystemGuide'));
const AdminRoadmap = lazy(() => import('./pages/AdminRoadmap'));
const AdminIntegrations = lazy(() => import('./pages/AdminIntegrations'));

const NotificationsInbox = lazy(() => import('./pages/NotificationsInbox'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 auth errors
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

function ProtectedRoute({ children, redirectRequester }: { children: React.ReactNode; redirectRequester?: boolean }) {
  const { user, loading, role } = useAuth();
  useRealtimeNotificationSound();
  useTenantBranding(); // Apply tenant white-label branding
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (redirectRequester && role === 'requester') return <Navigate to="/portal" replace />;
  if (redirectRequester && role === 'developer') return <Navigate to="/developer" replace />;
  return <>{children}<CustomerChatbot /></>;
}

function RequesterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useRealtimeNotificationSound();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <SystemSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/" element={<ProtectedRoute redirectRequester><Index /></ProtectedRoute>} />
                    <Route path="/portal" element={<RequesterRoute><CustomerPortal /></RequesterRoute>} />
                    <Route path="/portal/tickets" element={<RequesterRoute><CustomerPortal /></RequesterRoute>} />
                    <Route path="/portal/new" element={<RequesterRoute><CustomerPortal /></RequesterRoute>} />
                    <Route path="/portal/kb" element={<RequesterRoute><CustomerPortal /></RequesterRoute>} />
                    <Route path="/tickets" element={<ProtectedRoute redirectRequester><TicketsInbox /></ProtectedRoute>} />
                    <Route path="/tickets/new" element={<ProtectedRoute redirectRequester><NewTicket /></ProtectedRoute>} />
                    <Route path="/developer" element={<ProtectedRoute><DeveloperDashboard /></ProtectedRoute>} />
                    <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
                    <Route path="/admin/departments" element={<ProtectedRoute><AdminDepartments /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
                    <Route path="/admin/sla" element={<ProtectedRoute><AdminSLA /></ProtectedRoute>} />
                    <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
                    <Route path="/admin/services" element={<ProtectedRoute><AdminServiceCatalog /></ProtectedRoute>} />
                    <Route path="/admin/service-fields" element={<ProtectedRoute><AdminServiceFields /></ProtectedRoute>} />
                    <Route path="/admin/approval-stages" element={<ProtectedRoute><AdminApprovalStages /></ProtectedRoute>} />
                    <Route path="/admin/approval-reports" element={<ProtectedRoute><AdminApprovalReports /></ProtectedRoute>} />
                    <Route path="/admin/approval-kanban" element={<ProtectedRoute><AdminApprovalKanban /></ProtectedRoute>} />
                    <Route path="/admin/approval-health" element={<ProtectedRoute><AdminApprovalHealth /></ProtectedRoute>} />
                    <Route path="/admin/approval-templates" element={<ProtectedRoute><AdminApprovalTemplates /></ProtectedRoute>} />
                    <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/admin/agent-performance" element={<ProtectedRoute><AgentPerformance /></ProtectedRoute>} />
                    <Route path="/admin/external-api" element={<ProtectedRoute><AdminExternalAPI /></ProtectedRoute>} />
                    <Route path="/admin/webhooks" element={<ProtectedRoute><AdminWebhooks /></ProtectedRoute>} />
                    <Route path="/admin/automation" element={<ProtectedRoute><AdminAutomation /></ProtectedRoute>} />
                    <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
                    <Route path="/admin/csat-analytics" element={<ProtectedRoute><CSATAnalytics /></ProtectedRoute>} />
                    <Route path="/admin/sla-compliance" element={<ProtectedRoute><SLACompliance /></ProtectedRoute>} />
                    <Route path="/admin/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
                    <Route path="/admin/slack" element={<ProtectedRoute><AdminSlackIntegration /></ProtectedRoute>} />
                    <Route path="/admin/audit-log" element={<ProtectedRoute><AdminAuditLog /></ProtectedRoute>} />
                    <Route path="/admin/security" element={<ProtectedRoute><AdminSecurityDashboard /></ProtectedRoute>} />
                    <Route path="/admin/security-settings" element={<ProtectedRoute><AdminSecuritySettings /></ProtectedRoute>} />
                    <Route path="/admin/email" element={<ProtectedRoute><AdminEmailManagement /></ProtectedRoute>} />
                    <Route path="/admin/channels" element={<ProtectedRoute><AdminChannels /></ProtectedRoute>} />
                    <Route path="/admin/report-builder" element={<ProtectedRoute><AdminReportBuilder /></ProtectedRoute>} />
                    <Route path="/admin/tenants" element={<ProtectedRoute><AdminTenants /></ProtectedRoute>} />
                    <Route path="/admin/whatsapp" element={<ProtectedRoute><AdminWhatsApp /></ProtectedRoute>} />
                    <Route path="/admin/classera" element={<ProtectedRoute><AdminClasseraIntegrations /></ProtectedRoute>} />
                    <Route path="/admin/billing" element={<ProtectedRoute><AdminBilling /></ProtectedRoute>} />
                    <Route path="/admin/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
                    <Route path="/admin/system-health" element={<ProtectedRoute><SystemHealthMonitoring /></ProtectedRoute>} />
                    <Route path="/system-guide" element={<ProtectedRoute><SystemGuide /></ProtectedRoute>} />
                    <Route path="/admin/roadmap" element={<ProtectedRoute><AdminRoadmap /></ProtectedRoute>} />
                    <Route path="/admin/integrations" element={<ProtectedRoute><AdminIntegrations /></ProtectedRoute>} />
                    
                    <Route path="/notifications" element={<ProtectedRoute><NotificationsInbox /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </SystemSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
