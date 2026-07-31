import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Inbox, Clock, CheckCircle2, Shield, Timer, BarChart3,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
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
      icon: Inbox,
      tone: 'destructive',
      trend: unresolvedCount > 10 ? 'up' : 'down',
      trendLabel: unresolvedCount > 10 ? (lang === 'ar' ? 'يحتاج متابعة' : 'Needs attention') : (lang === 'ar' ? 'تحت السيطرة' : 'Under control'),
      iconBg: 'bg-destructive/10 text-destructive',
      ring: 'group-hover:ring-destructive/20',
    },
    {
      title: t.dashboard.pending,
      value: pendingCount,
      icon: Clock,
      tone: 'warning',
      trend: pendingCount > 5 ? 'up' : 'down',
      trendLabel: `${pendingCount} ${lang === 'ar' ? 'بانتظار' : 'waiting'}`,
      iconBg: 'bg-warning/10 text-warning',
      ring: 'group-hover:ring-warning/20',
    },
    {
      title: lang === 'ar' ? 'تم الحل' : 'Resolved',
      value: resolvedCount,
      icon: CheckCircle2,
      tone: 'success',
      trend: 'down',
      trendLabel: `${resolutionRate}% ${lang === 'ar' ? 'معدل الحل' : 'rate'}`,
      iconBg: 'bg-success/10 text-success',
      ring: 'group-hover:ring-success/20',
    },
    {
      title: t.dashboard.slaCompliance,
      value: slaCompliance,
      suffix: '%',
      icon: Shield,
      tone: slaCompliance >= 80 ? 'success' : 'destructive',
      trend: slaCompliance >= 80 ? 'down' : 'up',
      trendLabel: slaCompliance >= 80 ? (lang === 'ar' ? 'ممتاز' : 'Excellent') : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs improvement'),
      iconBg: slaCompliance >= 80 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
      ring: 'group-hover:ring-primary/20',
    },
    {
      title: t.dashboard.avgFirstResponse,
      value: avgResp,
      suffix: 'h',
      icon: Timer,
      tone: 'info',
      trend: avgResp <= 4 ? 'down' : 'up',
      trendLabel: avgResp <= 4 ? (lang === 'ar' ? 'سريع' : 'Fast') : (lang === 'ar' ? 'بطيء' : 'Slow'),
      iconBg: 'bg-info/10 text-info',
      ring: 'group-hover:ring-info/20',
    },
    {
      title: lang === 'ar' ? 'إجمالي التذاكر' : 'Total Tickets',
      value: tickets.length,
      icon: BarChart3,
      tone: 'primary',
      trend: 'neutral',
      trendLabel: `${stats?.new ?? 0} ${lang === 'ar' ? 'جديدة' : 'new'}`,
      iconBg: 'bg-primary/10 text-primary',
      ring: 'group-hover:ring-primary/20',
    },
  ] as const;

  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      variants={m.gridContainer}
      initial="hidden"
      animate="visible"
    >
      {kpis.map((kpi) => (
        <motion.div
          key={kpi.title}
          variants={m.cardEnter}
          whileHover={m.hoverLift}
          className={`group relative rounded-2xl bg-card border border-border/60 p-4 cursor-default overflow-hidden ring-1 ring-transparent transition-all duration-300 hover:shadow-card-hover hover:border-primary/30 ${kpi.ring}`}
        >
          {/* Subtle gradient mesh on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03] pointer-events-none" />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-3 ${kpi.iconBg}`}>
                <kpi.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </div>
              {kpi.trend !== 'neutral' && (
                <div className={`flex items-center gap-0.5 text-[10px] font-bold tracking-wide ${
                  kpi.trend === 'up' ? 'text-destructive' : 'text-success'
                }`}>
                  {kpi.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                </div>
              )}
            </div>

            <p className="text-2xl font-bold text-foreground mb-0.5 tracking-tight tabular-nums">
              <AnimatedNumber value={typeof kpi.value === 'number' ? kpi.value : 0} suffix={(kpi as any).suffix || ''} />
            </p>

            <p className="text-[11px] text-muted-foreground font-medium leading-tight">{kpi.title}</p>

            <p className={`text-[10px] mt-1.5 font-medium ${
              kpi.trend === 'up' ? 'text-destructive/80' : kpi.trend === 'down' ? 'text-success/80' : 'text-muted-foreground/70'
            }`}>
              {kpi.trendLabel}
            </p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
});
