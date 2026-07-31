import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTicketById, fetchComments, addComment, updateTicket, fetchAuditLogs, addAuditLog, fetchAgents, fetchAttachments, addAttachment, fetchServices, fetchServiceCategories, fetchTicketFieldValues, fetchServiceFields, TicketStatus, TicketPriority, NoteType } from '@/lib/api';
import { ApprovalPanel } from '@/components/ApprovalPanel';
import { fetchTicketApprovals } from '@/lib/api';
import { sanitizeError } from '@/lib/errorHandler';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { openAttachment } from '@/lib/attachments';
import { PageLayout, PageHeader } from '@/components/layout';
import { StatusBadge, PriorityBadge } from '@/components/TicketBadges';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, User, Clock, Tag, MessageCircle, Send, Loader2, History, Lock, Globe, RotateCcw, Paperclip, FileText, ShieldCheck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { TicketDetailSkeleton } from '@/components/SkeletonLoaders';
import { AiChatPanel } from '@/components/AiChatPanel';
import { AiSuggestions } from '@/components/AiSuggestions';
import { AiReplySuggestions } from '@/components/AiReplySuggestions';
import { CSATWidget } from '@/components/CSATWidget';
import { TicketPDFExport } from '@/components/TicketPDFExport';
import { CannedResponsesPicker } from '@/components/CannedResponses';
import { TimeTracker } from '@/components/TimeTracker';
import { SentimentAnalysis } from '@/components/SentimentBadge';
import { TicketSummary } from '@/components/TicketSummary';
import { TicketAICopilot } from '@/components/TicketAICopilot';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { EmptyState, ErrorState } from '@/components/common';

