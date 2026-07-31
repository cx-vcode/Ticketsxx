import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Pencil, Trash2, Copy, ArrowDown, ArrowUp, GitBranch, User, Clock, AlertTriangle, Server, ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import type { ApprovalStage } from '@/lib/api';

interface StageStats {
  pending: number;
  approved: number;
  rejected: number;
  avgDecisionHours: number | null;
}

interface Props {
  stage: ApprovalStage;
  showArrow: boolean;
  isFirst: boolean;
  isLast: boolean;
  stats?: StageStats;
  onEdit: (stage: ApprovalStage) => void;
  onDelete: (stage: ApprovalStage) => void;
  onDuplicate: (stage: ApprovalStage) => void;
  onMoveUp?: (stage: ApprovalStage) => void;
  onMoveDown?: (stage: ApprovalStage) => void;
}

export const ApprovalStageCard = memo(function ApprovalStageCard({ stage, showArrow, isFirst, isLast, stats, onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown }: Props) {
  const { t, isRTL, lang } = useLanguage();
  const { roleLabels } = useLocalizedLabels();
  const isAr = lang === 'ar';

  return (
    <div>
      <motion.div
        whileHover={{ scale: 1.003 }}
        className="group flex items-center justify-between py-3 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all duration-200"
      >
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5 shrink-0 me-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded" disabled={isFirst} onClick={() => onMoveUp?.(stage)}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded" disabled={isLast} onClick={() => onMoveDown?.(stage)}>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Order badge */}
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0 shadow-sm">
            {stage.stage_order}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{stage.stage_name}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] rounded-lg gap-0.5">
                {stage.stage_type === 'parallel' ? <GitBranch className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                {stage.stage_type === 'sequential' ? t.admin.sequential : t.admin.parallel}
              </Badge>
              <Badge variant="outline" className="text-[10px] rounded-lg">{roleLabels[stage.approver_role]}</Badge>
              {stage.approver_profile?.full_name && (
                <Badge variant="secondary" className="text-[10px] rounded-lg gap-0.5">
                  <User className="h-2.5 w-2.5" />
                  {stage.approver_profile.full_name}
                </Badge>
              )}
              {stage.services?.name && (
                <Badge variant="secondary" className="text-[10px] rounded-lg gap-0.5">
                  <Server className="h-2.5 w-2.5" />
                  {stage.services.name}
                </Badge>
              )}
              {stage.deadline_hours && (
                <Badge variant="outline" className="text-[10px] rounded-lg gap-0.5 text-warning border-warning/30">
                  <Clock className="h-2.5 w-2.5" />
                  {stage.deadline_hours} {t.admin.hoursUnit}
                </Badge>
              )}
              {stage.escalation_profile?.full_name && (
                <Badge variant="outline" className="text-[10px] rounded-lg gap-0.5 text-destructive border-destructive/30">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t.admin.escalation} {stage.escalation_profile.full_name}
                </Badge>
              )}
            </div>
            {/* Per-stage stats */}
            {stats && (stats.pending > 0 || stats.approved > 0 || stats.rejected > 0) && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">
                  {isAr ? 'معلقة' : 'Pending'}: {stats.pending}
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">
                  {isAr ? 'مقبولة' : 'Approved'}: {stats.approved}
                </span>
                <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                  {isAr ? 'مرفوضة' : 'Rejected'}: {stats.rejected}
                </span>
                {stats.avgDecisionHours !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    ⏱ {isAr ? 'متوسط القرار' : 'Avg decision'}: {stats.avgDecisionHours.toFixed(1)} {isAr ? 'ساعة' : 'hrs'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Actions */}
        <TooltipProvider delayDuration={200}>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onDuplicate(stage)}>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{t.admin.duplicateStage}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onEdit(stage)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{t.common.edit}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onDelete(stage)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{t.common.delete}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </motion.div>
      {showArrow && (
        <div className="flex justify-center py-1">
          <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
});
