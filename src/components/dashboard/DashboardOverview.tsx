import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, Inbox, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/i18n';

interface Props {
  stats: any;
  report: any;
}

export const DashboardOverview = memo(function DashboardOverview({ stats, report }: Props) {
  const { lang } = useLanguage();
  const resolvedPercent = stats ? Math.min(100, Math.round(((stats.resolved ?? 0) / Math.max(1, (stats.new ?? 0) + (stats.open ?? 0) + (stats.in_progress ?? 0) + (stats.resolved ?? 0) + (stats.closed ?? 0))) * 100)) : 0;
  const overduePercent = report ? Math.min(100, (report.overdueCount ?? 0) * 5) : 0;

  const bars = [
    {
      label: lang === 'ar' ? 'جديدة' : 'New',
      value: stats?.new ?? 0,
      color: 'bg-primary',
      bgColor: 'bg-primary/15',
    },
    {
      label: lang === 'ar' ? 'مفتوحة' : 'Open',
      value: stats?.open ?? 0,
      color: 'bg-info',
      bgColor: 'bg-info/15',
    },
    {
      label: lang === 'ar' ? 'قيد المعالجة' : 'In Progress',
      value: stats?.in_progress ?? 0,
      color: 'bg-warning',
      bgColor: 'bg-warning/15',
    },
    {
      label: lang === 'ar' ? 'تم الحل' : 'Resolved',
      value: stats?.resolved ?? 0,
      color: 'bg-success',
      bgColor: 'bg-success/15',
    },
    {
      label: lang === 'ar' ? 'مغلقة' : 'Closed',
      value: stats?.closed ?? 0,
      color: 'bg-muted-foreground',
      bgColor: 'bg-muted-foreground/15',
    },
  ];

  const maxVal = Math.max(...bars.map(b => b.value), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-1 lg:grid-cols-5 gap-4"
    >
      {/* Status Distribution */}
      <div className="lg:col-span-3 rounded-2xl bg-card border border-border/50 p-5 hover:shadow-card-hover transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{lang === 'ar' ? 'توزيع الحالات' : 'Status Distribution'}</h3>
        </div>

        <div className="space-y-3">
          {bars.map((bar, i) => (
            <motion.div
              key={bar.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className="flex items-center gap-3"
            >
              <span className="text-[11px] text-muted-foreground font-medium w-20 shrink-0 truncate">{bar.label}</span>
              <div className={`flex-1 h-7 rounded-lg ${bar.bgColor} overflow-hidden relative`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(bar.value / maxVal) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full ${bar.color} rounded-lg`}
                />
              </div>
              <span className="text-xs font-bold text-foreground w-8 text-center">{bar.value}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Health Score */}
      <div className="lg:col-span-2 rounded-2xl bg-card border border-border/50 p-5 hover:shadow-card-hover transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{lang === 'ar' ? 'صحة النظام' : 'System Health'}</h3>
        </div>

        <div className="space-y-4">
          {/* Resolution Rate Ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <motion.path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--success))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0, 100' }}
                  animate={{ strokeDasharray: `${resolvedPercent}, 100` }}
                  transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                {resolvedPercent}%
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{lang === 'ar' ? 'معدل الحل' : 'Resolution Rate'}</p>
              <p className="text-[11px] text-muted-foreground">{lang === 'ar' ? 'من إجمالي التذاكر' : 'Of total tickets'}</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] text-destructive font-medium">{lang === 'ar' ? 'متأخرة' : 'Overdue'}</span>
              </div>
              <p className="text-lg font-bold text-foreground">{report?.overdueCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-warning/5 border border-warning/10 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span className="text-[10px] text-warning font-medium">{lang === 'ar' ? 'خروقات SLA' : 'SLA Breaches'}</span>
              </div>
              <p className="text-lg font-bold text-foreground">{report?.slaBreaches ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
