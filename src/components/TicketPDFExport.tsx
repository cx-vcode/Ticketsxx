import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { statusLabels, priorityLabels, type Ticket, type TicketComment, type TicketAttachment } from '@/lib/api';

interface TicketPDFExportProps {
  ticket: Ticket;
  comments: TicketComment[];
  attachments: TicketAttachment[];
}

export function TicketPDFExport({ ticket, comments, attachments }: TicketPDFExportProps) {
  const [loading, setLoading] = useState(false);

  const generatePDF = () => {
    setLoading(true);
    try {
      const publicComments = comments.filter(c => c.note_type === 'public');
      
      const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تذكرة ${ticket.code || '#' + ticket.ticket_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a1a2e; padding: 40px; direction: rtl; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; color: #16a34a; }
    .header .meta { text-align: left; font-size: 11px; color: #666; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 6px; }
    .badge-status { background: #dcfce7; color: #15803d; }
    .badge-priority { background: #fef3c7; color: #92400e; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 700; color: #16a34a; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item { font-size: 12px; }
    .info-label { color: #888; font-size: 11px; }
    .description { font-size: 13px; line-height: 1.8; white-space: pre-wrap; background: #f9fafb; padding: 12px; border-radius: 8px; }
    .comment { background: #f3f4f6; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
    .comment-meta { font-size: 10px; color: #888; margin-bottom: 4px; }
    .resolution { background: #dcfce7; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #aaa; text-align: center; }
    .attachments { font-size: 12px; }
    .attachments li { margin-bottom: 4px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Ticket-X</h1>
      <p style="font-size:12px;color:#666;margin-top:4px;">تقرير تذكرة</p>
    </div>
    <div class="meta">
      <p><strong>${ticket.code || 'TCK-' + ticket.ticket_number}</strong></p>
      <p>${format(new Date(ticket.created_at), 'd MMMM yyyy', { locale: ar })}</p>
    </div>
  </div>

  <div style="margin-bottom:16px;">
    <h2 style="font-size:18px;margin-bottom:8px;">${ticket.title}</h2>
    <span class="badge badge-status">${statusLabels[ticket.status]}</span>
    <span class="badge badge-priority">${priorityLabels[ticket.priority]}</span>
  </div>

  <div class="section">
    <div class="section-title">معلومات التذكرة</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">مقدم الطلب:</span> ${ticket.requester?.full_name || '-'}</div>
      <div class="info-item"><span class="info-label">المعالج:</span> ${ticket.agent?.full_name || 'غير معيّن'}</div>
      <div class="info-item"><span class="info-label">القسم:</span> ${ticket.departments?.name || '-'}</div>
      <div class="info-item"><span class="info-label">الخدمة:</span> ${ticket.services?.name || '-'}</div>
      <div class="info-item"><span class="info-label">المصدر:</span> ${ticket.source_system}</div>
      <div class="info-item"><span class="info-label">تاريخ الإنشاء:</span> ${format(new Date(ticket.created_at), 'd MMM yyyy, HH:mm', { locale: ar })}</div>
      ${ticket.resolved_at ? `<div class="info-item"><span class="info-label">تاريخ الحل:</span> ${format(new Date(ticket.resolved_at), 'd MMM yyyy, HH:mm', { locale: ar })}</div>` : ''}
      ${ticket.external_reference ? `<div class="info-item"><span class="info-label">المرجع الخارجي:</span> ${ticket.external_reference}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">الوصف</div>
    <div class="description">${ticket.description}</div>
  </div>

  ${ticket.resolution_summary ? `
  <div class="section">
    <div class="section-title">ملخص الحل</div>
    <div class="resolution">${ticket.resolution_summary}</div>
  </div>` : ''}

  ${publicComments.length > 0 ? `
  <div class="section">
    <div class="section-title">المحادثة (${publicComments.length})</div>
    ${publicComments.map(c => `
    <div class="comment">
      <div class="comment-meta"><strong>${c.author?.full_name || '-'}</strong> • ${format(new Date(c.created_at), 'd MMM, HH:mm', { locale: ar })}</div>
      <div>${c.content}</div>
    </div>`).join('')}
  </div>` : ''}

  ${attachments.length > 0 ? `
  <div class="section">
    <div class="section-title">المرفقات (${attachments.length})</div>
    <ul class="attachments">
      ${attachments.map(a => `<li>📎 ${a.file_name}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="footer">
    تم إنشاء هذا التقرير بواسطة Ticket-X • ${format(new Date(), 'd MMMM yyyy, HH:mm', { locale: ar })}
  </div>
</body>
</html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={generatePDF} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
      تصدير PDF
    </Button>
  );
}
