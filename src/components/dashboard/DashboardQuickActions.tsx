import { memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Inbox, BookOpen, Plus, Zap } from 'lucide-react';
import { useLanguage } from '@/i18n';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export const DashboardQuickActions = memo(function DashboardQuickActions() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const actions = [
    { label: t.dashboard.quickActions.reports, icon: BarChart3, path: '/admin/reports', gradient: 'from-primary/10 to-primary/5', iconBg: 'bg-primary/15', iconColor: 'text-primary' },
    { label: t.dashboard.quickActions.users, icon: Users, path: '/admin/users', gradient: 'from-accent/10 to-accent/5', iconBg: 'bg-accent/15', iconColor: 'text-accent' },
    { label: t.dashboard.quickActions.ticketInbox, icon: Inbox, path: '/tickets', gradient: 'from-success/10 to-success/5', iconBg: 'bg-success/15', iconColor: 'text-success' },
    { label: t.dashboard.quickActions.knowledgeBase, icon: BookOpen, path: '/knowledge-base', gradient: 'from-info/10 to-info/5', iconBg: 'bg-info/15', iconColor: 'text-info' },
    { label: t.dashboard.quickActions.newTicket, icon: Plus, path: '/tickets/new', gradient: 'from-warning/10 to-warning/5', iconBg: 'bg-warning/15', iconColor: 'text-warning' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-warning" />
        <span className="text-sm font-bold text-foreground">{lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</span>
      </div>
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {actions.map((action) => (
          <motion.button
            key={action.path}
            variants={item}
            whileHover={{ y: -3, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(action.path)}
            className={`group flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-border/40 bg-gradient-to-b ${action.gradient} hover:border-primary/20 hover:shadow-card-hover transition-all duration-300`}
          >
            <div className={`w-10 h-10 rounded-xl ${action.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <action.icon className={`h-5 w-5 ${action.iconColor}`} />
            </div>
            <span className="text-xs font-semibold text-foreground">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
});
