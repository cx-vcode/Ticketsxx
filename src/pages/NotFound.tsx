import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Home, ArrowRight, ArrowLeft, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const getHomeRoute = () => {
    if (!user) return "/auth";
    if (role === "requester") return "/portal";
    if (role === "developer") return "/developer";
    return "/";
  };

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(getHomeRoute());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate, role, user]);

  const copy = lang === 'ar' ? {
    title: 'الصفحة غير موجودة',
    description: 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
    home: 'الصفحة الرئيسية',
    tickets: 'صندوق التذاكر',
    kb: 'قاعدة المعرفة',
    back: 'العودة للرئيسية',
    redirect: 'إعادة توجيه تلقائي خلال',
  } : {
    title: 'Page Not Found',
    description: 'Sorry, the page you are looking for does not exist or has been moved.',
    home: 'Home Page',
    tickets: 'Ticket Inbox',
    kb: 'Knowledge Base',
    back: 'Back to Home',
    redirect: 'Auto-redirect in',
  };

  const suggestions = [
    { label: copy.home, path: getHomeRoute(), icon: Home },
    { label: copy.tickets, path: user ? "/tickets" : "/auth", icon: Search },
    { label: copy.kb, path: user ? "/knowledge-base" : "/auth", icon: HelpCircle },
  ];

  const BackArrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="text-center max-w-lg w-full">
        {/* Animated 404 */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-8"
        >
          <span className="text-[120px] sm:text-[160px] font-extrabold leading-none bg-gradient-to-br from-primary via-primary/60 to-primary/20 bg-clip-text text-transparent select-none">
            404
          </span>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 blur-2xl" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {copy.title}
          </h1>
          <p className="text-muted-foreground mb-2">
            {copy.description}
          </p>
          <p className="text-xs text-muted-foreground/60 mb-8 font-mono" dir="ltr">
            {location.pathname}
          </p>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8"
        >
          {suggestions.map((s) => (
            <motion.button
              key={s.path}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(s.path)}
              className="flex items-center justify-center gap-2 p-4 rounded-xl border border-border/50 bg-card hover:shadow-card-hover transition-all text-sm font-medium text-foreground"
            >
              <s.icon className="h-4 w-4 text-primary" />
              {s.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Auto redirect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <Button
            onClick={() => navigate(getHomeRoute())}
            className="gradient-accent text-accent-foreground gap-2 shadow-lg shadow-primary/20"
          >
            <BackArrow className="h-4 w-4" />
            {copy.back}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {copy.redirect}
            </span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full min-w-[24px]">
              {countdown}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
