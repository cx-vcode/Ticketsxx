import { memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ApprovalStageCard } from './ApprovalStageCard';
import type { ApprovalStage } from '@/lib/api';

interface StageStats {
  pending: number;
  approved: number;
  rejected: number;
  avgDecisionHours: number | null;
}

interface Props {
  deptName: string;
  stages: ApprovalStage[];
  stageStatsMap?: Record<string, StageStats>;
  onEdit: (stage: ApprovalStage) => void;
  onDelete: (stage: ApprovalStage) => void;
  onDuplicate: (stage: ApprovalStage) => void;
  onMoveUp?: (stage: ApprovalStage) => void;
  onMoveDown?: (stage: ApprovalStage) => void;
}

export const DepartmentStageGroup = memo(function DepartmentStageGroup({ deptName, stages, stageStatsMap, onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <Card className="rounded-2xl border-border/50 shadow-card overflow-hidden">
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <span>{deptName}</span>
            <Badge variant="secondary" className="text-[10px] rounded-full px-2">
              {stages.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-1 pt-0 pb-3">
              {sorted.map((stage, i) => (
                <ApprovalStageCard
                  key={stage.id}
                  stage={stage}
                  showArrow={i < sorted.length - 1}
                  isFirst={i === 0}
                  isLast={i === sorted.length - 1}
                  stats={stageStatsMap?.[stage.id]}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
});
