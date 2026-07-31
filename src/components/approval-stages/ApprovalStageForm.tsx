import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, User, Clock, AlertTriangle, Server } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import type { ApprovalStageType, AppRole } from '@/lib/api';

export interface StageFormData {
  department_id: string;
  stage_name: string;
  stage_order: number;
  stage_type: ApprovalStageType;
  approver_role: AppRole;
  approver_id: string | null;
  service_id: string | null;
  deadline_hours: number | null;
  escalation_to: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId: string | null;
  initialData?: Partial<StageFormData>;
  departments: { id: string; name: string }[];
  agents: { user_id: string; profiles?: { full_name: string; email: string } | null }[];
  services: { id: string; name: string }[];
  onSubmit: (data: StageFormData) => void;
  isPending: boolean;
}

export function ApprovalStageForm({ open, onOpenChange, editId, initialData, departments, agents, services, onSubmit, isPending }: Props) {
  const { t, isRTL } = useLanguage();
  const { roleLabels } = useLocalizedLabels();

  const [departmentId, setDepartmentId] = useState('');
  const [stageName, setStageName] = useState('');
  const [stageOrder, setStageOrder] = useState(1);
  const [stageType, setStageType] = useState<ApprovalStageType>('sequential');
  const [approverRole, setApproverRole] = useState<AppRole>('agent');
  const [approverId, setApproverId] = useState('none');
  const [serviceId, setServiceId] = useState('none');
  const [deadlineHours, setDeadlineHours] = useState('');
  const [escalationTo, setEscalationTo] = useState('none');

  useEffect(() => {
    if (initialData && open) {
      setDepartmentId(initialData.department_id || '');
      setStageName(initialData.stage_name || '');
      setStageOrder(initialData.stage_order || 1);
      setStageType(initialData.stage_type || 'sequential');
      setApproverRole(initialData.approver_role || 'agent');
      setApproverId(initialData.approver_id || 'none');
      setServiceId(initialData.service_id || 'none');
      setDeadlineHours(initialData.deadline_hours?.toString() || '');
      setEscalationTo(initialData.escalation_to || 'none');
    } else if (!open) {
      setDepartmentId('');
      setStageName('');
      setStageOrder(1);
      setStageType('sequential');
      setApproverRole('agent');
      setApproverId('none');
      setServiceId('none');
      setDeadlineHours('');
      setEscalationTo('none');
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    onSubmit({
      department_id: departmentId,
      stage_name: stageName.trim(),
      stage_order: stageOrder,
      stage_type: stageType,
      approver_role: approverRole,
      approver_id: approverId !== 'none' ? approverId : null,
      service_id: serviceId !== 'none' ? serviceId : null,
      deadline_hours: deadlineHours ? Number(deadlineHours) : null,
      escalation_to: escalationTo !== 'none' ? escalationTo : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? t.admin.editStage : t.admin.createStageTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {editId ? t.admin.editStageDesc || '' : t.admin.createStageDesc || ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.departmentRequired}</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder={t.admin.selectDepartment} /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Stage name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.stageName} *</Label>
            <Input value={stageName} onChange={e => setStageName(e.target.value)} placeholder={t.admin.stageNamePlaceholder} className="rounded-xl h-9" />
          </div>

          {/* Order + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t.admin.stageOrder}</Label>
              <Input type="number" min={1} value={stageOrder} onChange={e => setStageOrder(Number(e.target.value))} className="rounded-xl h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t.admin.stageType}</Label>
              <Select value={stageType} onValueChange={v => setStageType(v as ApprovalStageType)}>
                <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">{t.admin.sequential}</SelectItem>
                  <SelectItem value="parallel">{t.admin.parallel}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Approver Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t.admin.approverRole}</Label>
            <Select value={approverRole} onValueChange={v => setApproverRole(v as AppRole)}>
              <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">{roleLabels.agent}</SelectItem>
                <SelectItem value="admin">{roleLabels.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Specific Approver */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold"><User className="h-3 w-3 text-muted-foreground" /> {t.admin.specificApprover}</Label>
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder={t.admin.anyPersonWithRole} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t.admin.anyPersonWithRole}</SelectItem>
                {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.profiles?.full_name} ({a.profiles?.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold"><Server className="h-3 w-3 text-muted-foreground" /> {t.admin.linkToService}</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder={t.admin.allServicesOption} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t.admin.allServicesOption}</SelectItem>
                {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Deadline + Escalation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold"><Clock className="h-3 w-3 text-muted-foreground" /> {t.admin.deadlineHours}</Label>
              <Input type="number" min={1} value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)} placeholder={t.admin.noDeadline} className="rounded-xl h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold"><AlertTriangle className="h-3 w-3 text-muted-foreground" /> {t.admin.escalateTo}</Label>
              <Select value={escalationTo} onValueChange={setEscalationTo}>
                <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder={t.admin.noEscalation} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.admin.noEscalation}</SelectItem>
                  {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.profiles?.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full gradient-accent text-accent-foreground rounded-xl mt-2"
            disabled={!stageName.trim() || !departmentId || isPending}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
            {editId ? t.common.update : t.common.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
