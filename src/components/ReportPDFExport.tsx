interface ReportData {
  total: number;
  avgResolutionHours: number;
  avgFirstResponseHours: number;
  slaCompliancePercent: number;
  slaBreaches: number;
  slaMet: number;
  overdueCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byDepartment: Record<string, number>;
  rawTickets?: any[];
}

type ExportOptions = {
  lang: 'ar' | 'en';
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  systemName?: string;
};

export function exportReportPDF(report: ReportData, dateLabel: string, opts: ExportOptions) {
  const isRTL = opts.lang === 'ar';

  const copy = isRTL
    ? {
        docTitle: 'تقرير التذاكر',
        period: 'الفترة',
        exportDate: 'تاريخ التصدير',
        totalTickets: 'إجمالي التذاكر',
        avgResolution: 'متوسط زمن الحل',
        avgFirstResponse: 'متوسط أول رد',
        slaCompliance: 'التزام SLA',
        slaBreaches: 'تجاوزات SLA',
        overdueNow: 'متأخرة حالياً',
        byStatus: 'حسب الحالة',
        byPriority: 'حسب الأولوية',
        byDepartment: 'حسب القسم',
        ticketDetails: 'تفاصيل التذاكر (أحدث 100)',
        thStatus: 'الحالة',
        thCount: 'العدد',
        thPriority: 'الأولوية',
        thDepartment: 'القسم',
        thResolution: 'زمن الحل',
        thTitle: 'العنوان',
        thNumber: '#',
        footer: (iso: string) => `تم إنشاء هذا التقرير آلياً بواسطة نظام ${opts.systemName || 'Ticket-X'} — ${iso}`,
      }
    : {
        docTitle: 'Tickets Report',
        period: 'Period',
        exportDate: 'Export date',
        totalTickets: 'Total tickets',
        avgResolution: 'Avg resolution',
        avgFirstResponse: 'Avg first response',
        slaCompliance: 'SLA compliance',
        slaBreaches: 'SLA breaches',
        overdueNow: 'Currently overdue',
        byStatus: 'By status',
        byPriority: 'By priority',
        byDepartment: 'By department',
        ticketDetails: 'Ticket details (latest 100)',
        thStatus: 'Status',
        thCount: 'Count',
        thPriority: 'Priority',
        thDepartment: 'Department',
        thResolution: 'Resolution',
        thTitle: 'Title',
        thNumber: '#',
        footer: (iso: string) => `This report was generated automatically by ${opts.systemName || 'Ticket-X'} — ${iso}`,
      };

  const statusRows = Object.entries(report.byStatus)
    .map(([k, v]) => `<tr><td>${opts.statusLabels[k] || k}</td><td>${v}</td></tr>`)
    .join('');

  const priorityRows = Object.entries(report.byPriority)
    .map(([k, v]) => `<tr><td>${opts.priorityLabels[k] || k}</td><td>${v}</td></tr>`)
    .join('');

  const deptRows = Object.entries(report.byDepartment)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  const ticketRows = (report.rawTickets || [])
    .slice(0, 100)
    .map(
      (t: any) => `<tr>
      <td>${t.ticket_number}</td>
      <td>${(t.title || '').slice(0, 40)}</td>
      <td>${opts.statusLabels[t.status] || t.status}</td>
      <td>${opts.priorityLabels[t.priority] || t.priority}</td>
      <td>${t.department || '-'}</td>
      <td>${t.resolutionHours ? t.resolutionHours + 'h' : '-'}</td>
    </tr>`
    )
    .join('');

  const fontImport = isRTL
    ? "@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');"
    : "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');";

  const fontFamily = isRTL ? "'Tajawal', sans-serif" : "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  const html = `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${opts.lang}">
<head>
<meta charset="UTF-8">
<title>${copy.docTitle} - ${dateLabel}</title>
<style>
  ${fontImport}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${fontFamily}; background: #fff; color: #1a2e28; padding: 40px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2d8b6e; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 24px; color: #2d8b6e; }
  .header .meta { text-align: ${isRTL ? 'left' : 'right'}; color: #666; font-size: 11px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
  .kpi-card { background: #f0faf5; border: 1px solid #d0e8dd; border-radius: 10px; padding: 16px; text-align: center; }
  .kpi-card .value { font-size: 28px; font-weight: 800; color: #2d8b6e; }
  .kpi-card .label { font-size: 11px; color: #666; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 16px; color: #2d8b6e; margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 8px 12px; text-align: ${isRTL ? 'right' : 'left'}; border-bottom: 1px solid #eee; }
  th { background: #f0faf5; font-weight: 700; color: #2d8b6e; }
  tr:hover { background: #fafffe; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .footer { margin-top: 40px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 20px; } .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📊 ${copy.docTitle}</h1>
      <p style="color:#888;font-size:12px;">${copy.period}: ${dateLabel}</p>
    </div>
    <div class="meta">
      <p>${copy.exportDate}: ${new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</p>
      <p>${opts.systemName || 'Ticket-X System'}</p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="value">${report.total}</div><div class="label">${copy.totalTickets}</div></div>
    <div class="kpi-card"><div class="value">${report.avgResolutionHours}h</div><div class="label">${copy.avgResolution}</div></div>
    <div class="kpi-card"><div class="value">${report.avgFirstResponseHours}h</div><div class="label">${copy.avgFirstResponse}</div></div>
    <div class="kpi-card"><div class="value">${report.slaCompliancePercent}%</div><div class="label">${copy.slaCompliance}</div></div>
    <div class="kpi-card"><div class="value" style="color:#e53e3e">${report.slaBreaches}</div><div class="label">${copy.slaBreaches}</div></div>
    <div class="kpi-card"><div class="value" style="color:#dd6b20">${report.overdueCount}</div><div class="label">${copy.overdueNow}</div></div>
  </div>

  <div class="two-col">
    <div class="section">
      <h2>${copy.byStatus}</h2>
      <table><thead><tr><th>${copy.thStatus}</th><th>${copy.thCount}</th></tr></thead><tbody>${statusRows}</tbody></table>
    </div>
    <div class="section">
      <h2>${copy.byPriority}</h2>
      <table><thead><tr><th>${copy.thPriority}</th><th>${copy.thCount}</th></tr></thead><tbody>${priorityRows}</tbody></table>
    </div>
  </div>

  <div class="section">
    <h2>${copy.byDepartment}</h2>
    <table><thead><tr><th>${copy.thDepartment}</th><th>${copy.thCount}</th></tr></thead><tbody>${deptRows}</tbody></table>
  </div>

  <div class="section" style="page-break-before:always;">
    <h2>${copy.ticketDetails}</h2>
    <table>
      <thead><tr><th>${copy.thNumber}</th><th>${copy.thTitle}</th><th>${copy.thStatus}</th><th>${copy.thPriority}</th><th>${copy.thDepartment}</th><th>${copy.thResolution}</th></tr></thead>
      <tbody>${ticketRows}</tbody>
    </table>
  </div>

  <div class="footer">${copy.footer(new Date().toISOString())}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
