/**
 * Error sanitization utility - prevents internal database/system details
 * from being exposed to end users in toast messages.
 */

import { getRuntimeLanguage, type RuntimeLanguage } from '@/i18n/runtime';

type Mapping = { test: (msg: string, code?: string) => boolean; message: string };

type Lang = RuntimeLanguage;

const ERROR_MAP: Record<Lang, Mapping[]> = {
  ar: [
    { test: (_, code) => code === 'PGRST116', message: 'لم يتم العثور على السجل المطلوب' },
    { test: (_, code) => code === '23505', message: 'هذا السجل موجود بالفعل' },
    { test: (_, code) => code === '23503', message: 'لا يمكن إتمام العملية - توجد بيانات مرتبطة' },
    { test: (_, code) => code === '42501', message: 'ليس لديك صلاحية للقيام بهذا الإجراء' },
    { test: (msg) => /row.level security/i.test(msg), message: 'ليس لديك صلاحية للقيام بهذا الإجراء' },
    { test: (msg) => /foreign key/i.test(msg), message: 'لا يمكن إتمام العملية - توجد بيانات مرتبطة' },
    { test: (msg) => /unique.*constraint|duplicate key/i.test(msg), message: 'هذا السجل موجود بالفعل' },
    { test: (msg) => /not.null|null value/i.test(msg), message: 'يرجى ملء جميع الحقول المطلوبة' },
    { test: (msg) => /invalid.*password|incorrect.*password/i.test(msg), message: 'كلمة المرور غير صحيحة' },
    { test: (msg) => /invalid.*credentials|invalid login/i.test(msg), message: 'بيانات الدخول غير صحيحة' },
    { test: (msg) => /email.*already.*registered|already.*registered/i.test(msg), message: 'البريد الإلكتروني مسجل مسبقاً' },
    { test: (msg) => /email.*not.*confirmed/i.test(msg), message: 'يرجى تأكيد بريدك الإلكتروني أولاً' },
    { test: (msg) => /rate.limit|too many/i.test(msg), message: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً' },
    { test: (msg) => /network|fetch|timeout|abort/i.test(msg), message: 'خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً' },
    // Client-side validation messages (Arabic/English) pass through as-is
    { test: (msg) => /حجم الملف|نوع الملف|الحقل مطلوب/i.test(msg) || /file size|file type|required field/i.test(msg), message: '' },
  ],
  en: [
    { test: (_, code) => code === 'PGRST116', message: 'Record not found' },
    { test: (_, code) => code === '23505', message: 'This record already exists' },
    { test: (_, code) => code === '23503', message: 'Cannot complete operation — related data exists' },
    { test: (_, code) => code === '42501', message: 'You do not have permission to perform this action' },
    { test: (msg) => /row.level security/i.test(msg), message: 'You do not have permission to perform this action' },
    { test: (msg) => /foreign key/i.test(msg), message: 'Cannot complete operation — related data exists' },
    { test: (msg) => /unique.*constraint|duplicate key/i.test(msg), message: 'This record already exists' },
    { test: (msg) => /not.null|null value/i.test(msg), message: 'Please fill all required fields' },
    { test: (msg) => /invalid.*password|incorrect.*password/i.test(msg), message: 'Incorrect password' },
    { test: (msg) => /invalid.*credentials|invalid login/i.test(msg), message: 'Invalid login details' },
    { test: (msg) => /email.*already.*registered|already.*registered/i.test(msg), message: 'Email is already registered' },
    { test: (msg) => /email.*not.*confirmed/i.test(msg), message: 'Please confirm your email first' },
    { test: (msg) => /rate.limit|too many/i.test(msg), message: 'Too many requests, please try again later' },
    { test: (msg) => /network|fetch|timeout|abort/i.test(msg), message: 'Network error, please try again later' },
    // Client-side validation messages (Arabic/English) pass through as-is
    { test: (msg) => /حجم الملف|نوع الملف|الحقل مطلوب/i.test(msg) || /file size|file type|required field/i.test(msg), message: '' },
  ],
};

export function sanitizeError(error: unknown, lang?: Lang): string {
  if (!error) return (lang ?? getRuntimeLanguage()) === 'ar' ? 'حدث خطأ غير متوقع' : 'Unexpected error';

  const activeLang = lang ?? getRuntimeLanguage();
  const err = error as Record<string, any>;
  const message = err?.message || String(error);
  const code = err?.code;

  // Log full error for debugging (only in dev)
  if (import.meta.env.DEV) {
    console.error('[Error Details]:', error);
  }

  for (const mapping of ERROR_MAP[activeLang]) {
    if (mapping.test(message, code)) {
      // Empty message means pass-through (client validation messages)
      return mapping.message || message;
    }
  }

  return activeLang === 'ar'
    ? 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً'
    : 'An unexpected error occurred. Please try again later.';
}
