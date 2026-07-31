import { memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n';
import { GoogleIcon } from '@/components/common/GoogleIcon';

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
    { label: t.dashboard.quickActions.reports, icon: 'insights', path: '/admin/reports', iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { label: t.dashboard.quickActions.users, icon: 'group', path: '/admin/users', iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
    { label: t.dashboard.quickActions.ticketInbox, icon: 'inbox', path: '/tickets', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: t.dashboard.quickActions.knowledgeBase, icon: 'menu_book', path: '/knowledge-base', iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: t.dashboard.quickActions.newTicket, icon: 'add_circle', path: '/tickets/new', iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <GoogleIcon name="bolt" size={20} className="text-amber-500" fill />
        <span className="text-sm font-extrabold text-foreground tracking-tight">{lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</span>
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
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(action.path)}
            className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-300"
          >
            <div className={`w-11 h-11 rounded-2xl ${action.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <GoogleIcon name={action.icon} size={24} fill />
            </div>
            <span className="text-xs font-bold text-foreground">{action.label}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
});
