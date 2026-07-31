import { useLanguage } from '@/i18n';
import type { TicketStatus, TicketPriority, AppRole } from '@/lib/api';

export function useLocalizedLabels() {
  const { t } = useLanguage();

  const statusLabels: Record<TicketStatus, string> = {
    new: t.tickets.new,
    open: t.tickets.open,
    in_progress: t.tickets.inProgress,
    waiting_on_customer: t.tickets.waitingOnCustomer,
    resolved: t.tickets.resolved,
    closed: t.tickets.closed,
    reopened: t.tickets.reopened,
  };

  const priorityLabels: Record<TicketPriority, string> = {
    low: t.tickets.priority.low,
    medium: t.tickets.priority.medium,
    high: t.tickets.priority.high,
    urgent: t.tickets.priority.urgent,
  };

  const roleLabels: Record<AppRole, string> = {
    admin: t.roleLabels.admin,
    agent: t.roleLabels.agent,
    requester: t.roleLabels.requester,
    developer: t.roleLabels.developer,
  };

  return { statusLabels, priorityLabels, roleLabels };
}
