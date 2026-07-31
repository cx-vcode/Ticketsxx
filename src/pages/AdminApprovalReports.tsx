import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, Clock, XCircle, CheckCircle2, TrendingUp, Users, AlertTriangle, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { differenceInHours, subDays, isAfter, format } from 'date-fns';
import { ar } from 'date-fns/locale';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

type TimeFilter = '7' | '30' | '90' | 'all';

const timeFilterLabels: Record<TimeFilter, string> = {
  '7': 'آخر 7 أيام',
  '30': 'آخر 30 يوم',
  '90': 'آخر 90 يوم',
  all: 'الكل',
};

interface ApprovalRow {
  id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  approver_id: string | null;
  is_escalated: boolean;
  approval_stages: { stage_name: string } | null;
  approver: { full_name: string } | null;
}

export default function AdminApprovalReports() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30');
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approval-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_approvals')
        .select('id, status, created_at, decided_at, approver_id, is_escalated, approval_stages(stage_name), approver:profiles!ticket_approvals_approver_id_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown) as ApprovalRow[];
    },
  });

  // Apply time filter
  const filtered = timeFilter === 'all'
    ? approvals
    : approvals.filter(a => isAfter(new Date(a.created_at), subDays(new Date(), Number(timeFilter))));

  const total = filtered.length;
  const approved = filtered.filter(a => a.status === 'approved');
  const rejected = filtered.filter(a => a.status === 'rejected');
  const pending = filtered.filter(a => a.status === 'pending');
  const escalated = filtered.filter(a => a.is_escalated);

  const decidedApprovals = filtered.filter(a => a.decided_at);
  const avgHours = decidedApprovals.length > 0
    ? Math.round(decidedApprovals.reduce((sum, a) => sum + differenceInHours(new Date(a.decided_at!), new Date(a.created_at)), 0) / decidedApprovals.length)
    : 0;

  const rejectionRate = total > 0 ? Math.round((rejected.length / total) * 100) : 0;

  const approverMap: Record<string, { name: string; count: number }> = {};
  decidedApprovals.forEach(a => {
    if (a.approver?.full_name) {
      const key = a.approver_id!;
      if (!approverMap[key]) approverMap[key] = { name: a.approver.full_name, count: 0 };
      approverMap[key].count++;
    }
  });
  const topApprovers = Object.values(approverMap).sort((a, b) => b.count - a.count).slice(0, 5);

  const stageMap: Record<string, { approved: number; rejected: number; pending: number }> = {};
  filtered.forEach(a => {
    const name = a.approval_stages?.stage_name || 'غير محدد';
    if (!stageMap[name]) stageMap[name] = { approved: 0, rejected: 0, pending: 0 };
    stageMap[name][a.status as 'approved' | 'rejected' | 'pending']++;
  });
  const stageData = Object.entries(stageMap).map(([name, counts]) => ({ name, ...counts }));

  const pieData = [
    { name: 'معتمد', value: approved.length, color: 'hsl(var(--success))' },
    { name: 'مرفوض', value: rejected.length, color: 'hsl(var(--destructive))' },
    { name: 'في الانتظار', value: pending.length, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  const handleExportPDF = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = format(new Date(), 'd MMMM yyyy', { locale: ar });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الاعتمادات - ${dateStr}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 40px; color: #1a1a1a; direction: rtl; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 30px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
          .kpi-card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; text-align: center; }
          .kpi-value { font-size: 28px; font-weight: 700; }
          .kpi-label { font-size: 12px; color: #666; margin-top: 4px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; border-bottom: 2px solid #e5e5e5; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #eee; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 600; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
          .stage-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>تقرير الاعتمادات</h1>
        <p class="subtitle">الفترة: ${timeFilterLabels[timeFilter]} | تاريخ التقرير: ${dateStr}</p>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">${total}</div>
            <div class="kpi-label">إجمالي الاعتمادات</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${avgHours} ساعة</div>
            <div class="kpi-label">معدل وقت الاعتماد</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${rejectionRate}%</div>
            <div class="kpi-label">نسبة الرفض</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${escalated.length}</div>
            <div class="kpi-label">تم تصعيدها</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">توزيع الحالات حسب المرحلة</div>
          <table>
            <thead><tr><th>المرحلة</th><th>معتمد</th><th>مرفوض</th><th>في الانتظار</th><th>الإجمالي</th></tr></thead>
            <tbody>
              ${stageData.map(s => `<tr><td>${s.name}</td><td>${s.approved}</td><td>${s.rejected}</td><td>${s.pending}</td><td>${s.approved + s.rejected + s.pending}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">أكثر المعتمدين نشاطاً</div>
          <table>
            <thead><tr><th>#</th><th>الاسم</th><th>عدد الاعتمادات</th></tr></thead>
            <tbody>
              ${topApprovers.map((a, i) => `<tr><td>${i + 1}</td><td>${a.name}</td><td>${a.count}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">ملخص النسب</div>
          <table>
            <thead><tr><th>الحالة</th><th>العدد</th><th>النسبة</th></tr></thead>
            <tbody>
              <tr><td>معتمد</td><td>${approved.length}</td><td>${total > 0 ? Math.round((approved.length / total) * 100) : 0}%</td></tr>
              <tr><td>مرفوض</td><td>${rejected.length}</td><td>${rejectionRate}%</td></tr>
              <tr><td>في الانتظار</td><td>${pending.length}</td><td>${total > 0 ? Math.round((pending.length / total) * 100) : 0}%</td></tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <PageLayout>
      <PageHeader
        title="تقرير الاعتمادات"
        icon={<ShieldCheck className="h-4 w-4" />}
        actions={
          <>
            <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-32 rounded-lg text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">آخر 7 أيام</SelectItem>
                <SelectItem value="30">آخر 30 يوم</SelectItem>
                <SelectItem value="90">آخر 90 يوم</SelectItem>
                <SelectItem value="all">الكل</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs h-8" onClick={handleExportPDF}>
              <FileDown className="h-3.5 w-3.5" />
              تصدير PDF
            </Button>
          </>
        }
      />

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <motion.div ref={reportRef} initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }} className="max-w-5xl mx-auto space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'إجمالي الاعتمادات', value: total, icon: ShieldCheck, color: 'text-primary' },
                    { label: 'معدل وقت الاعتماد', value: `${avgHours} ساعة`, icon: Clock, color: 'text-accent' },
                    { label: 'نسبة الرفض', value: `${rejectionRate}%`, icon: XCircle, color: 'text-destructive' },
                    { label: 'تم تصعيدها', value: escalated.length, icon: AlertTriangle, color: 'text-warning' },
                  ].map((kpi, i) => (
                    <motion.div key={i} variants={fadeUp}>
                      <Card className="rounded-2xl border-border/50">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                            <p className="text-lg font-bold">{kpi.value}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                  <motion.div variants={fadeUp}>
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          توزيع الحالات حسب المرحلة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {stageData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={stageData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                              <Tooltip />
                              <Bar dataKey="approved" name="معتمد" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="rejected" name="مرفوض" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="pending" name="في الانتظار" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <Card className="rounded-2xl border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          نسب الاعتماد والرفض
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Top Approvers */}
                <motion.div variants={fadeUp}>
                  <Card className="rounded-2xl border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-accent" />
                        أكثر المعتمدين نشاطاً
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topApprovers.length > 0 ? (
                        <div className="space-y-2">
                          {topApprovers.map((approver, i) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/30">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                                  {i + 1}
                                </div>
                                <span className="text-sm font-medium">{approver.name}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">{approver.count} اعتماد</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}
      </main>
    </PageLayout>
  );
}
