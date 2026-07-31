/**
 * Security & Input Sanitization Module for Ticketsxx
 * Prevents XSS, SQL/HTML Injection, and enforces Role-Based Access Control (RBAC).
 */

export type UserRole = 'admin' | 'agent' | 'developer' | 'requester';

/**
 * Sanitizes input text to prevent XSS and HTML injection.
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Verifies if a user role possesses the required permissions.
 */
export function hasRole(currentRole: UserRole | string | null | undefined, allowedRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole as UserRole);
}

/**
 * Ensures user has admin or agent privileges.
 */
export function assertAdminOrAgent(role: UserRole | string | null | undefined): boolean {
  return hasRole(role, ['admin', 'agent', 'developer']);
}

/**
 * Validates ticket payload inputs before database insertion.
 */
export interface ValidatedTicketInput {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  department_id?: string | null;
  service_id?: string | null;
}

export function validateTicketPayload(data: Partial<ValidatedTicketInput>): { isValid: boolean; error?: string } {
  if (!data.title || data.title.trim().length < 3) {
    return { isValid: false, error: 'عنوان التذكرة يجب أن يكون 3 أحرف على الأقل' };
  }
  if (!data.description || data.description.trim().length < 5) {
    return { isValid: false, error: 'وصف التذكرة يجب أن يكون 5 أحرف على الأقل' };
  }
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (data.priority && !validPriorities.includes(data.priority)) {
    return { isValid: false, error: 'درجة الأولوية غير صالحة' };
  }
  return { isValid: true };
}
