import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function PageLoader() {
  // Get language from localStorage since we can't use useLanguage here (outside provider)
  const lang = typeof window !== 'undefined' ? localStorage.getItem('app_language') || 'ar' : 'ar';
  const loadingText = lang === 'ar' ? 'جاري التحميل...' : 'Loading...';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-primary/20" />
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <div className="h-14 w-14 rounded-full border-4 border-transparent border-t-primary" />
          </motion.div>
          <motion.div
            className="absolute inset-2"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm font-medium text-muted-foreground"
        >
          {loadingText}
        </motion.p>
      </motion.div>
    </div>
  );
}
