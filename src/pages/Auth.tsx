import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Lock, Mail, ArrowLeft, ArrowRight, Eye, EyeOff, Ticket, Shield, Zap, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import logoImg from '@/assets/logo-icon.png';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLanguage } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/* ─── Typewriter ─── */
const TypewriterText = ({ texts, className }: { texts: string[]; className?: string }) => {
  const [display, setDisplay] = useState('');
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIdx] || '';
    if (!isDeleting && charIdx < currentText.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), 70);
      return () => clearTimeout(t);
    }
    if (!isDeleting && charIdx === currentText.length) {
      const t = setTimeout(() => setIsDeleting(true), 2500);
      return () => clearTimeout(t);
    }
    if (isDeleting && charIdx > 0) {
      const t = setTimeout(() => setCharIdx(c => c - 1), 40);
      return () => clearTimeout(t);
    }
    if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setTextIdx(i => (i + 1) % texts.length);
    }
  }, [charIdx, isDeleting, textIdx, texts]);

  useEffect(() => {
    setDisplay((texts[textIdx] || '').slice(0, charIdx));
  }, [charIdx, textIdx, texts]);

  return (
    <span className={className}>
      {display}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[3px] h-[1em] align-middle"
        style={{ marginInlineStart: '2px', background: '#60a5fa' }}
      />
    </span>
  );
};

