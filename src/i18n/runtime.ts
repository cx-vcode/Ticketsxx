export type RuntimeLanguage = 'ar' | 'en';

export function getRuntimeLanguage(): RuntimeLanguage {
  if (typeof window === 'undefined') return 'ar';
  try {
    const v = window.localStorage.getItem('app_language');
    return v === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function isRuntimeRTL(lang: RuntimeLanguage = getRuntimeLanguage()) {
  return lang === 'ar';
}
