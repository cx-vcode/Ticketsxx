import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, ArrowDown, User, Clock, AlertTriangle, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import type { ApprovalStage } from '@/lib/api';

interface Props {
  stages: ApprovalStage[];
  departments: { id: string; name: string }[];
}

export const ApprovalFlowchart = memo(function ApprovalFlowchart({ stages, departments }: Props) {
  const { lang } = useLanguage();
  const { roleLabels } = useLocalizedLabels();
  const isAr = lang === 'ar';

  const grouped = useMemo(() => {
    const map: Record<string, { name: string; stages: ApprovalStage[] }> = {};
    stages.forEach(s => {
      const deptId = s.department_id;
      if (!map[deptId]) {
        map[deptId] = { name: s.departments?.name || departments.find(d => d.id === deptId)?.name || '—', stages: [] };
      }
      map[deptId].stages.push(s);
    });
    Object.values(map).forEach(g => g.stages.sort((a, b) => a.stage_order - b.stage_order));
    return map;
  }, [stages, departments]);

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <ShieldCheck className="h-12 w-12 mb-3 opacity-30" />
        <p>{isAr ? 'لا توجد مراحل لعرض المخطط' : 'No stages to display'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([deptId, { name, stages: deptStages }]) => (
        <Card key={deptId} className="rounded-2xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              {name}
              <Badge variant="secondary" className="text-[10px]">{deptStages.length} {isAr ? 'مرحلة' : 'stages'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            {/* Flow visualization */}
            <div className="flex flex-col items-center">
              {/* Start node */}
              <div className="flex items-center justify-center w-32 h-10 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-600 text-xs font-bold">
                {isAr ? '🚀 بداية' : '🚀 Start'}
              </div>
              <div className="w-px h-6 bg-border" />

              {deptStages.map((stage, i) => {
                const isParallel = stage.stage_type === 'parallel';
                return (
                  <div key={stage.id} className="flex flex-col items-center w-full">
                    {/* Stage node */}
                    <div className={`relative w-full max-w-md rounded-xl border-2 p-4 transition-colors ${
                      isParallel
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-primary/30 bg-primary/5'
                    }`}>
                      {/* Stage number */}
                      <div className={`absolute -top-3 ${isAr ? 'right-4' : 'left-4'} w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground ${
                        isParallel ? 'bg-blue-500' : 'gradient-primary'
                      }`}>
                        {stage.stage_order}
                      </div>

                      {/* Type indicator */}
                      <div className={`absolute -top-3 ${isAr ? 'left-4' : 'right-4'}`}>
                        <Badge variant="outline" className="text-[9px] bg-background gap-0.5 py-0">
                          {isParallel ? <GitBranch className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                          {isParallel ? (isAr ? 'متوازي' : 'Parallel') : (isAr ? 'تسلسلي' : 'Sequential')}
                        </Badge>
                      </div>

                      <p className="font-semibold text-sm mt-1">{stage.stage_name}</p>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <User className="h-3 w-3" />
                          {stage.approver_profile?.full_name || roleLabels[stage.approver_role]}
                        </span>
                        {stage.services?.name && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            📦 {stage.services.name}
                          </span>
                        )}
                        {stage.deadline_hours && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                            <Clock className="h-3 w-3" />
                            {stage.deadline_hours} {isAr ? 'ساعة' : 'hrs'}
                          </span>
                        )}
                      </div>

                      {/* Escalation branch */}
                      {stage.escalation_profile?.full_name && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive border-t border-destructive/10 pt-2">
                          <AlertTriangle className="h-3 w-3" />
                          {isAr ? 'تصعيد إلى' : 'Escalate to'}: {stage.escalation_profile.full_name}
                        </div>
                      )}

                      {/* Decision outcomes */}
                      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {isAr ? 'موافقة → المرحلة التالية' : 'Approve → Next'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-destructive">
                          <XCircle className="h-3 w-3" />
                          {isAr ? 'رفض → إغلاق التذكرة' : 'Reject → Close Ticket'}
                        </div>
                      </div>
                    </div>

                    {/* Connector */}
                    {i < deptStages.length - 1 && (
                      <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-border" />
                        <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
                        <div className="w-px h-2 bg-border" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* End node */}
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center justify-center w-32 h-10 rounded-full bg-primary/15 border-2 border-primary/30 text-primary text-xs font-bold">
                {isAr ? '✅ اعتماد كامل' : '✅ Approved'}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