/* ─── Dark Navy Background ─── */
const NavyBackground = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Base gradient: deep navy */}
    <div className="absolute inset-0" style={{
      background: 'linear-gradient(160deg, #0a1628 0%, #0f2035 30%, #132744 60%, #0d1b2e 100%)'
    }} />

    {/* Subtle grid */}
    <div className="absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage: `linear-gradient(rgba(147,197,253,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(147,197,253,0.15) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }}
    />

    {/* Soft glowing orbs */}
    {[
      { color: '#1e40af', size: 500, top: '-10%', left: '-8%', delay: 0 },
      { color: '#1d4ed8', size: 400, bottom: '-15%', right: '-10%', delay: 2 },
      { color: '#3b82f6', size: 250, top: '40%', left: '50%', delay: 4 },
    ].map((orb, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: orb.size, height: orb.size,
          background: `radial-gradient(circle, ${orb.color}20, transparent 70%)`,
          top: orb.top, left: orb.left, bottom: (orb as any).bottom, right: (orb as any).right,
          filter: 'blur(60px)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: orb.delay }}
      />
    ))}

    {/* Floating dots */}
    {Array.from({ length: 15 }).map((_, i) => (
      <motion.div
        key={`p-${i}`}
        className="absolute rounded-full"
        style={{
          width: 2, height: 2,
          background: 'rgba(147,197,253,0.2)',
          top: `${10 + Math.random() * 80}%`,
          left: `${10 + Math.random() * 80}%`,
        }}
        animate={{ y: [0, -25, 0], opacity: [0, 0.5, 0] }}
        transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

/* ─── Feature Card ─── */
const FeatureCard = ({ icon: Icon, titleAr, titleEn, descAr, descEn, delay, isRTL }: {
  icon: any; titleAr: string; titleEn: string; descAr: string; descEn: string; delay: number; isRTL: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.07] hover:border-blue-400/20 transition-all duration-300"
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-white/90">{isRTL ? titleAr : titleEn}</h4>
        <p className="text-xs text-blue-200/40 mt-0.5 leading-relaxed">{isRTL ? descAr : descEn}</p>
      </div>
    </motion.div>
  </motion.div>
);

/* ─── Branding Panel ─── */
const BrandingPanel = ({ sysName, logoSrc }: { sysName: string; logoSrc: string }) => {
  const { isRTL } = useLanguage();

  const features = [
    { icon: Ticket, titleAr: 'إدارة التذاكر الذكية', titleEn: 'Smart Ticket Management', descAr: 'تتبع وإدارة جميع طلبات الدعم بكفاءة', descEn: 'Track and manage all support requests efficiently' },
    { icon: Zap, titleAr: 'أتمتة سير العمل', titleEn: 'Workflow Automation', descAr: 'قواعد ذكية تعمل تلقائياً لتسريع الحلول', descEn: 'Smart rules that auto-trigger to speed up resolutions' },
    { icon: Shield, titleAr: 'التزام SLA متقدم', titleEn: 'Advanced SLA Compliance', descAr: 'مراقبة مستوى الخدمة والتنبيهات الاستباقية', descEn: 'Service level monitoring with proactive alerts' },
    { icon: BarChart3, titleAr: 'تقارير وتحليلات', titleEn: 'Reports & Analytics', descAr: 'لوحات معلومات تفاعلية ورؤى قابلة للتنفيذ', descEn: 'Interactive dashboards and actionable insights' },
  ];

  return (
    <div className="hidden lg:flex flex-1 relative overflow-hidden flex-col justify-between p-10 xl:p-14">
      <NavyBackground />

      {/* Logo + Brand */}
      <div className="relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="flex items-center gap-4">
          <motion.div className="relative" animate={{ y: [0, -4, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
            <motion.div
              className="absolute -inset-2 rounded-2xl blur-xl"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.2))' }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <div className="relative w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center overflow-hidden shadow-2xl">
              <img src={logoSrc} alt={sysName} className="w-10 h-10 object-contain" />
            </div>
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{sysName}</h1>
            <p className="text-xs text-blue-300/50 font-medium tracking-widest uppercase mt-0.5">
              {isRTL ? 'نظام الدعم الذكي' : 'Smart Helpdesk'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Hero Text + Features */}
      <div className="relative z-10 flex-1 flex flex-col justify-center -mt-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="mb-10">
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
            {isRTL ? 'حلول دعم فني' : 'Advanced Support'}<br />
            <TypewriterText
              texts={isRTL ? ['متطورة وذكية', 'سريعة وفعّالة', 'آمنة وموثوقة'] : ['Solutions & Intelligence', 'Fast & Efficient', 'Secure & Reliable']}
              className="text-blue-400"
            />
          </h2>
          <p className="text-sm text-blue-200/40 mt-4 max-w-md leading-relaxed">
            {isRTL
              ? 'منصة متكاملة لإدارة التذاكر والدعم الفني مع الذكاء الاصطناعي، مصممة لتحسين تجربة العملاء وتسريع حل المشكلات.'
              : 'An integrated platform for ticket management and technical support powered by AI, designed to enhance customer experience.'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={0.5 + i * 0.1} isRTL={isRTL} />
          ))}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }} className="flex items-center gap-6 pt-6 border-t border-white/[0.06]">
          {[
            { numAr: '+١٠٠٠', numEn: '1000+', labelAr: 'تذكرة مُدارة', labelEn: 'Tickets Managed' },
            { numAr: '٩٩.٩٪', numEn: '99.9%', labelAr: 'وقت التشغيل', labelEn: 'Uptime' },
            { numAr: '<٢ دقيقة', numEn: '<2 min', labelAr: 'متوسط الاستجابة', labelEn: 'Avg Response' },
          ].map((s, i) => (
            <div key={i} className="text-center flex-1">
              <motion.p
                className="text-lg font-bold text-blue-400"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.15, type: 'spring' }}
              >
                {isRTL ? s.numAr : s.numEn}
              </motion.p>
              <p className="text-[10px] text-blue-300/30 mt-0.5">{isRTL ? s.labelAr : s.labelEn}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/* ─── Login Form ─── */
const LoginForm = ({ onForgot }: { onForgot: () => void }) => {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast({ title: t.auth.loginSuccess });
    } catch (err: any) {
      toast({ title: t.auth.loginError, description: sanitizeError(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [email, password, signIn, toast, t]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2">
        <Label htmlFor="login-email" className="text-sm font-medium text-foreground/70 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {t.auth.email}
        </Label>
        <Input
          id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email address'}
          required dir="ltr"
          className="h-12 rounded-xl border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-background transition-all duration-200"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-2">
        <Label htmlFor="login-password" className="text-sm font-medium text-foreground/70 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          {t.auth.password}
        </Label>
        <div className="relative">
          <Input
            id="login-password" type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required dir="ltr"
            className="h-12 rounded-xl border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-background transition-all duration-200 ltr:pr-11 rtl:pl-11"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute ltr:right-3.5 rtl:left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/60 transition-colors">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div
            onClick={() => setRememberMe(!rememberMe)}
            className={`rounded border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-border/60 group-hover:border-muted-foreground'}`}
            style={{ width: 18, height: 18 }}
          >
            {rememberMe && (
              <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </motion.svg>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{isRTL ? 'تذكرني' : 'Remember me'}</span>
        </label>
        <button type="button" onClick={onForgot} className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
          {t.auth.forgotPassword}
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button type="submit" disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-sm gap-2 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)' }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <span className="flex items-center gap-2">{t.auth.login} <ArrowIcon className="h-4 w-4" /></span>
            )}
          </Button>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
        <div className="relative flex justify-center">
          <span className="px-4 text-xs font-medium text-muted-foreground/70 bg-background">{isRTL ? 'أو تسجيل الدخول بواسطة' : 'Or continue with'}</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="grid grid-cols-2 gap-3">
        <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2.5 h-11 rounded-xl border border-border/40 bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </motion.button>
        <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2.5 h-11 rounded-xl border border-border/40 bg-background hover:bg-muted/40 transition-colors text-sm font-medium text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
            <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
            <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
            <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
          </svg>
          Microsoft
        </motion.button>
      </motion.div>
    </form>
  );
};

/* ─── Forgot Password ─── */
const ForgotPasswordForm = ({ onBack }: { onBack: () => void }) => {
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setSent(true);
      toast({ title: t.auth.resetSent });
    } catch (err: any) {
      toast({ title: t.auth.error, description: sanitizeError(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
        </motion.div>
        <h3 className="text-lg font-bold text-foreground">{t.auth.resetSentTitle}</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs mx-auto">{t.auth.resetSentDesc}</p>
        <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl">{t.auth.backToLogin}</Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}>
          <Mail className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{t.auth.forgotPasswordTitle}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t.auth.forgotPasswordDesc}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground/70">{t.auth.email}</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email address'}
            required dir="ltr"
            className="h-12 rounded-xl border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-background transition-all" />
        </div>
        <Button type="submit" disabled={loading}
          className="w-full h-12 rounded-xl font-bold text-sm gap-2 text-white shadow-lg shadow-blue-600/25"
          style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)' }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.auth.sendResetLink}
        </Button>
      </form>
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mt-4 mx-auto block transition-colors">
        ← {t.auth.backToLogin}
      </button>
    </motion.div>
  );
};

/* ─── Main Auth Page ─── */
export default function AuthPage() {
  const sysSettings = useSystemSettings();
  const { t, isRTL } = useLanguage();
  const sysName = sysSettings.system_name || 'Ticket-X';
  const logoSrc = sysSettings.logo_url || logoImg;
  const [forgotMode, setForgotMode] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <BrandingPanel sysName={sysName} logoSrc={logoSrc} />

      <div className="flex-1 flex items-center justify-center relative p-6 sm:p-10 lg:max-w-[560px] bg-background">
        <div className="absolute top-5 ltr:right-5 rtl:left-5 z-20">
          <LanguageSwitcher variant="outline" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Mobile Logo */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-8 lg:hidden">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl shadow-lg overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}>
              <img src={logoSrc} alt={sysName} className="h-10 w-10 object-contain" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground mt-3">{sysName}</h1>
            <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'نظام الدعم الذكي' : 'Smart Helpdesk'}</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {!forgotMode && (
              <motion.div key="header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="mb-8">
                <h2 className="text-[28px] font-extrabold text-foreground">{isRTL ? 'مرحباً بعودتك' : 'Welcome back'}</h2>
                <p className="text-[15px] text-muted-foreground mt-1.5">{isRTL ? 'سجّل دخولك إلى حسابك للوصول إلى لوحة التحكم' : 'Log in to your account to access the dashboard'}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {forgotMode ? (
              <motion.div key="forgot" initial={{ opacity: 0, x: isRTL ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRTL ? 20 : -20 }} transition={{ duration: 0.3 }}>
                <ForgotPasswordForm onBack={() => setForgotMode(false)} />
              </motion.div>
            ) : (
              <motion.div key="login" initial={{ opacity: 0, x: isRTL ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRTL ? -20 : 20 }} transition={{ duration: 0.3 }}>
                <LoginForm onForgot={() => setForgotMode(true)} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center text-muted-foreground text-xs mt-8">
            {isRTL ? 'للحصول على حساب جديد، تواصل مع مسؤول النظام' : 'To get a new account, contact your system administrator'}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="text-center text-muted-foreground/50 text-[11px] mt-4">
            © {new Date().getFullYear()} {sysName} — {isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