const allStatuses: TicketStatus[] = ['new', 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'reopened'];
const allPriorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, lang, isRTL } = useLanguage();
  const { statusLabels, priorityLabels } = useLocalizedLabels();
  const dateLocale = lang === 'ar' ? ar : enUS;

  const [reply, setReply] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicketById(id!),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id!),
    enabled: !!id,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', id],
    queryFn: () => fetchAuditLogs(id!),
    enabled: !!id && (role === 'agent' || role === 'admin' || role === 'developer'),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled: role === 'agent' || role === 'admin' || role === 'developer',
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', id],
    queryFn: () => fetchAttachments(id!),
    enabled: !!id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServices(),
    enabled: role === 'agent' || role === 'admin' || role === 'developer',
  });

  const { data: fieldValues = [] } = useQuery({
    queryKey: ['ticket-field-values', id],
    queryFn: () => fetchTicketFieldValues(id!),
    enabled: !!id,
  });

  const { data: serviceFields = [] } = useQuery({
    queryKey: ['service-fields', ticket?.service_id],
    queryFn: () => fetchServiceFields(ticket?.service_id || undefined),
    enabled: !!ticket?.service_id,
  });

  const { data: approvalsData = [] } = useQuery({
    queryKey: ['ticket-approvals', id],
    queryFn: () => fetchTicketApprovals(id!),
    enabled: !!id,
  });

  const pendingApprovals = approvalsData.filter(a => a.status === 'pending').length;

  // Realtime: all ticket-related changes in a single channel
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ticket-all-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['comments', id] });
        setTimeout(() => {
          const el = document.getElementById('comments-scroll');
          if (el) el.scrollTop = el.scrollHeight;
        }, 300);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_attachments', filter: `ticket_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['attachments', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const commentMutation = useMutation({
    mutationFn: () => addComment({
      ticket_id: id!,
      author_id: user!.id,
      content: reply.trim(),
      note_type: isPrivate ? 'private' : 'public',
    }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      toast({ title: t.tickets.commentAdded });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, summary }: { newStatus: TicketStatus; summary?: string }) => {
      const oldStatus = ticket!.status;
      await updateTicket(id!, {
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString(), resolution_summary: summary || null } : {}),
        ...(newStatus === 'closed' ? { closed_at: new Date().toISOString(), resolution_summary: summary || ticket!.resolution_summary || null } : {}),
        ...(newStatus === 'reopened' ? { resolved_at: null, closed_at: null } : {}),
      } as any);
      await addAuditLog({
        ticket_id: id!,
        user_id: user!.id,
        action: t.tickets.statusChangeAction,
        old_value: statusLabels[oldStatus],
        new_value: statusLabels[newStatus],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
      setShowResolveDialog(false);
      setResolutionSummary('');
      setPendingStatus(null);
      toast({ title: t.tickets.statusUpdated });
    },
  });

  const handleStatusChange = (newStatus: TicketStatus) => {
    if (newStatus === 'resolved' || newStatus === 'closed') {
      setPendingStatus(newStatus);
      setShowResolveDialog(true);
    } else {
      statusMutation.mutate({ newStatus });
    }
  };

  const handleReopen = () => {
    statusMutation.mutate({ newStatus: 'reopened' });
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'];

  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_FILE_SIZE) throw new Error(t.tickets.fileSizeExceeded);
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error(t.tickets.fileTypeNotAllowed);
      const filePath = `${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      // We no longer persist a long-lived signed URL. Store only the storage key
      // and generate a fresh short-lived signed URL on demand at view time.
      await addAttachment({
        ticket_id: id!,
        uploaded_by: user!.id,
        file_name: file.name,
        file_url: '',
        storage_key: filePath,
        file_size: file.size,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', id] });
      toast({ title: t.tickets.fileUploaded });
    },
    onError: (err: any) => {
      toast({ title: t.tickets.fileUploadError, description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await updateTicket(id!, { assigned_agent_id: agentId });
      const agentName = agents.find((a: any) => a.user_id === agentId)?.profiles?.full_name || agentId;
      await addAuditLog({
        ticket_id: id!,
        user_id: user!.id,
        action: t.tickets.assignAction,
        new_value: agentName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      toast({ title: t.tickets.agentAssigned });
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async (newPriority: TicketPriority) => {
      const oldPriority = ticket!.priority;
      await updateTicket(id!, { priority: newPriority } as any);
      await addAuditLog({
        ticket_id: id!,
        user_id: user!.id,
        action: t.tickets.priorityChangeAction,
        old_value: priorityLabels[oldPriority],
        new_value: priorityLabels[newPriority],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: t.tickets.priorityUpdated });
    },
  });

  const serviceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const svc = services.find(s => s.id === serviceId);
      await updateTicket(id!, { service_id: serviceId } as any);
      await addAuditLog({
        ticket_id: id!,
        user_id: user!.id,
        action: t.tickets.serviceChangeAction,
        new_value: svc?.name || serviceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      toast({ title: t.tickets.serviceUpdated });
    },
  });

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader title={t.tickets.ticketLabel} />
        <main className="flex-1 overflow-auto">
          <TicketDetailSkeleton />
        </main>
      </PageLayout>
    );
  }

  if (isError) {
    return (
      <PageLayout>
        <PageHeader title={t.tickets.ticketLabel} />
        <main className="flex-1 overflow-auto">
          <ErrorState onRetry={() => refetch()} />
        </main>
      </PageLayout>
    );
  }

  if (!ticket) {
    return (
      <PageLayout>
        <PageHeader title={t.tickets.ticketLabel} />
        <main className="flex-1 overflow-auto">
          <EmptyState
            icon={FileText}
            title={lang === 'ar' ? 'التذكرة غير موجودة' : 'Ticket not found'}
            description={lang === 'ar' ? 'قد تكون التذكرة محذوفة أو لا تملك صلاحية الوصول.' : 'It may have been deleted or you don’t have access.'}
            action={
              <Button onClick={() => navigate('/tickets')} variant="outline">
                {lang === 'ar' ? 'العودة للتذاكر' : 'Back to inbox'}
              </Button>
            }
          />
        </main>
      </PageLayout>
    );
  }

  const isAgentOrAdmin = role === 'agent' || role === 'admin' || role === 'developer';

  const backButton = (
    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
      <ArrowRight className="h-5 w-5" />
    </Button>
  );

  return (
    <PageLayout>
      <PageHeader
        title={`${t.tickets.ticketLabel} ${ticket.code || `#${ticket.ticket_number}`}`}
        actions={backButton}
      />

          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            <motion.div
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              className="max-w-6xl mx-auto space-y-4"
            >
              {/* Approval panel — unified stepper + actions */}
              {approvalsData.length > 0 && (
                <motion.div variants={fadeUp}>
                  <ApprovalPanel ticketId={ticket.id} ticketStatus={ticket.status} />
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-4 lg:space-y-6">
                <motion.div variants={fadeUp}>
                  <Card className="group rounded-xl border-border/50 shadow-sm overflow-hidden">
                    <CardHeader>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        {ticket.departments?.name && (
                          <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">{ticket.departments.name}</span>
                        )}
                        {isAgentOrAdmin && (
                          <SentimentAnalysis
                            title={ticket.title}
                            description={ticket.description}
                            comments={comments.filter(c => c.note_type === 'public').map(c => c.content)}
                          />
                        )}
                      </div>
                      <CardTitle className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">{ticket.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

                      {ticket.resolution_summary && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 rounded-xl bg-success/10 border border-success/20"
                        >
                          <p className="text-xs font-semibold text-success mb-1">{t.tickets.resolutionSummary}</p>
                          <p className="text-sm">{ticket.resolution_summary}</p>
                        </motion.div>
                      )}

                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">{t.tickets.detail.attachments}</p>
                          <div className="flex flex-wrap gap-2">
                            {attachments.map(att => (
                              <motion.button
                                key={att.id}
                                type="button"
                                onClick={() => openAttachment(att)}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-1.5 text-xs bg-muted px-3 py-2 rounded-xl hover:bg-muted/80 transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {att.file_name}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) fileUploadMutation.mutate(file);
                          e.target.value = '';
                        }} />
                        <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={fileUploadMutation.isPending}>
                          {fileUploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                           {t.tickets.attachFile}
                        </Button>
                        <TicketPDFExport ticket={ticket} comments={comments} attachments={attachments} />
                        {!isAgentOrAdmin && (ticket.status === 'resolved' || ticket.status === 'closed') && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={handleReopen} disabled={statusMutation.isPending}>
                             <RotateCcw className="h-3 w-3" />
                             {t.tickets.reopen}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* AI Suggestions for agents */}
                {isAgentOrAdmin && (
                  <motion.div variants={fadeUp}>
                    <AiSuggestions ticketId={ticket.id} />
                  </motion.div>
                )}

                {/* Comments */}
                <motion.div variants={fadeUp}>
                  <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
                    <Tabs defaultValue="comments" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                        <TabsList className="rounded-md bg-transparent h-auto p-0 gap-0 border-0">
                          <TabsTrigger value="comments" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {t.tickets.conversation}
                            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full ms-0.5 tabular-nums">{comments.length}</span>
                          </TabsTrigger>
                          {approvalsData.length > 0 && (
                            <TabsTrigger value="approvals" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {lang === 'ar' ? 'الاعتمادات' : 'Approvals'}
                              {pendingApprovals > 0 && (
                                <span className="bg-warning/15 text-warning text-[10px] px-1.5 py-0.5 rounded-full ms-0.5 tabular-nums">{pendingApprovals}</span>
                              )}
                            </TabsTrigger>
                          )}
                          {isAgentOrAdmin && (
                            <TabsTrigger value="audit" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium">
                              <History className="h-3.5 w-3.5" />
                              {t.tickets.auditLog}
                            </TabsTrigger>
                          )}
                        </TabsList>
                      </CardHeader>
                      <CardContent>
                        <TabsContent value="comments" className="mt-0">
                          {/* Chat-style messages */}
                          <div className="space-y-3 mb-6 max-h-[400px] overflow-auto" id="comments-scroll">
                            {comments.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">{t.tickets.noMessages}</p>
                            ) : (
                              comments.map((c, i) => {
                                const isMe = c.author_id === user?.id;
                                return (
                                  <motion.div
                                    key={c.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03, duration: 0.3 }}
                                    className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                                  >
                                    <div className={`max-w-[80%] rounded-2xl p-3 ${
                                      c.note_type === 'private'
                                        ? 'bg-warning/5 border border-warning/20'
                                        : isMe
                                          ? 'bg-primary/10 border border-primary/10'
                                          : 'bg-muted/50'
                                    }`}>
                                      <div className="flex items-center justify-between gap-3 mb-1">
                                        <span className="text-xs font-semibold">{c.author?.full_name}</span>
                                        <div className="flex items-center gap-1">
                                          {c.note_type === 'private' && (
                                            <span className="text-[9px] bg-warning/20 text-warning px-1 py-0.5 rounded flex items-center gap-0.5">
                                              <Lock className="h-2 w-2" />
                                              {t.tickets.private}
                                            </span>
                                          )}
                                          <span className="text-[10px] text-muted-foreground">
                                            {format(new Date(c.created_at), 'HH:mm', { locale: dateLocale })}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                                    </div>
                                  </motion.div>
                                );
                              })
                            )}
                          </div>

                          {/* Reply Input */}
                          <div className="space-y-3 border-t pt-4">
                            <Textarea
                              placeholder={t.tickets.writeMessage}
                              value={reply}
                              onChange={e => setReply(e.target.value)}
                              className="min-h-[80px] resize-none rounded-xl"
                              maxLength={2000}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                                  e.preventDefault();
                                  commentMutation.mutate();
                                }
                              }}
                            />
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                {isAgentOrAdmin && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                                      <Label htmlFor="private" className="text-xs flex items-center gap-1">
                                        {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                                        {isPrivate ? t.tickets.private : t.tickets.public}
                                      </Label>
                                    </div>
                                    <CannedResponsesPicker onSelect={(content) => setReply(prev => prev ? prev + '\n' + content : content)} />
                                  </>
                                )}
                              </div>
                              {isAgentOrAdmin && (
                                <AiReplySuggestions ticketId={ticket.id} onSelectReply={(text) => setReply(text)} />
                              )}
                              <Button
                                className="gradient-accent text-accent-foreground gap-2 rounded-xl shadow-lg shadow-primary/20"
                                disabled={!reply.trim() || commentMutation.isPending}
                                onClick={() => commentMutation.mutate()}
                              >
                                {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {t.tickets.send}
                              </Button>
                            </div>
                          </div>
                        </TabsContent>

                        {approvalsData.length > 0 && (
                          <TabsContent value="approvals" className="mt-0">
                            <ApprovalPanel ticketId={ticket.id} ticketStatus={ticket.status} />
                          </TabsContent>
                        )}

                        {isAgentOrAdmin && (
                          <TabsContent value="audit" className="mt-0">
                            {auditLogs.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">{t.tickets.noAuditLog}</p>
                            ) : (
                              <div className="space-y-3">
                                {auditLogs.map((log, i) => (
                                  <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04, duration: 0.3 }}
                                    className="flex items-start gap-3 text-sm"
                                  >
                                    <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <div>
                                      <p>
                                        <span className="font-medium">{log.user?.full_name}</span>
                                        {' '}{t.tickets.performed}{' '}
                                        <span className="font-medium">{log.action}</span>
                                        {log.old_value && <> {t.tickets.fromLabel} <span className="text-muted-foreground">{log.old_value}</span></>}
                                        {log.new_value && <> {t.tickets.toLabel} <span className="font-medium text-primary">{log.new_value}</span></>}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: dateLocale })}
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                        )}
                      </CardContent>
                    </Tabs>
                  </Card>
                </motion.div>
              </div>

              {/* Sidebar - Properties Panel */}
              <div className="space-y-4">
                {/* Service Catalog Info */}
                <motion.div variants={fadeScale}>
                  <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                    <CardHeader className="pb-2 border-b border-border/40">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        {t.tickets.serviceCatalog}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-xl bg-muted/50 p-3 space-y-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{t.tickets.systemLabel}</p>
                          <p className="font-medium text-foreground">
                            {ticket.services?.systems?.name || <span className="text-muted-foreground">—</span>}
                          </p>
                        </div>
                        <Separator className="bg-border/50" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{t.tickets.moduleLabel}</p>
                          <p className="font-medium text-foreground">
                            {ticket.services?.name || <span className="text-muted-foreground">—</span>}
                          </p>
                        </div>
                        <Separator className="bg-border/50" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{t.tickets.screenLabel}</p>
                          <p className="font-medium text-foreground">
                            {ticket.service_categories?.name || <span className="text-muted-foreground">—</span>}
                          </p>
                        </div>
                      </div>
                      {ticket.source_system && ticket.source_system !== 'PORTAL' && (
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{t.tickets.sourceLabel}</p>
                          <p className="font-medium">{ticket.source_system}</p>
                          {ticket.external_reference && <p className="text-xs text-muted-foreground mt-0.5">{t.tickets.referenceLabel}: {ticket.external_reference}</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Ticket Meta Info */}
                <motion.div variants={fadeScale}>
                  <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                    <CardHeader className="pb-2 border-b border-border/40"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{t.tickets.ticketInfo}</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.tickets.requester}</p>
                          <p className="font-medium">{ticket.requester?.full_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.tickets.handler}</p>
                          <p className="font-medium">{ticket.agent?.full_name || t.tickets.notAssigned}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.tickets.createdAt}</p>
                          <p className="font-medium">{format(new Date(ticket.created_at), 'd MMM yyyy, HH:mm', { locale: dateLocale })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.tickets.department}</p>
                          <p className="font-medium">{ticket.departments?.name || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Approval panel is shown above the main content; no sidebar duplicate */}

                {/* CSAT Rating */}
                <CSATWidget ticketId={ticket.id} ticketStatus={ticket.status} requesterId={ticket.requester_id} />

                {/* AI Copilot - for agents/admins */}
                {isAgentOrAdmin && (
                  <motion.div variants={fadeScale}>
                    <TicketAICopilot
                      ticketId={ticket.id}
                      ticketTitle={ticket.title}
                      ticketDescription={ticket.description}
                      ticketStatus={ticket.status}
                      comments={comments}
                    />
                  </motion.div>
                )}

                {/* AI Ticket Summary - for agents/admins */}
                {isAgentOrAdmin && (
                  <motion.div variants={fadeScale}>
                    <TicketSummary ticketId={ticket.id} />
                  </motion.div>
                )}

                {/* Time Tracker - for agents/admins */}
                {isAgentOrAdmin && (
                  <motion.div variants={fadeScale}>
                    <TimeTracker ticketId={ticket.id} />
                  </motion.div>
                )}

                {/* Actions for agents/admins */}
                {isAgentOrAdmin && (
                  <>
                    <motion.div variants={fadeScale}>
                      <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                        <CardHeader className="border-b border-border/40"><CardTitle className="text-sm font-semibold">{t.tickets.actions}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs">{t.tickets.changeStatus}</Label>
                            <Select value={ticket.status} onValueChange={(v) => handleStatusChange(v as TicketStatus)}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {allStatuses.map(s => (
                                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t.tickets.assignAgent}</Label>
                            <Select value={ticket.assigned_agent_id || ''} onValueChange={v => assignMutation.mutate(v)}>
                              <SelectTrigger className="rounded-xl"><SelectValue placeholder={t.tickets.selectAgent} /></SelectTrigger>
                              <SelectContent>
                                {agents.map((a: any) => (
                                  <SelectItem key={a.user_id} value={a.user_id}>
                                    {a.profiles?.full_name || a.user_id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t.tickets.changePriority}</Label>
                            <Select value={ticket.priority} onValueChange={(v) => priorityMutation.mutate(v as TicketPriority)}>
                              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {allPriorities.map(p => (
                                  <SelectItem key={p} value={p}>{priorityLabels[p]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t.tickets.changeService}</Label>
                            <Select value={ticket.service_id || ''} onValueChange={v => serviceMutation.mutate(v)}>
                              <SelectTrigger className="rounded-xl"><SelectValue placeholder={t.tickets.selectService} /></SelectTrigger>
                              <SelectContent>
                                {services.map(s => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.systems?.name} → {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {serviceFields.length > 0 && (
                      <motion.div variants={fadeScale}>
                        <Card className="rounded-2xl border-border/50 shadow-card">
                          <CardHeader><CardTitle className="text-sm">{t.tickets.customFields}</CardTitle></CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            {serviceFields.map(f => {
                              const val = fieldValues.find(v => v.field_id === f.id);
                              return (
                                <div key={f.id}>
                                  <p className="text-xs text-muted-foreground">{f.field_name}</p>
                                  <p className="font-medium">{val?.value || '-'}</p>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
              </div>
            </motion.div>
          </main>

      {/* AI Chat Panel */}
      <AiChatPanel ticketId={ticket.id} ticketTitle={ticket.title} />

      {/* Resolution Summary Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{pendingStatus === 'resolved' ? t.tickets.resolveTicket : t.tickets.closeTicket}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.tickets.resolutionSummaryLabel}</Label>
              <Textarea
                value={resolutionSummary}
                onChange={e => setResolutionSummary(e.target.value)}
                placeholder={t.tickets.resolutionPlaceholder}
                className="min-h-[100px] rounded-xl"
              />
            </div>
            <Button
              className="w-full gradient-accent text-accent-foreground rounded-xl"
              disabled={statusMutation.isPending}
              onClick={() => {
                if (pendingStatus) {
                  statusMutation.mutate({ newStatus: pendingStatus, summary: resolutionSummary.trim() });
                }
              }}
            >
              {statusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {t.common.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
