import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { sanitizeError } from '@/lib/errorHandler';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTickets, fetchComments, addComment, createTicket, fetchSystems, fetchServices, fetchServiceCategories, fetchServiceFields, upsertTicketFieldValues, addAttachment, Ticket, TicketComment, TicketPriority, fetchTicketRating, submitTicketRating } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Inbox, Loader2, Send, ArrowRight, ArrowLeft as ArrowLeftIcon, LogOut, User, Clock, MessageSquare, ChevronRight, Home, FileText, Layers, Paperclip, Eye, Sparkles, Building2, Monitor, Mail, X, Star, Image } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { NotificationsPopover } from '@/components/NotificationsPopover';
import { CustomerChatbot } from '@/components/CustomerChatbot';
import { CustomerDashboard } from '@/components/CustomerDashboard';
import { WizardProgress } from '@/components/ticket-wizard/WizardProgress';
import { FileDropZone } from '@/components/ticket-wizard/FileDropZone';
import { TicketPreview } from '@/components/ticket-wizard/TicketPreview';
import { TicketProgressTracker } from '@/components/TicketProgressTracker';
import { SmartSearch } from '@/components/SmartSearch';
import { CustomerKnowledgeBase } from '@/components/CustomerKnowledgeBase';

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  open: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  in_progress: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  waiting_on_customer: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
  reopened: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-300',
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const systemStyles: Record<string, { icon: string; gradient: string }> = {
  'ERP': { icon: '🏢', gradient: 'from-blue-500/10 to-blue-600/5 border-blue-500/20' },
  'DASHBOARD': { icon: '📊', gradient: 'from-purple-500/10 to-purple-600/5 border-purple-500/20' },
  'SUPPORT': { icon: '🛠️', gradient: 'from-green-500/10 to-green-600/5 border-green-500/20' },
  'LMS': { icon: '📚', gradient: 'from-amber-500/10 to-amber-600/5 border-amber-500/20' },
  'CPAY': { icon: '💳', gradient: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' },
  'EDUMALLS': { icon: '🎓', gradient: 'from-pink-500/10 to-pink-600/5 border-pink-500/20' },
};

type PortalView = 'dashboard' | 'list' | 'detail' | 'new-ticket' | 'knowledge-base';

export default function CustomerPortal() {
  const { user, profile, signOut } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { statusLabels, priorityLabels } = useLocalizedLabels();
  const { system_name, logo_url } = useSystemSettings();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const dateLocale = lang === 'ar' ? ar : enUS;

  const priorities: { value: TicketPriority; label: string; color: string }[] = [
    { value: 'low', label: t.tickets.priority.low, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    { value: 'medium', label: t.tickets.priority.medium, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    { value: 'high', label: t.tickets.priority.high, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    { value: 'urgent', label: t.tickets.priority.urgent, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  ];

  const WIZARD_STEPS = [
    { label: t.newTicket.descriptionStep, icon: <FileText className="h-4 w-4" /> },
    { label: t.newTicket.serviceStep, icon: <Layers className="h-4 w-4" /> },
    { label: t.newTicket.attachmentsStep, icon: <Paperclip className="h-4 w-4" /> },
    { label: t.newTicket.previewStep, icon: <Eye className="h-4 w-4" /> },
  ];

  const getViewFromPath = (path: string): PortalView => {
    if (path === '/portal/new') return 'new-ticket';
    if (path === '/portal/tickets') return 'list';
    if (path === '/portal/kb') return 'knowledge-base';
    return 'dashboard';
  };

  const [view, setView] = useState<PortalView>(getViewFromPath(location.pathname));

  useEffect(() => {
    setView(getViewFromPath(location.pathname));
  }, [location.pathname]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [newComment, setNewComment] = useState('');

  // Wizard state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [systemId, setSystemId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [aiSuggestion, setAiSuggestion] = useState<{ system_id: string; service_id: string; reason: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: fetchSystems });
  const { data: allServices = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });
  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories', serviceId],
    queryFn: () => fetchServiceCategories(serviceId || undefined),
    enabled: !!serviceId,
  });
  const { data: serviceFields = [] } = useQuery({
    queryKey: ['service-fields', serviceId],
    queryFn: () => fetchServiceFields(serviceId || undefined),
    enabled: !!serviceId,
  });

  const filteredServices = systemId ? allServices.filter(s => s.system_id === systemId) : allServices;
  const selectedSystem = systems.find(s => s.id === systemId);
  const selectedService = allServices.find(s => s.id === serviceId);
  const selectedCategory = categories.find(c => c.id === categoryId);

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', selectedTicket?.id],
    queryFn: () => fetchComments(selectedTicket!.id),
    enabled: !!selectedTicket,
  });

  // Realtime: single channel for portal events (tickets + notifications)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('portal-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        if (payload.eventType === 'UPDATE' && payload.old && payload.new) {
          const oldStatus = (payload.old as any).status;
          const newStatus = (payload.new as any).status;
          if (oldStatus !== newStatus) {
            const ticketNum = (payload.new as any).ticket_number;
            toast.info(`${t.portal.statusChangedTo} #${ticketNum} → ${statusLabels[newStatus as keyof typeof statusLabels] || newStatus}`);
          }
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const notif = payload.new as any;
        toast(notif.title, { description: notif.message });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient, t, statusLabels]);

  // Realtime: comments on selected ticket only
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`portal-comments-${selectedTicket.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${selectedTicket.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['comments', selectedTicket.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id, queryClient]);

  const commentMutation = useMutation({
    mutationFn: () => addComment({ ticket_id: selectedTicket!.id, author_id: user!.id, content: newComment, note_type: 'public' }),
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', selectedTicket?.id] });
      toast.success(t.portal.messageSent);
    },
  });

  // Wizard navigation
  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, 3)); };
  const goPrev = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); };

  const canProceed = useCallback(() => {
    if (step === 0) return title.trim().length > 0 && description.trim().length > 0;
    if (step === 1) {
      for (const field of serviceFields) {
        if (field.is_required && !customFieldValues[field.id]?.trim()) return false;
      }
      return true;
    }
    return true;
  }, [step, title, description, serviceFields, customFieldValues]);

  // AI suggestion
  const requestAiSuggestion = async () => {
    if (!title.trim()) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const [suggestRes, classifyRes] = await Promise.all([
        supabase.functions.invoke('suggest-service', { body: { title: title.trim(), description: description.trim() } }),
        supabase.functions.invoke('classify-ticket', { body: { title: title.trim(), description: description.trim() } }),
      ]);
      if (suggestRes.data?.suggestion) setAiSuggestion(suggestRes.data.suggestion);
      if (classifyRes.data?.classification) {
        const cls = classifyRes.data.classification;
        if (cls.priority) setPriority(cls.priority);
        if (cls.category_id) setCategoryId(cls.category_id);
        toast.success(t.portal.smartClassification);
      }
    } catch (e) {
      console.error('AI suggestion failed:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setSystemId(aiSuggestion.system_id);
    setServiceId(aiSuggestion.service_id);
    setCategoryId('');
    toast.success(t.portal.suggestionApplied);
  };

  const ticketMutation = useMutation({
    mutationFn: async () => {
      const svc = allServices.find(s => s.id === serviceId);
      const departmentId = svc?.default_assignment_group || null;

      const ticket = await createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        requester_id: user!.id,
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(serviceId ? { service_id: serviceId } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
      } as any);

      const fieldEntries = Object.entries(customFieldValues).filter(([_, v]) => v.trim());
      if (fieldEntries.length > 0) {
        await upsertTicketFieldValues(
          fieldEntries.map(([fieldId, value]) => ({ ticket_id: ticket.id, field_id: fieldId, value }))
        );
      }

      for (const file of files) {
        const filePath = `${ticket.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
        if (uploadError) continue;
        await addAttachment({
          ticket_id: ticket.id,
          uploaded_by: user!.id,
          file_name: file.name,
          file_url: '',
          storage_key: filePath,
          file_size: file.size,
        });
      }
      return ticket;
    },
    onSuccess: () => {
      resetWizard();
      setView('list');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(t.portal.ticketCreatedSuccess);
    },
    onError: (err: any) => toast.error(sanitizeError(err)),
  });

  const handleSubmit = () => {
    for (const field of serviceFields) {
      if (field.is_required && !customFieldValues[field.id]?.trim()) {
        toast.error(t.portal.fieldRequiredMsg.replace('{field}', field.field_name));
        return;
      }
    }
    ticketMutation.mutate();
  };

  const resetWizard = () => {
    setStep(0); setDirection(1); setTitle(''); setDescription(''); setPriority('medium');
    setSystemId(''); setServiceId(''); setCategoryId('');
    setFiles([]); setCustomFieldValues({}); setAiSuggestion(null);
  };

  const openTicketDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setView('detail');
  };

  const openNewTicket = () => {
    resetWizard();
    setView('new-ticket');
    navigate('/portal/new');
  };

  const goBackToList = () => {
    setSelectedTicket(null);
    setView('list');
    navigate('/portal/tickets');
  };

  const goBackToDashboard = () => {
    setSelectedTicket(null);
    setView('dashboard');
    navigate('/portal');
  };

  const myTickets = tickets.filter(t_item => {
    const matchSearch = !searchQuery || t_item.title.includes(searchQuery) || t_item.code?.includes(searchQuery);
    const matchStatus = statusTab === 'all' || (statusTab === 'active' ? !['closed', 'resolved'].includes(t_item.status) : ['closed', 'resolved'].includes(t_item.status));
    return matchSearch && matchStatus;
  });

  const activeCount = tickets.filter(t_item => !['closed', 'resolved'].includes(t_item.status)).length;
  const resolvedCount = tickets.filter(t_item => ['closed', 'resolved'].includes(t_item.status)).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationsPopover />
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CustomerDashboard onTicketClick={openTicketDetail} />
            </motion.div>
          )}

          {view === 'detail' && selectedTicket && (
            <TicketDetailView
              key="detail"
              ticket={selectedTicket}
              comments={comments}
              commentsLoading={commentsLoading}
              newComment={newComment}
              setNewComment={setNewComment}
              onSendComment={() => commentMutation.mutate()}
              sending={commentMutation.isPending}
              onBack={goBackToList}
            />
          )}

          {view === 'new-ticket' && (
            <motion.div key="new-ticket" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={goBackToList}>
                  {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
                  {t.portal.backToTickets}
                </Button>
                <h2 className="text-lg font-bold">{t.portal.newTicket}</h2>
              </div>

              {/* Requester info */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {profile?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{profile?.full_name || t.common.user}</h3>
                      <Badge variant="outline" className="text-xs">{t.portal.requesterRole}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {profile?.email || user?.email}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {t.portal.requesterLabel}
                    </span>
                  </div>
                </div>
              </motion.div>

              <div className="max-w-2xl mx-auto">
                <WizardProgress steps={WIZARD_STEPS} currentStep={step} />

                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        {/* Step 0: Title & Description */}
                        {step === 0 && (
                          <div className="space-y-5">
                            <div className="space-y-2">
                              <Label htmlFor="title">{t.newTicket.titleRequired}</Label>
                              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.newTicket.titlePlaceholder} maxLength={200} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="desc">{t.newTicket.descriptionRequired}</Label>
                              <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder={t.newTicket.descriptionPlaceholder} className="min-h-[140px]" maxLength={2000} />
                            </div>
                            <div className="space-y-2">
                              <Label>{t.newTicket.priorityLabel}</Label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {priorities.map(p => (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setPriority(p.value)}
                                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                                      priority === p.value
                                        ? `${p.color} ring-2 ring-offset-1 ring-current`
                                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                                    }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step 1: Service Catalog */}
                        {step === 1 && (
                          <div className="space-y-5">
                            {/* AI suggestion */}
                            {title.trim() && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-accent" />
                                    <span className="text-sm font-medium">{t.portal.aiSuggestion}</span>
                                  </div>
                                  {!aiSuggestion && (
                                    <Button size="sm" variant="outline" onClick={requestAiSuggestion} disabled={aiLoading} className="gap-1.5">
                                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                      {aiLoading ? t.portal.analyzing : t.portal.suggestAuto}
                                    </Button>
                                  )}
                                </div>
                                <AnimatePresence>
                                  {aiSuggestion && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2">
                                      <p className="text-sm text-muted-foreground">{aiSuggestion.reason}</p>
                                      <Button size="sm" onClick={applyAiSuggestion} className="gap-1.5">{t.portal.applySuggestion}</Button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            )}

                            {/* Breadcrumb */}
                            {(systemId || serviceId || categoryId) && (
                              <div className="flex items-center gap-1 text-sm flex-wrap">
                                {selectedSystem && (
                                  <button onClick={() => { setSystemId(''); setServiceId(''); setCategoryId(''); }} className="text-primary hover:underline font-medium">
                                    {selectedSystem.name}
                                  </button>
                                )}
                                {selectedService && (
                                  <>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                                    <button onClick={() => { setServiceId(''); setCategoryId(''); }} className="text-primary hover:underline font-medium">
                                      {selectedService.name}
                                    </button>
                                  </>
                                )}
                                {selectedCategory && (
                                  <>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                                    <span className="text-foreground font-medium">{selectedCategory.name}</span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Select System */}
                            {!systemId && (
                              <div className="space-y-3">
                                <Label className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-primary" />
                                  {t.portal.selectSystem}
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {systems.map(sys => {
                                    const style = systemStyles[sys.code] || { icon: '📦', gradient: 'from-gray-500/10 to-gray-600/5 border-gray-500/20' };
                                    return (
                                      <motion.button
                                        key={sys.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => { setSystemId(sys.id); setServiceId(''); setCategoryId(''); setAiSuggestion(null); }}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br ${style.gradient} hover:shadow-md transition-all text-center`}
                                      >
                                        <span className="text-2xl">{style.icon}</span>
                                        <span className="text-sm font-semibold text-foreground">{sys.name}</span>
                                        {sys.description && <span className="text-xs text-muted-foreground line-clamp-1">{sys.description}</span>}
                                      </motion.button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Select Service */}
                            {systemId && !serviceId && (
                              <div className="space-y-3">
                                <Label className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-primary" />
                                  {t.portal.selectModule}
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {filteredServices.map(svc => (
                                    <motion.button
                                      key={svc.id}
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => { setServiceId(svc.id); setCategoryId(''); }}
                                      className="flex items-center gap-3 p-3.5 rounded-xl border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all ltr:text-left rtl:text-right"
                                    >
                                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Layers className="h-4 w-4 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                                        {svc.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{svc.description}</p>}
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                                    </motion.button>
                                  ))}
                                </div>
                                {filteredServices.length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-6">{t.portal.noServicesForSystem}</p>
                                )}
                              </div>
                            )}

                            {/* Select Category */}
                            {serviceId && !categoryId && categories.length > 0 && (
                              <div className="space-y-3">
                                <Label className="flex items-center gap-2">
                                  <Monitor className="h-4 w-4 text-primary" />
                                  {t.portal.selectScreen}
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {categories.map(cat => (
                                    <motion.button
                                      key={cat.id}
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => setCategoryId(cat.id)}
                                      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all ltr:text-left rtl:text-right"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground">{cat.name}</p>
                                        {cat.description && <p className="text-xs text-muted-foreground line-clamp-1">{cat.description}</p>}
                                      </div>
                                    </motion.button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Selection summary */}
                            {serviceId && (categoryId || categories.length === 0) && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                                <p className="text-sm font-semibold text-primary flex items-center gap-2">{t.portal.serviceSelected}</p>
                                <div className="flex items-center gap-2 text-sm text-foreground flex-wrap">
                                  {selectedSystem && <Badge variant="outline">{selectedSystem.name}</Badge>}
                                  {selectedService && <Badge variant="outline">{selectedService.name}</Badge>}
                                  {selectedCategory && <Badge variant="outline">{selectedCategory.name}</Badge>}
                                </div>
                              </motion.div>
                            )}

                            {/* Dynamic fields */}
                            {serviceFields.length > 0 && serviceId && (
                              <div className="space-y-4 p-4 rounded-xl border border-dashed bg-muted/20">
                                <p className="text-sm font-semibold text-muted-foreground">{t.portal.additionalFields}</p>
                                {serviceFields.map(field => (
                                  <div key={field.id} className="space-y-2">
                                    <Label>{field.field_name} {field.is_required && '*'}</Label>
                                    {field.field_type === 'text' && (
                                      <Input value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} />
                                    )}
                                    {field.field_type === 'number' && (
                                      <Input type="number" value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} />
                                    )}
                                    {field.field_type === 'textarea' && (
                                      <Textarea value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} className="min-h-[80px]" />
                                    )}
                                    {field.field_type === 'select' && (
                                      <Select value={customFieldValues[field.id] || ''} onValueChange={v => setCustomFieldValues(prev => ({ ...prev, [field.id]: v }))}>
                                        <SelectTrigger><SelectValue placeholder={`${t.newTicket.selectFieldPlaceholder} ${field.field_name}`} /></SelectTrigger>
                                        <SelectContent>
                                          {(field.options || []).map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 2: Files */}
                        {step === 2 && <FileDropZone files={files} onFilesChange={setFiles} />}

                        {/* Step 3: Preview */}
                        {step === 3 && (
                          <TicketPreview
                            title={title}
                            description={description}
                            priority={priority}
                            systemId={systemId}
                            serviceId={serviceId}
                            categoryId={categoryId}
                            files={files}
                            customFieldValues={customFieldValues}
                            systems={systems}
                            services={allServices}
                            categories={categories}
                            serviceFields={serviceFields}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-5 border-t">
                      <Button type="button" variant="ghost" onClick={goPrev} disabled={step === 0} className="gap-1.5">
                        {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
                        {t.common.previous}
                      </Button>

                      {step < 3 ? (
                        <Button type="button" onClick={goNext} disabled={!canProceed()} className="gap-1.5">
                          {t.common.next}
                          {isRTL ? <ArrowLeftIcon className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSubmit}
                          disabled={ticketMutation.isPending || !title.trim()}
                          className="gap-2 shadow-lg"
                        >
                          {ticketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {t.newTicket.submitTicket}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <Card className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
                    <p className="text-xs text-muted-foreground">{t.portal.totalTickets}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">{t.portal.active}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
                    <p className="text-xs text-muted-foreground">{t.portal.resolvedLabel}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mb-4">
                <SmartSearch onTicketClick={openTicketDetail} className="flex-1" />
                <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={openNewTicket}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.portal.newTicket}</span>
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={statusTab} onValueChange={setStatusTab} dir={isRTL ? 'rtl' : 'ltr'}>
                <TabsList className="bg-muted/50 mb-4">
                  <TabsTrigger value="all">{t.portal.all} ({tickets.length})</TabsTrigger>
                  <TabsTrigger value="active">{t.portal.active} ({activeCount})</TabsTrigger>
                  <TabsTrigger value="resolved">{t.portal.resolvedLabel} ({resolvedCount})</TabsTrigger>
                </TabsList>

                <TabsContent value={statusTab} className="mt-0">
                  {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : myTickets.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-muted-foreground">
                      <Inbox className="h-12 w-12 mb-3 opacity-30" />
                      <p className="font-medium">{t.portal.noTickets}</p>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      {myTickets.map((ticket, i) => (
                        <motion.div
                          key={ticket.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <Card
                            className="cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-primary/30 group"
                            onClick={() => openTicketDetail(ticket)}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] text-muted-foreground font-mono">{ticket.code}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${statusColors[ticket.status]}`}>
                                    {statusLabels[ticket.status]}
                                  </Badge>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${priorityColors[ticket.priority]}`}>
                                    {priorityLabels[ticket.priority]}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(ticket.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                                  </span>
                                  {ticket.services && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {ticket.services.systems?.name} → {ticket.services.name}
                                    </span>
                                  )}
                                </div>
                                <TicketProgressTracker status={ticket.status} compact className="mt-2" slaResolutionDueAt={ticket.sla_resolution_due_at} createdAt={ticket.created_at} resolvedAt={ticket.resolved_at} />
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors rtl:rotate-180" />
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

          {view === 'knowledge-base' && (
            <motion.div key="kb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CustomerKnowledgeBase />
            </motion.div>
          )}
        </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      <CustomerChatbot />
    </SidebarProvider>
  );
}

function TicketDetailView({
  ticket, comments, commentsLoading, newComment, setNewComment, onSendComment, sending, onBack,
}: {
  ticket: Ticket;
  comments: TicketComment[];
  commentsLoading: boolean;
  newComment: string;
  setNewComment: (v: string) => void;
  onSendComment: () => void;
  sending: boolean;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const { statusLabels, priorityLabels } = useLocalizedLabels();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevCommentsCount = useRef(comments.length);
  const dateLocale = lang === 'ar' ? ar : enUS;

  // Sound notification for new messages
  useEffect(() => {
    if (comments.length > prevCommentsCount.current && prevCommentsCount.current > 0) {
      const lastComment = comments[comments.length - 1];
      if (lastComment && lastComment.author_id !== user?.id) {
        playMessageSound();
      }
    }
    prevCommentsCount.current = comments.length;
  }, [comments.length, user?.id]);

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [comments.length]);

  // Rating state
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');

  const { data: existingRating } = useQuery({
    queryKey: ['ticket-rating', ticket.id],
    queryFn: () => fetchTicketRating(ticket.id),
  });

  const ratingMutation = useMutation({
    mutationFn: () => submitTicketRating({ ticket_id: ticket.id, user_id: user!.id, rating: ratingStars, feedback: ratingFeedback || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rating', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['my-ratings'] });
      toast.success(t.portal.ratingSuccess);
    },
    onError: () => toast.error(t.portal.ratingError),
  });

  // File attachment in chat
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileInChat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingFile(true);
    try {
      const filePath = `${ticket.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      // Short-lived (1h) signed URL just for the inline chat preview
      const { data: signedData } = await supabase.storage.from('ticket-attachments').createSignedUrl(filePath, 60 * 60);
      const fileUrl = signedData?.signedUrl || '';

      await addAttachment({ ticket_id: ticket.id, uploaded_by: user.id, file_name: file.name, file_url: '', storage_key: filePath, file_size: file.size });

      const isImage = file.type.startsWith('image/');
      const content = isImage ? `📷 [${t.portal.imageAttachment}: ${file.name}](${fileUrl})` : `📎 [${t.portal.fileAttachment}: ${file.name}](${fileUrl})`;
      await addComment({ ticket_id: ticket.id, author_id: user.id, content, note_type: 'public' });
      
      queryClient.invalidateQueries({ queryKey: ['comments', ticket.id] });
      toast.success(t.portal.fileAttachedSuccess);
    } catch (err: any) {
      toast.error(sanitizeError(err));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isResolved = ['resolved', 'closed'].includes(ticket.status);

  return (
    <motion.div initial={{ opacity: 0, x: isRTL ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRTL ? -20 : 20 }} transition={{ duration: 0.3 }}>
      <Button variant="ghost" size="sm" className="gap-1.5 mb-4 text-muted-foreground" onClick={onBack}>
        {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
        {t.portal.backToTickets}
      </Button>

      {/* Progress Tracker */}
      <Card className="border-border/50 p-4 mb-4">
        <TicketProgressTracker status={ticket.status} slaResolutionDueAt={ticket.sla_resolution_due_at} createdAt={ticket.created_at} resolvedAt={ticket.resolved_at} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-border/50 h-fit space-y-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">{t.portal.ticketDetails}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-[10px] text-muted-foreground">{t.portal.theCode}</span>
              <p className="text-sm font-mono font-medium">{ticket.code}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">{t.portal.theTitle}</span>
              <p className="text-sm font-medium">{ticket.title}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">{t.portal.theDescription}</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{ticket.description}</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-muted-foreground">{t.portal.theStatus}</span>
                <Badge className={`mt-1 w-full justify-center border-0 ${statusColors[ticket.status]}`}>
                  {statusLabels[ticket.status]}
                </Badge>
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-muted-foreground">{t.portal.thePriority}</span>
                <Badge className={`mt-1 w-full justify-center border-0 ${priorityColors[ticket.priority]}`}>
                  {priorityLabels[ticket.priority]}
                </Badge>
              </div>
            </div>
            {ticket.services && (
              <div>
                <span className="text-[10px] text-muted-foreground">{t.portal.theService}</span>
                <p className="text-sm">{ticket.services.systems?.name} → {ticket.services.name}</p>
              </div>
            )}
            <div>
              <span className="text-[10px] text-muted-foreground">{t.portal.theCreatedAt}</span>
              <p className="text-sm">{format(new Date(ticket.created_at), 'dd MMMM yyyy - HH:mm', { locale: dateLocale })}</p>
            </div>
            {ticket.agent && (
              <div>
                <span className="text-[10px] text-muted-foreground">{t.portal.theAgent}</span>
                <p className="text-sm">{ticket.agent.full_name}</p>
              </div>
            )}
          </CardContent>

          {/* Rating Section */}
          {isResolved && (
            <div className="border-t p-4">
              {existingRating ? (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">{t.portal.ratingTitle}</p>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`h-5 w-5 ${s <= existingRating.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  {existingRating.feedback && (
                    <p className="text-xs text-muted-foreground italic">"{existingRating.feedback}"</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-center">{t.portal.rateExperience}</p>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onMouseEnter={() => setRatingHover(s)}
                        onMouseLeave={() => setRatingHover(0)}
                        onClick={() => setRatingStars(s)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star className={`h-6 w-6 transition-colors ${
                          s <= (ratingHover || ratingStars)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30'
                        }`} />
                      </button>
                    ))}
                  </div>
                  {ratingStars > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                      <Textarea
                        placeholder={t.portal.feedbackPlaceholder}
                        value={ratingFeedback}
                        onChange={e => setRatingFeedback(e.target.value)}
                        className="min-h-[60px] text-sm"
                        maxLength={500}
                      />
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => ratingMutation.mutate()}
                        disabled={ratingMutation.isPending}
                      >
                        {ratingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                        {t.portal.submitRating}
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 border-border/50 flex flex-col" style={{ minHeight: '60vh' }}>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t.portal.conversation}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-4">
            {commentsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">{t.portal.noMessagesYet}</p>
                <p className="text-xs">{t.portal.sendMessageToSupport}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => {
                  const isMe = c.author_id === ticket.requester_id;
                  const isAttachment = c.content.startsWith('📷') || c.content.startsWith('📎');
                  const urlMatch = c.content.match(/\]\((https?:\/\/[^\)]+)\)/);
                  const isImage = c.content.startsWith('📷') && urlMatch;

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMe ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                        {!isMe && (
                          <p className="text-[10px] font-medium mb-1 opacity-70">{c.author?.full_name || t.portal.supportTeam}</p>
                        )}
                        {isImage && urlMatch ? (
                          <div className="space-y-1.5">
                            <img src={urlMatch[1]} alt={t.portal.imageAttachment} className="rounded-lg max-h-48 w-auto cursor-pointer" onClick={() => window.open(urlMatch[1], '_blank')} />
                            <p className="text-[10px] opacity-70">{c.content.match(/\[([^\]]+)\]/)?.[1]}</p>
                          </div>
                        ) : isAttachment && urlMatch ? (
                          <a href={urlMatch[1]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline text-sm">
                            <Paperclip className="h-3.5 w-3.5" />
                            {c.content.match(/\[([^\]]+)\]/)?.[1]}
                          </a>
                        ) : (
                          <p className="text-sm leading-relaxed">{c.content}</p>
                        )}
                        <p className={`text-[9px] mt-1 ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                          {format(new Date(c.created_at), 'HH:mm - dd/MM', { locale: dateLocale })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={handleFileInChat}
            />
            <Button
              size="icon"
              variant="ghost"
              className="rounded-xl shrink-0"
              disabled={uploadingFile}
              onClick={() => fileInputRef.current?.click()}
              title={t.portal.attachFile}
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Input
              placeholder={t.portal.writeYourMessage}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && newComment.trim() && onSendComment()}
              className="rounded-xl"
            />
            <Button size="icon" className="rounded-xl shrink-0" disabled={!newComment.trim() || sending} onClick={onSendComment}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// Play a short notification sound using Web Audio API
function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Audio not supported
  }
}
