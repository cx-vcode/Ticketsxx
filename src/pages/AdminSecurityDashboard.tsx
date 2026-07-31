import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ShieldCheck, Users, AlertTriangle, Activity, Lock, Eye, UserX, KeyRound, Download } from 'lucide-react';
import { format, subDays, differenceInMinutes } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function AdminSecurityDashboard() {
  const { t, isRTL, lang } = useLanguage();
  const dateLocale = lang === 'ar' ? ar : enUS;
  const { toast } = useToast();

  const eventLabels = useMemo(() => ({
    status_changed: t.admin.eventTypes.statusChanged,
    assigned: t.admin.eventTypes.assigned,
    priority_changed: t.admin.eventTypes.priorityChanged,
    department_changed: t.admin.eventTypes.departmentChanged,
    comment_added: t.admin.eventTypes.commentAdded,
    attachment_added: t.admin.eventTypes.attachmentAdded,
    created: t.admin.eventTypes.created,
    resolved: t.admin.eventTypes.resolved,
    closed: t.admin.eventTypes.closed,
    reopened: t.admin.eventTypes.reopened,
  }), [t]);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['security-audit-logs'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles:user_id(full_name, email)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['security-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*, user_roles(role)');
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['security-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
  });

  // Analytics
  const totalUsers = users.length;
  const activeUsers = users.filter((u: any) => u.is_active).length;
  const inactiveUsers = totalUsers - activeUsers;
  const adminCount = roles.filter((r: any) => r.role === 'admin').length;
  const agentCount = roles.filter((r: any) => r.role === 'agent').length;
  const developerCount = roles.filter((r: any) => r.role === 'developer').length;
  const requesterCount = roles.filter((r: any) => r.role === 'requester').length;

  // Activity by day
  const activityByDay = auditLogs.reduce((acc: Record<string, number>, log: any) => {
    const day = format(new Date(log.created_at), 'MM/dd');
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const activityChart = Object.entries(activityByDay)
    .map(([day, count]) => ({ day, count }))
    .reverse()
    .slice(-14);

  // Event type distribution
  const eventDist = auditLogs.reduce((acc: Record<string, number>, log: any) => {
    const type = log.event_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const eventPieData = Object.entries(eventDist)
    .map(([name, value]) => ({ name: eventLabels[name as keyof typeof eventLabels] || name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Top users by activity
  const userActivity = auditLogs.reduce((acc: Record<string, { name: string; count: number }>, log: any) => {
    const id = log.user_id;
    if (!acc[id]) acc[id] = { name: log.profiles?.full_name || t.common.unknown, count: 0 };
    acc[id].count++;
    return acc;
  }, {});
  const topUsers = Object.values(userActivity).sort((a, b) => b.count - a.count).slice(0, 8);

  // Role distribution
  const roleDistData = [
    { name: t.admin.roleNames.admin, value: adminCount, fill: COLORS[0] },
    { name: t.admin.roleNames.agent, value: agentCount, fill: COLORS[1] },
    { name: t.admin.roleNames.developer, value: developerCount, fill: COLORS[2] },
    { name: t.admin.roleNames.requester, value: requesterCount, fill: COLORS[3] },
  ];

  // Security alerts
  const alerts: { type: 'warning' | 'info' | 'danger'; message: string }[] = [];
  if (adminCount > 3) alerts.push({ type: 'warning', message: `${adminCount} ${t.admin.securityAlertMessages.tooManyAdmins}` });
  if (inactiveUsers > 5) alerts.push({ type: 'info', message: `${inactiveUsers} ${t.admin.securityAlertMessages.inactiveAccountsAlert}` });
  const usersNoDept = users.filter((u: any) => !u.department_id && u.user_roles?.[0]?.role !== 'requester').length;
  if (usersNoDept > 0) alerts.push({ type: 'info', message: `${usersNoDept} ${t.admin.securityAlertMessages.employeesNoDept}` });

  // Suspicious activity detection
  const now = new Date();
  const recentLogs = auditLogs.filter((l: any) => differenceInMinutes(now, new Date(l.created_at)) <= 60);
  const userHourCounts: Record<string, { count: number; name: string }> = {};
  recentLogs.forEach((l: any) => {
    if (!userHourCounts[l.user_id]) userHourCounts[l.user_id] = { count: 0, name: l.profiles?.full_name || t.common.unknown };
    userHourCounts[l.user_id].count++;
  });
  Object.values(userHourCounts).forEach(u => {
    if (u.count > 50) alerts.push({ type: 'danger', message: `${u.name}: ${u.count} ${t.admin.securityAlertMessages.highActivity}` });
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('security-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        const evt = payload.new as any;
        if (evt.event_type === 'assigned' || evt.event_type === 'status_changed') {
          toast({ title: `🔔 ${t.admin.newActivity}`, description: `${evt.action}` });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [t, toast]);

  // PDF Export
  const exportSecurityPDF = () => {
    const alertsHtml = alerts.map(a => `<div class="alert ${a.type}"><span class="icon">${a.type === 'danger' ? '🔴' : a.type === 'warning' ? '🟠' : '🔵'}</span> ${a.message}</div>`).join('');
    const topUsersHtml = topUsers.map((u, i) => `<tr><td>${i + 1}</td><td>${u.name}</td><td>${u.count}</td></tr>`).join('');
    const roleHtml = roleDistData.map(r => `<tr><td>${r.name}</td><td>${r.value}</td></tr>`).join('');
    const eventHtml = eventPieData.map(e => `<tr><td>${e.name}</td><td>${e.value}</td></tr>`).join('');

    const html = `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${lang}"><head><meta charset="UTF-8"><title>${t.admin.securityReportTitle}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Tajawal',sans-serif;background:#fff;color:#1a2e28;padding:40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2d8b6e;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:24px;color:#2d8b6e}
.header .meta{text-align:${isRTL ? 'left' : 'right'};color:#666;font-size:11px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px}
.kpi-card{background:#f0faf5;border:1px solid #d0e8dd;border-radius:10px;padding:16px;text-align:center}
.kpi-card .value{font-size:28px;font-weight:800;color:#2d8b6e}
.kpi-card .label{font-size:11px;color:#666;margin-top:4px}
.section{margin-bottom:24px}
.section h2{font-size:16px;color:#2d8b6e;margin-bottom:12px;border-bottom:1px solid #e0e0e0;padding-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{padding:8px 12px;text-align:${isRTL ? 'right' : 'left'};border-bottom:1px solid #eee}
th{background:#f0faf5;font-weight:700;color:#2d8b6e}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.alert{padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:12px;display:flex;align-items:center;gap:8px}
.alert.danger{background:#fff5f5;border:1px solid #fed7d7;color:#c53030}
.alert.warning{background:#fffff0;border:1px solid #feebc8;color:#c05621}
.alert.info{background:#ebf8ff;border:1px solid #bee3f8;color:#2b6cb0}
.footer{margin-top:40px;text-align:center;color:#999;font-size:10px;border-top:1px solid #eee;padding-top:16px}
@media print{body{padding:20px}}
</style></head><body>
<div class="header"><div><h1>🛡️ ${t.admin.securityReportTitle}</h1><p style="color:#888;font-size:12px">${t.admin.last30DaysReport}</p></div>
<div class="meta"><p>${t.admin.exportDate}: ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</p><p>Ticket-X System</p></div></div>

<div class="kpi-grid">
<div class="kpi-card"><div class="value">${totalUsers}</div><div class="label">${t.admin.totalUsers}</div></div>
<div class="kpi-card"><div class="value">${activeUsers}</div><div class="label">${t.admin.activeAccounts}</div></div>
<div class="kpi-card"><div class="value" style="color:#e53e3e">${inactiveUsers}</div><div class="label">${t.admin.inactiveAccounts}</div></div>
<div class="kpi-card"><div class="value">${auditLogs.length}</div><div class="label">${t.admin.eventsLast30Days}</div></div>
</div>

${alerts.length > 0 ? `<div class="section"><h2>⚠️ ${t.admin.securityAlerts}</h2>${alertsHtml}</div>` : ''}

<div class="two-col">
<div class="section"><h2>${t.admin.roleDistribution}</h2><table><thead><tr><th>${t.admin.approverRole}</th><th>${t.admin.eventCount}</th></tr></thead><tbody>${roleHtml}</tbody></table></div>
<div class="section"><h2>${t.admin.eventDistribution}</h2><table><thead><tr><th>${t.admin.eventType}</th><th>${t.admin.eventCount}</th></tr></thead><tbody>${eventHtml}</tbody></table></div>
</div>

<div class="section"><h2>${t.admin.topActiveUsers}</h2><table><thead><tr><th>#</th><th>${t.admin.userName}</th><th>${t.admin.eventCount}</th></tr></thead><tbody>${topUsersHtml}</tbody></table></div>

<div class="footer">Ticket-X System — ${new Date().toISOString()}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  const stats = [
    { icon: Users, label: t.admin.totalUsers, value: totalUsers, color: 'text-primary' },
    { icon: Lock, label: t.admin.activeAccounts, value: activeUsers, color: 'text-green-600 dark:text-green-400' },
    { icon: UserX, label: t.admin.inactiveAccounts, value: inactiveUsers, color: 'text-destructive' },
    { icon: Activity, label: t.admin.eventsLast30Days, value: auditLogs.length, color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.securityDashboardTitle}
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={exportSecurityPDF} className="gap-1.5 rounded-xl">
            <Download className="h-4 w-4" />
            {t.admin.exportPDF}
          </Button>
        }
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="visible" className="max-w-7xl mx-auto space-y-6">
          {/* Security Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Card className={`rounded-xl border-${isRTL ? 'r' : 'l'}-4 ${a.type === 'danger' ? `border-${isRTL ? 'r' : 'l'}-destructive` : a.type === 'warning' ? `border-${isRTL ? 'r' : 'l'}-orange-500` : `border-${isRTL ? 'r' : 'l'}-blue-500`}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 shrink-0 ${a.type === 'danger' ? 'text-destructive' : a.type === 'warning' ? 'text-orange-500' : 'text-blue-500'}`} />
                      <p className="text-sm text-foreground">{a.message}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="rounded-2xl border-border/50 shadow-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Activity Timeline */}
            <motion.div variants={fadeUp}>
              <Card className="rounded-2xl border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    {t.admin.auditActivity14Days}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityChart}>
                      <defs>
                        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#actGrad)" strokeWidth={2} name={t.admin.eventCount} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Role Distribution */}
            <motion.div variants={fadeUp}>
              <Card className="rounded-2xl border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    {t.admin.roleDistribution}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={roleDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {roleDistData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Event Types */}
            <motion.div variants={fadeUp}>
              <Card className="rounded-2xl border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    {t.admin.eventDistribution}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventPieData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name={t.admin.eventCount} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Top Active Users */}
            <motion.div variants={fadeUp}>
              <Card className="rounded-2xl border-border/50 shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {t.admin.topActiveUsers}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {topUsers.map((u, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{u.count}</Badge>
                      </div>
                    ))}
                    {topUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t.common.noResults}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </PageLayout>
  );
}
