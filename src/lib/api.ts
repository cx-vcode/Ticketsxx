import { supabase } from '@/integrations/supabase/client';

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed' | 'reopened';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NoteType = 'public' | 'private';
export type AppRole = 'admin' | 'agent' | 'requester' | 'developer';
export type SourceSystem = 'PORTAL' | 'ERP' | 'LMS' | 'CPAY';

export interface Ticket {
  id: string;
  ticket_number: number;
  code: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  department_id: string | null;
  requester_id: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_summary: string | null;
  first_response_at: string | null;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  last_activity_at: string;
  source_system: SourceSystem;
  service_id: string | null;
  category_id: string | null;
  external_reference: string | null;
  external_payload: any;
  // Joined
  departments?: { name: string } | null;
  requester?: { full_name: string; email: string } | null;
  agent?: { full_name: string; email: string } | null;
  services?: { name: string; system_id: string; systems?: { code: string; name: string } | null } | null;
  service_categories?: { name: string } | null;
}

export interface System {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  system_id: string;
  name: string;
  description: string | null;
  default_assignment_group: string | null;
  sla_policy_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  systems?: { code: string; name: string } | null;
  departments?: { name: string } | null;
  sla_policies?: { response_time_hours: number; resolution_time_hours: number } | null;
}

export interface ServiceCategory {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SLAPolicy {
  id: string;
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  note_type: NoteType;
  created_at: string;
  author?: { full_name: string; email: string } | null;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface AuditLog {
  id: string;
  ticket_id: string;
  user_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: { full_name: string } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  ticket_id: string | null;
  title: string;
  message: string;
  body?: string | null;
  data?: any;
  is_read: boolean;
  type: string | null;
  created_at: string;
}


export const statusLabels: Record<TicketStatus, string> = {
  new: 'جديدة',
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  waiting_on_customer: 'بانتظار العميل',
  resolved: 'تم الحل',
  closed: 'مغلقة',
  reopened: 'أُعيد فتحها',
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
};

export const sourceSystemLabels: Record<SourceSystem, string> = {
  PORTAL: 'البوابة',
  ERP: 'ERP',
  LMS: 'LMS',
  CPAY: 'CPAY',
};

export const roleLabels: Record<AppRole, string> = {
  admin: 'أدمن',
  agent: 'دعم فني',
  requester: 'عميل',
  developer: 'مطور',
};

// API functions
const TICKET_SELECT = '*, departments(name), requester:profiles!tickets_requester_id_fkey(full_name, email), agent:profiles!tickets_assigned_agent_id_fkey(full_name, email), services(name, system_id, systems(code, name)), service_categories(name)';

export async function fetchTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown) as Ticket[];
}

export async function fetchTicketById(id: string) {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return (data as unknown) as Ticket;
}

