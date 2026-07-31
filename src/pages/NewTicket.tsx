import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { createTicket, addAttachment, fetchSystems, fetchServices, fetchServiceCategories, fetchServiceFields, upsertTicketFieldValues, previewApprovalStagesForService, TicketPriority } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeError } from '@/lib/errorHandler';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight, ArrowLeft, Loader2, Send, FileText, Layers, Paperclip, Eye, Sparkles, User, Mail, Building2, Monitor, ChevronRight, ShieldAlert, AlertCircle, Save, RotateCcw, X } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { WizardProgress } from '@/components/ticket-wizard/WizardProgress';
import { FileDropZone } from '@/components/ticket-wizard/FileDropZone';
import { TicketPreview } from '@/components/ticket-wizard/TicketPreview';
import { TicketTemplatesPicker } from '@/components/TicketTemplates';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const systemStyles: Record<string, { icon: string; gradient: string }> = {
  'ERP': { icon: '🏢', gradient: 'from-blue-500/10 to-blue-600/5 border-blue-500/20' },
  'DASHBOARD': { icon: '📊', gradient: 'from-purple-500/10 to-purple-600/5 border-purple-500/20' },
  'SUPPORT': { icon: '🛠️', gradient: 'from-green-500/10 to-green-600/5 border-green-500/20' },
  'LMS': { icon: '📚', gradient: 'from-amber-500/10 to-amber-600/5 border-amber-500/20' },
  'CPAY': { icon: '💳', gradient: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' },
  'EDUMALLS': { icon: '🎓', gradient: 'from-pink-500/10 to-pink-600/5 border-pink-500/20' },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export default function NewTicket() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const { roleLabels } = useLocalizedLabels();

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

  const TITLE_MIN = 5;
  const TITLE_MAX = 200;
  const DESC_MIN = 15;
  const DESC_MAX = 2000;
  const DRAFT_KEY = 'new-ticket-draft-v1';

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
  const [touched, setTouched] = useState<{ title?: boolean; description?: boolean }>({});
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const [hasDraftPrompt, setHasDraftPrompt] = useState(false);
  const draftCheckedRef = useRef(false);

  // Restore draft on mount
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && (draft.title || draft.description)) {
        setHasDraftPrompt(true);
      }
    } catch {}
  }, []);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setTitle(d.title || '');
      setDescription(d.description || '');
      setPriority(d.priority || 'medium');
      setSystemId(d.systemId || '');
      setServiceId(d.serviceId || '');
      setCategoryId(d.categoryId || '');
      setCustomFieldValues(d.customFieldValues || {});
      setHasDraftPrompt(false);
      setDraftRestoredAt(Date.now());
    } catch {}
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraftPrompt(false);
  };

  // Persist draft (debounced via raf)
  useEffect(() => {
    if (hasDraftPrompt) return; // don't overwrite while prompt is open
    const id = setTimeout(() => {
      const draft = { title, description, priority, systemId, serviceId, categoryId, customFieldValues };
      const hasContent = title || description || systemId || serviceId;
      if (hasContent) {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
      }
    }, 600);
    return () => clearTimeout(id);
  }, [title, description, priority, systemId, serviceId, categoryId, customFieldValues, hasDraftPrompt]);

  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: fetchSystems });
  const { data: services = [] } = useQuery({
    queryKey: ['services', systemId],
    queryFn: () => fetchServices(systemId || undefined),
    enabled: true,
  });
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
  const { data: stagePreview = [], isLoading: stagePreviewLoading } = useQuery({
    queryKey: ['stage-preview', serviceId],
    queryFn: () => previewApprovalStagesForService(serviceId),
    enabled: !!serviceId,
  });
  const isAdmin = role === 'admin';

  const filteredServices = systemId ? services.filter(s => s.system_id === systemId) : services;
  const selectedSystem = systems.find(s => s.id === systemId);
  const selectedService = services.find(s => s.id === serviceId);
  const selectedCategory = categories.find(c => c.id === categoryId);

  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, 3)); };
  const goPrev = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); };

  // Live validation
  const titleTrim = title.trim();
  const descTrim = description.trim();
  const titleError =
    titleTrim.length === 0 ? (isRTL ? 'العنوان مطلوب' : 'Title is required')
    : titleTrim.length < TITLE_MIN ? (isRTL ? `العنوان قصير جدًا (الحد الأدنى ${TITLE_MIN} أحرف)` : `Title is too short (min ${TITLE_MIN} chars)`)
    : null;
  const descError =
    descTrim.length === 0 ? (isRTL ? 'الوصف مطلوب' : 'Description is required')
    : descTrim.length < DESC_MIN ? (isRTL ? `الوصف قصير جدًا (الحد الأدنى ${DESC_MIN} حرفًا)` : `Description is too short (min ${DESC_MIN} chars)`)
    : null;

  const missingRequiredFields = serviceFields.filter(f => f.is_required && !customFieldValues[f.id]?.trim());

  const canProceed = useCallback(() => {
    if (step === 0) return !titleError && !descError;
    if (step === 1) {
      if (!serviceId) return false;
      return missingRequiredFields.length === 0;
    }
    return true;
  }, [step, titleError, descError, serviceId, missingRequiredFields]);

  const blockReason = (): string | null => {
    if (step === 0) return titleError || descError;
    if (step === 1) {
      if (!serviceId) return isRTL ? 'يرجى اختيار الخدمة' : 'Please select a service';
      if (missingRequiredFields.length > 0) {
        return isRTL
          ? `حقول مطلوبة ناقصة: ${missingRequiredFields.map(f => f.field_name).join(', ')}`
          : `Missing required fields: ${missingRequiredFields.map(f => f.field_name).join(', ')}`;
      }
    }
    return null;
  };

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
        toast({ title: t.newTicket.smartClassification, description: cls.reason || t.newTicket.autoPrioritySet });
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
    toast({ title: t.newTicket.suggestionApplied });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const departmentId = selectedService?.default_assignment_group || null;
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
        await upsertTicketFieldValues(fieldEntries.map(([fieldId, value]) => ({ ticket_id: ticket.id, field_id: fieldId, value })));
      }

      for (const file of files) {
        const filePath = `${ticket.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
        if (uploadError) continue;
        await addAttachment({ ticket_id: ticket.id, uploaded_by: user!.id, file_name: file.name, file_url: '', storage_key: filePath, file_size: file.size });
      }
      return ticket;
    },
    onSuccess: () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      toast({ title: t.newTicket.ticketCreated });
      navigate('/tickets');
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    for (const field of serviceFields) {
      if (field.is_required && !customFieldValues[field.id]?.trim()) {
        toast({ title: `${field.field_name} - ${t.newTicket.fieldRequired}`, variant: 'destructive' });
        return;
      }
    }
    mutation.mutate();
  };

  // Cmd/Ctrl + Enter advances or submits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (step < 3 && canProceed()) goNext();
        else if (step === 3 && !mutation.isPending) handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, canProceed, mutation.isPending]);

  const roleLabel = role ? roleLabels[role] : '';

  return (
    <PageLayout>
      <PageHeader
        title={t.newTicket.title}
        icon={<FileText className="h-4 w-4" />}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowRight className={`h-4 w-4 ${!isRTL ? 'rotate-180' : ''}`} />
            <span className="hidden sm:inline">{t.common.back ?? (isRTL ? 'رجوع' : 'Back')}</span>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
          {/* Requester strip — minimal, single line */}
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-3.5 py-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {profile?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">{profile?.full_name || t.common.user}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">{roleLabel}</Badge>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />{profile?.email || user?.email}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" />{t.newTicket.requesterLabel}
            </span>
          </motion.div>

          <AnimatePresence>
            {hasDraftPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 flex items-center gap-3"
              >
                <Save className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-foreground flex-1">
                  {isRTL ? 'لديك مسودة محفوظة لتذكرة لم تكتمل. هل تريد استعادتها؟' : 'You have a saved draft of an unfinished ticket. Restore it?'}
                </p>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={restoreDraft}>
                  <RotateCcw className="h-3 w-3" />{isRTL ? 'استعادة' : 'Restore'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={discardDraft}>
                  <X className="h-3 w-3" />{isRTL ? 'تجاهل' : 'Discard'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <WizardProgress steps={WIZARD_STEPS} currentStep={step} />

          <Card className="overflow-hidden border-border/60 shadow-sm">
            <CardContent className="p-5 md:p-6">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
                      {step === 0 && (
                        <div className="space-y-5">
                          <TicketTemplatesPicker onSelect={(tmpl) => { setTitle(tmpl.title); setDescription(tmpl.description); setPriority(tmpl.priority); }} />
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="title">{t.newTicket.titleRequired}</Label>
                              <span className={cn('text-[10px] tabular-nums', titleTrim.length > TITLE_MAX * 0.9 ? 'text-warning' : 'text-muted-foreground')}>
                                {titleTrim.length}/{TITLE_MAX}
                              </span>
                            </div>
                            <Input
                              id="title"
                              value={title}
                              onChange={e => setTitle(e.target.value)}
                              onBlur={() => setTouched(s => ({ ...s, title: true }))}
                              placeholder={t.newTicket.titlePlaceholder}
                              maxLength={TITLE_MAX}
                              aria-invalid={!!(touched.title && titleError)}
                              className={cn(touched.title && titleError && 'border-destructive focus-visible:ring-destructive/30')}
                            />
                            <AnimatePresence>
                              {touched.title && titleError && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="text-[11px] text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />{titleError}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="desc">{t.newTicket.descriptionRequired}</Label>
                              <span className={cn('text-[10px] tabular-nums', descTrim.length > DESC_MAX * 0.9 ? 'text-warning' : 'text-muted-foreground')}>
                                {descTrim.length}/{DESC_MAX}
                              </span>
                            </div>
                            <Textarea
                              id="desc"
                              value={description}
                              onChange={e => setDescription(e.target.value)}
                              onBlur={() => setTouched(s => ({ ...s, description: true }))}
                              placeholder={t.newTicket.descriptionPlaceholder}
                              className={cn('min-h-[140px]', touched.description && descError && 'border-destructive focus-visible:ring-destructive/30')}
                              maxLength={DESC_MAX}
                              aria-invalid={!!(touched.description && descError)}
                            />
                            <AnimatePresence>
                              {touched.description && descError && (
                                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                  className="text-[11px] text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />{descError}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="space-y-2">
                            <Label>{t.newTicket.priorityLabel}</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {priorities.map(p => (
                                <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${priority === p.value ? `${p.color} ring-2 ring-offset-1 ring-current` : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'}`}>
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 1 && (
                        <div className="space-y-5">
                          {title.trim() && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-5 w-5 text-accent" />
                                  <span className="text-sm font-medium">{t.newTicket.aiSuggestion}</span>
                                </div>
                                {!aiSuggestion && (
                                  <Button size="sm" variant="outline" onClick={requestAiSuggestion} disabled={aiLoading} className="gap-1.5">
                                    {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {aiLoading ? t.newTicket.analyzing : t.newTicket.suggestAuto}
                                  </Button>
                                )}
                              </div>
                              <AnimatePresence>
                                {aiSuggestion && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2">
                                    <p className="text-sm text-muted-foreground">{aiSuggestion.reason}</p>
                                    <Button size="sm" onClick={applyAiSuggestion} className="gap-1.5">{t.newTicket.applySuggestion}</Button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}

                          {(systemId || serviceId || categoryId) && (
                            <div className="flex items-center gap-1 text-sm flex-wrap">
                              {selectedSystem && (
                                <button onClick={() => { setSystemId(''); setServiceId(''); setCategoryId(''); }} className="text-primary hover:underline font-medium">{selectedSystem.name}</button>
                              )}
                              {selectedService && (
                                <>
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                                  <button onClick={() => { setServiceId(''); setCategoryId(''); }} className="text-primary hover:underline font-medium">{selectedService.name}</button>
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

                          {!systemId && (
                            <div className="space-y-3">
                              <Label className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{t.newTicket.selectSystem}</Label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {systems.map(sys => {
                                  const style = systemStyles[sys.code] || { icon: '📦', gradient: 'from-gray-500/10 to-gray-600/5 border-gray-500/20' };
                                  return (
                                    <motion.button key={sys.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                      onClick={() => { setSystemId(sys.id); setServiceId(''); setCategoryId(''); setAiSuggestion(null); }}
                                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br ${style.gradient} hover:shadow-md transition-all text-center`}>
                                      <span className="text-2xl">{style.icon}</span>
                                      <span className="text-sm font-semibold text-foreground">{sys.name}</span>
                                      {sys.description && <span className="text-xs text-muted-foreground line-clamp-1">{sys.description}</span>}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {systemId && !serviceId && (
                            <div className="space-y-3">
                              <Label className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />{t.newTicket.selectModule}</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {filteredServices.map(svc => (
                                  <motion.button key={svc.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    onClick={() => { setServiceId(svc.id); setCategoryId(''); }}
                                    className={`flex items-center gap-3 p-3.5 rounded-xl border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Layers className="h-4 w-4 text-primary" /></div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                                      {svc.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{svc.description}</p>}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                                  </motion.button>
                                ))}
                              </div>
                              {filteredServices.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t.newTicket.noServicesAvailable}</p>}
                            </div>
                          )}

                          {serviceId && !categoryId && categories.length > 0 && (
                            <div className="space-y-3">
                              <Label className="flex items-center gap-2"><Monitor className="h-4 w-4 text-primary" />{t.newTicket.selectScreen}</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {categories.map(cat => (
                                  <motion.button key={cat.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    onClick={() => setCategoryId(cat.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0"><Monitor className="h-3.5 w-3.5 text-muted-foreground" /></div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground">{cat.name}</p>
                                      {cat.description && <p className="text-xs text-muted-foreground line-clamp-1">{cat.description}</p>}
                                    </div>
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          )}

                          {serviceId && (categoryId || categories.length === 0) && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                              <p className="text-sm font-semibold text-primary flex items-center gap-2">{t.newTicket.serviceSelected}</p>
                              <div className="flex items-center gap-2 text-sm text-foreground flex-wrap">
                                {selectedSystem && <Badge variant="outline">{selectedSystem.name}</Badge>}
                                {selectedService && <Badge variant="outline">{selectedService.name}</Badge>}
                                {selectedCategory && <Badge variant="outline">{selectedCategory.name}</Badge>}
                              </div>
                            </motion.div>
                          )}

                          {serviceId && !stagePreviewLoading && stagePreview.length === 0 && (
                            <Alert variant="destructive" className="rounded-xl" data-testid="no-approval-stages-alert">
                              <ShieldAlert className="h-4 w-4" />
                              <AlertTitle className="text-sm">
                                {isRTL ? 'لا توجد مراحل اعتماد لهذه الخدمة' : 'No approval stages for this service'}
                              </AlertTitle>
                              <AlertDescription className="text-xs space-y-1.5">
                                <p>
                                  {isRTL
                                    ? 'يمكنك إنشاء التذكرة لكنها لن تمر بأي اعتماد قبل المعالجة.'
                                    : 'You can still create the ticket, but it will not require any approval before processing.'}
                                </p>
                                {isAdmin ? (
                                  <ul className="list-disc ms-4 space-y-0.5 text-[11px]">
                                    <li>
                                      {isRTL
                                        ? 'تحقق من أن للخدمة قسم افتراضي (default_assignment_group) في /admin/services.'
                                        : 'Make sure the service has a default_assignment_group in /admin/services.'}
                                    </li>
                                    <li>
                                      {isRTL
                                        ? 'أضف مرحلة اعتماد جديدة في /admin/approval-stages مرتبطة بالخدمة أو بقسمها.'
                                        : 'Add an approval stage in /admin/approval-stages linked to this service or its department.'}
                                    </li>
                                    <li>
                                      {isRTL
                                        ? 'استخدم زر "اختبار إنشاء تذكرة تجريبية" في صفحة المراحل للتحقق من المطابقة.'
                                        : 'Use the "Test ticket approval creation" button on the stages page to verify matching.'}
                                    </li>
                                  </ul>
                                ) : (
                                  <p className="text-[11px] opacity-80">
                                    {isRTL
                                      ? 'تواصل مع المشرف لإعداد مراحل الاعتماد لهذه الخدمة.'
                                      : 'Please contact your admin to configure approval stages for this service.'}
                                  </p>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}

                          {serviceId && stagePreview.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="rounded-xl border border-primary/30 bg-primary/5 p-4"
                              data-testid="approval-stages-preview"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <ShieldAlert className="h-4 w-4 text-primary" />
                                <p className="text-sm font-bold text-primary">
                                  {isRTL ? 'مراحل الاعتماد التي ستمر بها التذكرة' : 'Approval stages this ticket will go through'}
                                </p>
                                <Badge variant="outline" className="text-[10px] ms-auto">{stagePreview.length}</Badge>
                              </div>
                              <div className="space-y-1.5">
                                {stagePreview.map((s) => (
                                  <div key={s.stage_id} className="flex items-center gap-2 text-xs bg-background/60 rounded-lg px-3 py-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                      {s.stage_order}
                                    </div>
                                    <span className="font-semibold flex-1 truncate">{s.stage_name}</span>
                                    {s.department_name && <Badge variant="secondary" className="text-[9px]">{s.department_name}</Badge>}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {serviceFields.length > 0 && serviceId && (
                            <div className="space-y-4 p-4 rounded-xl border border-dashed bg-muted/20">
                              <p className="text-sm font-semibold text-muted-foreground">{t.newTicket.additionalFields}</p>
                              {serviceFields.map(field => (
                                <div key={field.id} className="space-y-2">
                                  <Label>{field.field_name} {field.is_required && '*'}</Label>
                                  {field.field_type === 'text' && <Input value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} />}
                                  {field.field_type === 'number' && <Input type="number" value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} />}
                                  {field.field_type === 'textarea' && <Textarea value={customFieldValues[field.id] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder={field.field_name} className="min-h-[80px]" />}
                                  {field.field_type === 'select' && (
                                    <Select value={customFieldValues[field.id] || ''} onValueChange={v => setCustomFieldValues(prev => ({ ...prev, [field.id]: v }))}>
                                      <SelectTrigger><SelectValue placeholder={`${t.newTicket.selectFieldPlaceholder} ${field.field_name}`} /></SelectTrigger>
                                      <SelectContent>{(field.options || []).map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {step === 2 && <FileDropZone files={files} onFilesChange={setFiles} />}

                      {step === 3 && (
                        <TicketPreview title={title} description={description} priority={priority} systemId={systemId} serviceId={serviceId} categoryId={categoryId}
                          files={files} customFieldValues={customFieldValues} systems={systems} services={services} categories={categories} serviceFields={serviceFields} />
                      )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-border/60 sticky bottom-0 bg-card/95 backdrop-blur-sm -mx-5 md:-mx-6 px-5 md:px-6 -mb-5 md:-mb-6 pb-5 md:pb-6">
                <Button type="button" variant="ghost" onClick={goPrev} disabled={step === 0} className="gap-1.5">
                  <ArrowLeft className={`h-4 w-4 ${isRTL ? '' : 'rotate-180'}`} />
                  {t.common.previous}
                </Button>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {(title || description) && !hasDraftPrompt && (
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <Save className="h-3 w-3 text-success" />
                      {isRTL ? 'تم حفظ المسودة' : 'Draft saved'}
                    </span>
                  )}
                  <kbd className="hidden md:inline-flex items-center text-[10px] font-mono font-medium text-muted-foreground/80 bg-muted border border-border/60 rounded px-1.5 py-0.5">
                    {isRTL ? '⌘ + Enter' : '⌘/Ctrl + Enter'}
                  </kbd>
                </div>
                {step < 3 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={!canProceed() ? 0 : -1}>
                          <Button type="button" onClick={() => { setTouched({ title: true, description: true }); if (canProceed()) goNext(); }} disabled={!canProceed()} className="gap-1.5">
                            {t.common.next}
                            <ArrowRight className={`h-4 w-4 ${isRTL ? '' : 'rotate-180'}`} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canProceed() && blockReason() && (
                        <TooltipContent side="top" className="text-[11px] max-w-xs">
                          {blockReason()}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button onClick={handleSubmit} disabled={mutation.isPending} className="gap-1.5">
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t.newTicket.submitTicket}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageLayout>
  );
}
