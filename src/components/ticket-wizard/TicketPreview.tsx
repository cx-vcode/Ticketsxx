import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Tag, Layers, Server, FolderOpen, Paperclip } from 'lucide-react';
import type { TicketPriority, System, Service, ServiceCategory, ServiceField } from '@/lib/api';
import { useLanguage } from '@/i18n';

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-accent/10 text-accent',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

interface TicketPreviewProps {
  title: string;
  description: string;
  priority: TicketPriority;
  systemId: string;
  serviceId: string;
  categoryId: string;
  files: File[];
  customFieldValues: Record<string, string>;
  systems: System[];
  services: Service[];
  categories: ServiceCategory[];
  serviceFields: ServiceField[];
}

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function TicketPreview({
  title, description, priority, systemId, serviceId, categoryId,
  files, customFieldValues, systems, services, categories, serviceFields,
}: TicketPreviewProps) {
  const { t } = useLanguage();
  const systemName = systems.find(s => s.id === systemId)?.name;
  const serviceName = services.find(s => s.id === serviceId)?.name;
  const categoryName = categories.find(c => c.id === categoryId)?.name;

  const priorityLabels: Record<TicketPriority, string> = {
    low: t.tickets.priority.low,
    medium: t.tickets.priority.medium,
    high: t.tickets.priority.high,
    urgent: t.tickets.priority.urgent,
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={item} className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {t.newTicket.previewTitle}</p>
        <p className="text-lg font-bold">{title}</p>
      </motion.div>

      <motion.div variants={item} className="space-y-1">
        <p className="text-xs text-muted-foreground">{t.newTicket.previewDescription}</p>
        <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3 leading-relaxed">{description}</p>
      </motion.div>

      <Separator />

      <motion.div variants={item} className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t.newTicket.previewPriority}</span>
          <Badge variant="outline" className={priorityColors[priority]}>{priorityLabels[priority]}</Badge>
        </div>
        {systemName && (
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.newTicket.previewSystem}</span>
            <span className="text-sm font-medium">{systemName}</span>
          </div>
        )}
        {serviceName && (
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.newTicket.previewService}</span>
            <span className="text-sm font-medium">{serviceName}</span>
          </div>
        )}
        {categoryName && (
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t.newTicket.previewCategory}</span>
            <span className="text-sm font-medium">{categoryName}</span>
          </div>
        )}
      </motion.div>

      {serviceFields.filter(f => customFieldValues[f.id]?.trim()).length > 0 && (
        <>
          <Separator />
          <motion.div variants={item} className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold">{t.newTicket.previewAdditionalFields}</p>
            <div className="grid grid-cols-2 gap-2">
              {serviceFields.filter(f => customFieldValues[f.id]?.trim()).map(f => (
                <div key={f.id} className="bg-muted/30 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">{f.field_name}</p>
                  <p className="text-sm font-medium">{customFieldValues[f.id]}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {files.length > 0 && (
        <>
          <Separator />
          <motion.div variants={item} className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> {t.newTicket.previewAttachments} ({files.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="text-xs bg-muted/40 px-2 py-1 rounded-md">{f.name}</span>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