export async function createTicket(ticket: { title: string; description: string; priority: TicketPriority; department_id?: string | null; requester_id: string; service_id?: string; category_id?: string; source_system?: SourceSystem; external_reference?: string; external_payload?: any }) {
  const { data, error } = await supabase.from('tickets').insert(ticket).select().single();
  if (error) throw error;
  return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>) {
  const { data, error } = await supabase.from('tickets').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function fetchComments(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_comments')
    .select('*, author:profiles!ticket_comments_author_id_fkey(full_name, email)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown) as TicketComment[];
}

export async function addComment(comment: { ticket_id: string; author_id: string; content: string; note_type: NoteType }) {
  const { data, error } = await supabase.from('ticket_comments').insert(comment).select().single();
  if (error) throw error;
  return data;
}

export async function fetchDepartments() {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error;
  return data as Department[];
}

export async function fetchAuditLogs(ticketId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles!audit_logs_user_id_fkey(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown) as AuditLog[];
}

export async function addAuditLog(log: { ticket_id: string; user_id: string; action: string; old_value?: string; new_value?: string }) {
  const { error } = await supabase.from('audit_logs').insert(log);
  if (error) throw error;
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as Notification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function fetchAgents() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['agent', 'admin', 'developer']);
  if (error) throw error;
  
  // Fetch profiles for these agents
  const userIds = (data || []).map(d => d.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  
  return (data || []).map(d => ({
    ...d,
    profiles: profiles?.find(p => p.id === d.user_id) || null,
  }));
}

export async function fetchTicketStats() {
  const { data, error } = await supabase.from('tickets').select('status');
  if (error) throw error;
  const stats = { total: 0, new: 0, open: 0, in_progress: 0, waiting_on_customer: 0, resolved: 0, closed: 0, reopened: 0 };
  (data || []).forEach((t: any) => {
    stats.total++;
    stats[t.status as keyof typeof stats]++;
  });
  return stats;
}

// SLA
export async function fetchSLAPolicies() {
  const { data, error } = await supabase.from('sla_policies').select('*').order('priority');
  if (error) throw error;
  return (data as unknown) as SLAPolicy[];
}

export async function updateSLAPolicy(id: string, updates: { first_response_minutes?: number; resolution_minutes?: number }) {
  const { data, error } = await supabase.from('sla_policies').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Attachments
export async function fetchAttachments(ticketId: string) {
  const { data, error } = await supabase.from('ticket_attachments').select('*').eq('ticket_id', ticketId).order('created_at');
  if (error) throw error;
  return (data as unknown) as TicketAttachment[];
}

export async function addAttachment(attachment: { ticket_id: string; uploaded_by: string; file_name: string; file_url: string; file_size: number | null; storage_key?: string | null }) {
  const { data, error } = await supabase.from('ticket_attachments').insert(attachment).select().single();
  if (error) throw error;
  return data;
}

// User management
export async function fetchAllUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;

  const { data: roles } = await supabase.from('user_roles').select('*');
  return (data || []).map(p => ({
    ...p,
    role: roles?.find(r => r.user_id === p.id)?.role || 'requester',
    role_id: roles?.find(r => r.user_id === p.id)?.id,
  }));
}

export async function updateUserRole(userId: string, newRole: AppRole) {
  // Check if user already has a role entry
  const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).single();
  if (existing) {
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
    if (error) throw error;
  }
}

// Departments management
export async function createDepartment(dept: { name: string; description?: string }) {
  const { data, error } = await supabase.from('departments').insert(dept).select().single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id: string, updates: { name?: string; description?: string }) {
  const { data, error } = await supabase.from('departments').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDepartment(id: string) {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw error;
}

// Reports
export async function fetchReportData(dateRange?: { from: string; to: string }) {
  let query = supabase.from('tickets').select('ticket_number, title, status, priority, created_at, resolved_at, first_response_at, department_id, departments(name), service_id, services(name, system_id, systems(name)), sla_resolution_due_at');
  
  if (dateRange?.from) {
    query = query.gte('created_at', dateRange.from);
  }
  if (dateRange?.to) {
    query = query.lte('created_at', dateRange.to + 'T23:59:59');
  }
  
  const { data: tickets, error } = await query;
  if (error) throw error;

  const { data: sla } = await supabase.from('sla_policies').select('*');

  const slaMap: Record<string, SLAPolicy> = {};
  (sla || []).forEach((s: any) => { slaMap[s.priority] = s; });

  let totalResolutionMs = 0;
  let resolvedCount = 0;
  let slaBreaches = 0;
  let slaMet = 0;
  let totalFirstResponseMs = 0;
  let firstResponseCount = 0;
  let overdueCount = 0;

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const bySystem: Record<string, number> = {};
  const byService: Record<string, number> = {};
  const slaByService: Record<string, { met: number; breaches: number }> = {};

  const now = Date.now();

  const rawTickets = (tickets || []).map((t: any) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    const deptName = t.departments?.name || 'بدون قسم';
    byDepartment[deptName] = (byDepartment[deptName] || 0) + 1;

    const systemName = t.services?.systems?.name || 'بدون نظام';
    bySystem[systemName] = (bySystem[systemName] || 0) + 1;

    const serviceName = t.services?.name || 'بدون خدمة';
    byService[serviceName] = (byService[serviceName] || 0) + 1;

    let resolutionHours: number | null = null;
    let firstResponseHours: number | null = null;

    if (t.first_response_at) {
      const frMs = new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime();
      totalFirstResponseMs += frMs;
      firstResponseCount++;
      firstResponseHours = Math.round(frMs / (1000 * 60 * 60) * 10) / 10;
    }

    if (t.resolved_at) {
      const resMs = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      totalResolutionMs += resMs;
      resolvedCount++;
      resolutionHours = Math.round(resMs / (1000 * 60 * 60) * 10) / 10;

      const policy = slaMap[t.priority];
      if (policy) {
        if (!slaByService[serviceName]) slaByService[serviceName] = { met: 0, breaches: 0 };
        const resMins = resMs / (1000 * 60);
        if (resMins > policy.resolution_minutes) {
          slaBreaches++;
          slaByService[serviceName].breaches++;
        } else {
          slaMet++;
          slaByService[serviceName].met++;
        }
      }
    }

    // Check overdue
    if (t.sla_resolution_due_at && !t.resolved_at && new Date(t.sla_resolution_due_at).getTime() < now) {
      overdueCount++;
    }

    return {
      ticket_number: t.ticket_number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      department: deptName,
      system: systemName,
      service: serviceName,
      created_at: t.created_at,
      resolved_at: t.resolved_at,
      resolutionHours,
      firstResponseHours,
    };
  });

  const slaByServiceFormatted: Record<string, { compliance: number; breaches: number }> = {};
  Object.entries(slaByService).forEach(([k, v]) => {
    const total = v.met + v.breaches;
    slaByServiceFormatted[k] = { compliance: total > 0 ? Math.round(v.met / total * 100) : 100, breaches: v.breaches };
  });

  return {
    total: (tickets || []).length,
    byStatus,
    byPriority,
    byDepartment,
    bySystem,
    byService,
    slaByService: slaByServiceFormatted,
    avgResolutionHours: resolvedCount > 0 ? Math.round(totalResolutionMs / resolvedCount / (1000 * 60 * 60) * 10) / 10 : 0,
    avgFirstResponseHours: firstResponseCount > 0 ? Math.round(totalFirstResponseMs / firstResponseCount / (1000 * 60 * 60) * 10) / 10 : 0,
    slaBreaches,
    slaMet,
    slaCompliancePercent: (slaMet + slaBreaches) > 0 ? Math.round(slaMet / (slaMet + slaBreaches) * 100) : 100,
    overdueCount,
    rawTickets,
  };
}

// Service Catalog
export async function fetchSystems() {
  const { data, error } = await supabase.from('systems').select('*').eq('is_active', true).order('name');
  if (error) throw error;
  return (data as unknown) as System[];
}

export async function createSystem(sys: { code: string; name: string; description?: string }) {
  const { data, error } = await supabase.from('systems').insert(sys).select().single();
  if (error) throw error;
  return data;
}

export async function updateSystem(id: string, updates: Partial<System>) {
  const { data, error } = await supabase.from('systems').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSystem(id: string) {
  const { error } = await supabase.from('systems').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchServices(systemId?: string) {
  let query = supabase.from('services').select('*, systems(code, name), departments:departments!services_default_assignment_group_fkey(name), sla_policies(first_response_minutes, resolution_minutes)').eq('is_active', true).order('name');
  if (systemId) query = query.eq('system_id', systemId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown) as Service[];
}

export async function createService(svc: { system_id: string; name: string; description?: string; default_assignment_group?: string; sla_policy_id?: string }) {
  const { data, error } = await supabase.from('services').insert(svc).select().single();
  if (error) throw error;
  return data;
}

export async function updateService(id: string, updates: Partial<Service>) {
  const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchServiceCategories(serviceId?: string) {
  let query = supabase.from('service_categories').select('*').eq('is_active', true).order('name');
  if (serviceId) query = query.eq('service_id', serviceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown) as ServiceCategory[];
}

export async function createServiceCategory(cat: { service_id: string; name: string; description?: string }) {
  const { data, error } = await supabase.from('service_categories').insert(cat).select().single();
  if (error) throw error;
  return data;
}

export async function deleteServiceCategory(id: string) {
  const { error } = await supabase.from('service_categories').delete().eq('id', id);
  if (error) throw error;
}

// Service Fields (Form Builder)
export interface ServiceField {
  id: string;
  service_id: string;
  field_name: string;
  field_type: 'text' | 'number' | 'select' | 'textarea';
  options: string[];
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface TicketFieldValue {
  id: string;
  ticket_id: string;
  field_id: string;
  value: string | null;
  created_at: string;
}

export async function fetchServiceFields(serviceId?: string) {
  let query = supabase.from('service_fields').select('*').order('sort_order');
  if (serviceId) query = query.eq('service_id', serviceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown) as ServiceField[];
}

export async function createServiceField(field: { service_id: string; field_name: string; field_type: string; options?: string[]; is_required?: boolean; sort_order?: number }) {
  const { data, error } = await supabase.from('service_fields').insert({
    ...field,
    options: field.options || [],
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateServiceField(id: string, updates: Partial<ServiceField>) {
  const { data, error } = await supabase.from('service_fields').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteServiceField(id: string) {
  const { error } = await supabase.from('service_fields').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTicketFieldValues(ticketId: string) {
  const { data, error } = await supabase.from('ticket_field_values').select('*').eq('ticket_id', ticketId);
  if (error) throw error;
  return (data as unknown) as TicketFieldValue[];
}

export async function upsertTicketFieldValues(values: { ticket_id: string; field_id: string; value: string }[]) {
  if (values.length === 0) return;
  const { error } = await supabase.from('ticket_field_values').upsert(values, { onConflict: 'ticket_id,field_id' });
  if (error) throw error;
}

// Approval Stages & Ticket Approvals
export type ApprovalStageType = 'sequential' | 'parallel';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalSkipRule {
  field: 'priority' | 'department_id' | 'service_id' | 'category_id' | 'source_system';
  operator: 'eq' | 'neq' | 'in' | 'nin';
  value: string | string[];
}
export interface ApprovalConditions {
  skip_if?: ApprovalSkipRule[];
}

export interface ApprovalStage {
  id: string;
  department_id: string;
  stage_name: string;
  stage_order: number;
  stage_type: ApprovalStageType;
  approver_role: AppRole;
  approver_id: string | null;
  service_id: string | null;
  deadline_hours: number | null;
  escalation_to: string | null;
  conditions: ApprovalConditions;
  created_at: string;
  departments?: { name: string } | null;
  services?: { name: string } | null;
  approver_profile?: { full_name: string } | null;
  escalation_profile?: { full_name: string } | null;
}

export interface TicketApproval {
  id: string;
  ticket_id: string;
  stage_id: string;
  approver_id: string | null;
  status: ApprovalStatus;
  notes: string | null;
  decided_at: string | null;
  delegated_to: string | null;
  delegated_at: string | null;
  deadline_at: string | null;
  is_escalated: boolean;
  created_at: string;
  approval_stages?: { stage_name: string; stage_order: number; stage_type: ApprovalStageType; approver_role: AppRole } | null;
  approver?: { full_name: string } | null;
  delegated_profile?: { full_name: string } | null;
}

export async function fetchApprovalStages(departmentId?: string) {
  // Try full embed first (includes related profiles for approver/escalation).
  const fullSelect = '*, departments(name), services(name), approver_profile:profiles!approval_stages_approver_id_fkey(full_name), escalation_profile:profiles!approval_stages_escalation_to_fkey(full_name)';
  let query = supabase.from('approval_stages').select(fullSelect).order('stage_order');
  if (departmentId) query = query.eq('department_id', departmentId);
  const { data, error } = await query;
  if (!error) return (data as unknown) as ApprovalStage[];

  // Fallback: profile FK embed missing/broken — load stages with only safe joins
  // so the list still renders even if profile relationships are unavailable.
  console.warn('[fetchApprovalStages] embed failed, falling back without profile joins:', error.message);
  let fallback = supabase
    .from('approval_stages')
    .select('*, departments(name), services(name)')
    .order('stage_order');
  if (departmentId) fallback = fallback.eq('department_id', departmentId);
  const { data: fbData, error: fbError } = await fallback;
  if (fbError) {
    // Surface the original embed error too for easier debugging.
    const combined = new Error(`${error.message} | fallback: ${fbError.message}`);
    (combined as any).cause = fbError;
    throw combined;
  }
  return (fbData as unknown) as ApprovalStage[];
}

/**
 * Admin-only diagnostic: verifies the FK relationships needed for the approval
 * stages embed work by issuing the same embed query the page uses. Returns a
 * structured result instead of throwing, so the UI can show the exact error.
 */
export async function rebuildApprovalRelationships(): Promise<{
  ok: boolean;
  embedWorks: boolean;
  fallbackWorks: boolean;
  embedError?: string;
  fallbackError?: string;
  stageCount: number;
}> {
  const embedSelect = '*, approver_profile:profiles!approval_stages_approver_id_fkey(full_name), escalation_profile:profiles!approval_stages_escalation_to_fkey(full_name)';
  const embed = await supabase.from('approval_stages').select(embedSelect).limit(1);
  const fallback = await supabase.from('approval_stages').select('id').limit(1);
  return {
    ok: !embed.error && !fallback.error,
    embedWorks: !embed.error,
    fallbackWorks: !fallback.error,
    embedError: embed.error?.message,
    fallbackError: fallback.error?.message,
    stageCount: fallback.data?.length ?? 0,
  };
}

export async function createApprovalStage(stage: {
  department_id: string; stage_name: string; stage_order: number;
  stage_type: ApprovalStageType; approver_role: AppRole;
  approver_id?: string | null; service_id?: string | null;
  deadline_hours?: number | null; escalation_to?: string | null;
}) {
  const { data, error } = await supabase.from('approval_stages').insert(stage).select().single();
  if (error) throw error;
  return data;
}

export async function updateApprovalStage(id: string, updates: Partial<ApprovalStage>) {
  const { data, error } = await supabase.from('approval_stages').update(updates as any).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteApprovalStage(id: string) {
  const { error } = await supabase.from('approval_stages').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTicketApprovals(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_approvals')
    .select('*, approval_stages(stage_name, stage_order, stage_type, approver_role), approver:profiles!ticket_approvals_approver_id_fkey(full_name), delegated_profile:profiles!ticket_approvals_delegated_to_fkey(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at');
  if (error) throw error;
  return (data as unknown) as TicketApproval[];
}

export async function updateTicketApproval(id: string, updates: { status: ApprovalStatus; approver_id: string; notes?: string }) {
  const { data, error } = await supabase
    .from('ticket_approvals')
    .update({ ...updates, decided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function delegateApproval(id: string, delegatedTo: string, delegatedBy: string) {
  const { data, error } = await supabase
    .from('ticket_approvals')
    .update({ delegated_to: delegatedTo, delegated_at: new Date().toISOString(), approver_id: delegatedBy })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Bulk update multiple approvals at once. Only `pending` rows are eligible
 * for transition; the SQL filter ensures we never overwrite decided rows.
 * Returns the number of rows actually updated.
 */
export async function bulkUpdateApprovals(
  ids: string[],
  status: Exclude<ApprovalStatus, 'pending'>,
  approverId: string,
  notes?: string,
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const { data, error } = await supabase
    .from('ticket_approvals')
    .update({
      status,
      approver_id: approverId,
      decided_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');
  if (error) throw error;
  return { updated: data?.length ?? 0 };
}

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  pending: 'في الانتظار',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

// === Approval Coverage Diagnostics ===
export interface ServiceWithoutCoverage {
  service_id: string;
  service_name: string;
  system_name: string | null;
  active_tickets_count: number;
}

export interface TicketMissingApprovals {
  ticket_id: string;
  ticket_number: number;
  ticket_title: string;
  service_name: string | null;
  expected_stages_count: number;
}

export async function fetchServicesWithoutApprovalCoverage(): Promise<ServiceWithoutCoverage[]> {
  const { data, error } = await supabase.rpc('services_without_approval_coverage');
  if (error) throw error;
  return (data || []) as ServiceWithoutCoverage[];
}

export async function fetchTicketsMissingApprovals(): Promise<TicketMissingApprovals[]> {
  const { data, error } = await supabase.rpc('tickets_missing_approvals');
  if (error) throw error;
  return (data || []) as TicketMissingApprovals[];
}

export async function backfillTicketApprovals(ticketId: string): Promise<{ inserted_count: number; matched_stages: number }> {
  const { data, error } = await supabase.rpc('backfill_ticket_approvals', { _ticket_id: ticketId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { inserted_count: number; matched_stages: number };
}

export async function backfillAllMissingApprovals(): Promise<{ processed: number; total_inserted: number }> {
  const tickets = await fetchTicketsMissingApprovals();
  let totalInserted = 0;
  for (const t of tickets) {
    try {
      const result = await backfillTicketApprovals(t.ticket_id);
      totalInserted += result.inserted_count;
    } catch (e) {
      console.warn(`Failed to backfill ticket ${t.ticket_number}`, e);
    }
  }
  return { processed: tickets.length, total_inserted: totalInserted };
}

// === Approval matching diagnostics (per-service / per-ticket) ===
export interface StagePreviewRow {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  match_reason: 'service_match' | 'department_match' | 'system_match' | 'other';
  department_id: string | null;
  department_name: string | null;
}

export async function previewApprovalStagesForService(serviceId: string): Promise<StagePreviewRow[]> {
  const { data, error } = await supabase.rpc('preview_approval_stages_for_service', { _service_id: serviceId });
  if (error) throw error;
  return (data || []) as StagePreviewRow[];
}

export interface MatchedStageInfo {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  match_reason: string;
  will_skip: boolean;
}

export interface TicketApprovalDiagnostics {
  ticket_id: string;
  ticket_number: number;
  ticket_title: string;
  service_id: string | null;
  service_name: string | null;
  department_id: string | null;
  derived_department_id: string | null;
  system_id: string | null;
  service_has_default_group: boolean;
  existing_approvals_count: number;
  service_match_count: number;
  department_match_count: number;
  system_match_count: number;
  skipped_by_conditions_count: number;
  total_potential_matches: number;
  matched_stages: MatchedStageInfo[];
  error?: string;
}

export async function diagnoseTicketApprovals(ticketId: string): Promise<TicketApprovalDiagnostics> {
  const { data, error } = await supabase.rpc('diagnose_ticket_approvals', { _ticket_id: ticketId });
  if (error) throw error;
  return data as unknown as TicketApprovalDiagnostics;
}

export async function findTicketByNumber(ticketNumber: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('find_ticket_by_number', { _ticket_number: ticketNumber });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export interface TestTicketResult {
  service_id: string;
  service_name: string;
  department_id: string | null;
  approvals_created: number;
  stages: { stage_name: string; stage_order: number; status: string }[];
  success: boolean;
}

export async function testTicketApprovalCreation(
  serviceId: string,
  departmentId?: string | null,
): Promise<TestTicketResult> {
  const { data, error } = await supabase.rpc('test_ticket_approval_creation', {
    _service_id: serviceId,
    _department_id: departmentId ?? null,
  });
  if (error) throw error;
  return data as unknown as TestTicketResult;
}

export interface ServiceMissingGroup {
  service_id: string;
  service_name: string;
  system_name: string | null;
  active_tickets_count: number;
}

export async function fetchServicesWithoutAssignmentGroup(): Promise<ServiceMissingGroup[]> {
  const { data, error } = await supabase.rpc('services_without_assignment_group');
  if (error) throw error;
  return (data || []) as ServiceMissingGroup[];
}

// === Approval Health Overview ===
export interface ApprovalHealthOverview {
  services_total: number;
  services_no_assignment_group: number;
  services_no_approval_coverage: number;
  departments_total: number;
  departments_no_stages: number;
  tickets_pending_without_approvals: number;
  stages_total: number;
  avg_stages_per_department: number;
  health_score: number;
}

export async function fetchApprovalHealthOverview(): Promise<ApprovalHealthOverview> {
  const { data, error } = await supabase.rpc('approval_health_overview' as any);
  if (error) throw error;
  return data as unknown as ApprovalHealthOverview;
}

// === Approval Templates ===
export interface ApprovalTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  stages: any;
  is_system: boolean;
  created_at: string;
}

export async function fetchApprovalTemplates(): Promise<ApprovalTemplate[]> {
  const { data, error } = await supabase.from('approval_templates' as any).select('*').order('is_system', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as ApprovalTemplate[];
}

export async function applyApprovalTemplate(
  templateId: string,
  serviceId: string,
  departmentId: string,
): Promise<{ inserted_stages: number; service_id: string }> {
  const { data, error } = await supabase.rpc('apply_approval_template' as any, {
    _template_id: templateId,
    _service_id: serviceId,
    _department_id: departmentId,
  });
  if (error) throw error;
  return data as unknown as { inserted_stages: number; service_id: string };
}

// === Preview prospective ticket stages ===
export interface ProspectiveStagePreview {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  stage_type: string;
  deadline_hours: number | null;
  department_id: string | null;
  department_name: string | null;
  match_reason: string;
}

export async function previewApprovalStagesForProspective(
  serviceId: string,
  departmentId?: string | null,
  priority?: string,
): Promise<ProspectiveStagePreview[]> {
  const { data, error } = await supabase.rpc('preview_approval_stages_for_prospective_ticket' as any, {
    _service_id: serviceId,
    _department_id: departmentId ?? null,
    _priority: priority ?? 'medium',
  });
  if (error) throw error;
  return (data || []) as unknown as ProspectiveStagePreview[];
}

// === Coverage by service ===
export interface ServiceCoverageRow {
  service_id: string;
  service_name: string;
  system_name: string | null;
  has_default_group: boolean;
  stages_count: number;
  active_tickets: number;
}

export async function fetchApprovalCoverageByService(): Promise<ServiceCoverageRow[]> {
  const { data, error } = await supabase.rpc('approval_coverage_by_service' as any);
  if (error) throw error;
  return (data || []) as ServiceCoverageRow[];
}

// Ticket Ratings
export interface TicketRating {
  id: string;
  ticket_id: string;
  user_id: string;
  rating: number;
  feedback: string | null;
  created_at: string;
}

export async function fetchTicketRating(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_ratings')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle();
  if (error) throw error;
  return data as TicketRating | null;
}

export async function submitTicketRating(rating: { ticket_id: string; user_id: string; rating: number; feedback?: string }) {
  const { data, error } = await supabase.from('ticket_ratings').insert(rating).select().single();
  if (error) throw error;
  return data;
}

export async function fetchMyRatings(userId: string) {
  const { data, error } = await supabase
    .from('ticket_ratings')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []) as TicketRating[];
}
