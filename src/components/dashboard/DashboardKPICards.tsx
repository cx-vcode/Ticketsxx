import { memo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { useMotionPrimitives } from '@/lib/motion';

interface Props {
  stats: any;
  report: any;
  tickets: any[];
  unresolvedCount: number;
  pendingCount: number;
}

export const DashboardKPICards = memo(function DashboardKPICards({ stats, report, tickets, unresolvedCount, pendingCount }: Props) {
  const { t, lang } = useLanguage();
  const m = useMotionPrimitives();
  const resolvedCount = stats?.resolved ?? 0;
  const resolutionRate = tickets.length > 0 ? Math.round((resolvedCount / tickets.length) * 100) : 0;
  const slaCompliance = report?.slaCompliancePercent ?? 0;
  const avgResp = report?.avgFirstResponseHours ?? 0;

  const kpis = [
    {
      title: t.dashboard.unresolvedTickets,
      value: unresolvedCount,
      icon: 'confirmation_number',
      iconColor: '#ea4335',
      iconBg: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',
      trend: unresolvedCount > 10 ? 'trending_up' : 'trending_down',
      trendLabel: unresolvedCount > 10 ? (lang === 'ar' ? 'يحتاج متابعة' : 'Needs attention') : (lang === 'ar' ? 'تحت السيطرة' : 'Under control'),
      trendColor: unresolvedCount > 10 ? 'text-red-500' : 'text-emerald-500',
      badgeBorder: 'border-red-500/20',
    },
    {
      title: t.dashboard.pending,
      value: pendingCount,
      icon: 'pending_actions',
      iconColor: '#fbbc04',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
      trend: pendingCount > 5 ? 'trending_up' : 'trending_down',
      trendLabel: `${pendingCount} ${lang === 'ar' ? 'بانتظار الإجراء' : 'pending'}`,
      trendColor: 'text-amber-500',
      badgeBorder: 'border-amber-500/20',
    },
    {
      title: lang === 'ar' ? 'التذاكر المحلولة' : 'Resolved Tickets',
      value: resolvedCount,
      icon: 'check_circle',
      iconColor: '#34a853',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      trend: 'task_alt',
      trendLabel: `${resolutionRate}% ${lang === 'ar' ? 'معدل النجاح' : 'success rate'}`,
      trendColor: 'text-emerald-500',
      badgeBorder: 'border-emerald-500/20',
    },
    {
      title: t.dashboard.slaCompliance,
      value: slaCompliance,
      suffix: '%',
      icon: 'verified_user',
      iconColor: '#1a73e8',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
      trend: slaCompliance >= 80 ? 'thumb_up' : 'warning',
      trendLabel: slaCompliance >= 80 ? (lang === 'ar' ? 'التزام ممتاز' : 'Excellent') : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs attention'),
      trendColor: slaCompliance >= 80 ? 'text-blue-500' : 'text-amber-500',
      badgeBorder: 'border-blue-500/20',
    },
    {
      title: t.dashboard.avgFirstResponse,
      value: avgResp,
      suffix: 'h',
      icon: 'avg_pace',
      iconColor: '#a142f4',
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
      trend: avgResp <= 4 ? 'bolt' : 'schedule',
      trendLabel: avgResp <= 4 ? (lang === 'ar' ? 'استجابة سريعة' : 'Fast response') : (lang === 'ar' ? 'بطيء' : 'Slow'),
      trendColor: 'text-purple-500',
      badgeBorder: 'border-purple-500/20',
    },
    {
      title: lang === 'ar' ? 'إجمالي الطلبات' : 'Total Requests',
      value: tickets.length,
      icon: 'analytics',
      iconColor: '#4285f4',
      iconBg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
      trend: 'insights',
      trendLabel: `${stats?.new ?? 0} ${lang === 'ar' ? 'طلبات جديدة' : 'new requests'}`,
      trendColor: 'text-sky-500',
      badgeBorder: 'border-sky-500/20',
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5"
      variants={m.gridContainer}
      initial="hidden"
      animate="visible"
    >
      {kpis.map((kpi) => (
        <motion.div
          key={kpi.title}
          variants={m.cardEnter}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="group relative rounded-2xl bg-card border border-border/70 p-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
        >
          {/* Subtle Google Material surface shimmer */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${kpi.iconBg}`}>
                <GoogleIcon name={kpi.icon} size={22} fill />
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-semibold ${kpi.trendColor}`}>
                <GoogleIcon name={kpi.trend} size={15} />
              </div>
            </div>

            <div>
              <p className="text-2xl font-extrabold text-foreground mb-0.5 tracking-tight tabular-nums font-sans">
                <AnimatedNumber value={typeof kpi.value === 'number' ? kpi.value : 0} suffix={(kpi as any).suffix || ''} />
              </p>
              <p className="text-[12px] text-muted-foreground font-medium line-clamp-1">{kpi.title}</p>

              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                <span className={`text-[10px] font-semibold tracking-wide ${kpi.trendColor}`}>
                  {kpi.trendLabel}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});
