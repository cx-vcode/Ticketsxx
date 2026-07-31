import { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NotificationsPopover } from '@/components/NotificationsPopover';

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  showNotifications?: boolean;
}

export const PageHeader = memo(function PageHeader({
  title,
  icon,
  badge,
  actions,
  showNotifications = true,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ y: -12, opacity: 0, filter: 'blur(4px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="h-[60px] flex items-center justify-between border-b border-border/50 glass px-4 md:px-5 gap-3 shrink-0 sticky top-0 z-30 no-print"
    >
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
        {icon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-xs"
          >
            <span className="text-primary">{icon}</span>
          </motion.div>
        )}
        <h1 className="text-[15px] md:text-base font-bold text-foreground tracking-tight truncate">{title}</h1>
        {badge}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {showNotifications && <NotificationsPopover />}
      </div>
    </motion.header>
  );
});
