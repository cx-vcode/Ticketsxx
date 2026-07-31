import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { Loader2, Lock, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import logoImg from '@/assets/logo-icon.png';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLanguage } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const sysSettings = useSystemSettings();
  const sysName = sysSettings.system_name || 'Ticket-X';
  const logoSrc = sysSettings.logo_url || logoImg;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check hash for recovery type
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t.auth.error, description: t.profilePage.passwordMismatch, variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: t.auth.error, description: t.profilePage.passwordTooShort, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast({ title: t.profilePage.passwordChanged });
      setTimeout(() => navigate('/auth'), 2000);
    } catch (err: any) {
      toast({ title: t.auth.error, description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      {/* Language switcher - top corner */}
      <div className="absolute top-4 ltr:right-4 rtl:left-4 z-20">
        <LanguageSwitcher variant="outline" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
        className="w-full max-w-[400px]"
      >
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl shadow-lg gradient-accent overflow-hidden backdrop-blur-sm">
            <img src={logoSrc} alt={sysName} className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-lg font-bold text-foreground mt-3">{sysName}</h1>
        </div>

        <div className="rounded-2xl bg-card shadow-xl border overflow-hidden">
          <div className="h-1.5 gradient-primary" />
          <div className="p-7">
            {success ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-6"
              >
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground">{t.profilePage.passwordChanged}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {isRTL ? 'جاري تحويلك لتسجيل الدخول...' : 'Redirecting to sign in...'}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Lock className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{t.auth.resetPassword}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL ? 'أدخل كلمة المرور الجديدة' : 'Enter your new password'}
                  </p>
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">{t.profilePage.newPassword}</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      dir="ltr"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">{t.profilePage.confirmPassword}</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      dir="ltr"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl font-bold text-sm gradient-primary text-primary-foreground shadow-lg gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        {t.profilePage.changePasswordBtn}
                        <ArrowIcon className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4 text-xs text-muted-foreground gap-2"
                  onClick={() => navigate('/auth')}
                >
                  <ArrowIcon className="h-3 w-3" />
                  {t.auth.backToLogin}
                </Button>
              </>
            )}
          </div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.9 }} 
          className="text-center text-muted-foreground/60 text-[11px] mt-6"
        >
          © {new Date().getFullYear()} {sysName} — {isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
        </motion.p>
      </motion.div>
    </div>
  );
}