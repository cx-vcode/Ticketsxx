import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, Building2, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import {
  fetchServicesWithoutAssignmentGroup,
  fetchDepartments,
  updateService,
  type ServiceMissingGroup,
} from '@/lib/api';

interface Props {
  isAr: boolean;
}

export function ServicesMissingGroupPanel({ isAr }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fixing, setFixing] = useState<ServiceMissingGroup | null>(null);
  const [chosenDept, setChosenDept] = useState('');

  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ['services-missing-group'],
    queryFn: fetchServicesWithoutAssignmentGroup,
  });

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });

  const fixMut = useMutation({
    mutationFn: async () => {
      if (!fixing || !chosenDept) throw new Error('missing data');
      return updateService(fixing.service_id, { default_assignment_group: chosenDept } as any);
    },
    onSuccess: () => {
      toast({
        title: isAr ? '✅ تم ربط الخدمة بقسم' : '✅ Service linked to department',
        description: isAr
          ? 'سيُعاد إنشاء سجلات الاعتماد للتذاكر النشطة تلقائيًا.'
          : 'Approval records for active tickets will be re-created automatically.',
      });
      setFixing(null);
      setChosenDept('');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-missing-group'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-approvals-stats'] });
    },
    onError: (err: any) =>
      toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/50 mb-4">
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (services.length === 0) {
    return (
      <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 mb-4" data-testid="services-missing-group-panel">
        <CardContent className="flex items-center gap-2 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {isAr ? 'كل الخدمات لها قسم افتراضي' : 'All services have a default department'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-card mb-4" data-testid="services-missing-group-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {isAr ? 'خدمات بدون قسم افتراضي' : 'Services without default group'}
              <Badge variant="outline" className="text-[10px] border-amber-500/30">
                {services.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Alert className="rounded-xl border-amber-500/20 bg-background py-2">
            <AlertDescription className="text-[11px]">
              {isAr
                ? 'الخدمات التالية لا تملك قسمًا افتراضيًا، مما يمنع التذاكر الجديدة من الدخول لأي مرحلة اعتماد مرتبطة بقسم. أصلحها بسرعة:'
                : 'These services have no default department, blocking new tickets from entering any department-linked approval stage. Fix them quickly:'}
            </AlertDescription>
          </Alert>
          <div className="space-y-1 max-h-60 overflow-auto">
            {services.map((s) => (
              <div
                key={s.service_id}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-background/70 border border-border/30"
                data-testid="service-missing-row"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{s.service_name}</span>
                  {s.system_name && (
                    <span className="text-muted-foreground"> · {s.system_name}</span>
                  )}
                  {s.active_tickets_count > 0 && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {isAr ? 'تذاكر نشطة:' : 'Active:'} {s.active_tickets_count}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] gap-1 rounded-lg"
                  onClick={() => {
                    setFixing(s);
                    setChosenDept('');
                  }}
                  data-testid="quick-fix-btn"
                >
                  <Wrench className="h-3 w-3" />
                  {isAr ? 'إصلاح سريع' : 'Quick fix'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!fixing} onOpenChange={(v) => !v && setFixing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {isAr ? 'ربط القسم الافتراضي' : 'Assign default department'}
            </DialogTitle>
          </DialogHeader>
          {fixing && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {isAr ? 'الخدمة:' : 'Service:'} <span className="font-semibold text-foreground">{fixing.service_name}</span>
              </p>
              <div className="space-y-2">
                <Label>{isAr ? 'القسم الافتراضي' : 'Default department'}</Label>
                <Select value={chosenDept} onValueChange={setChosenDept}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={isAr ? 'اختر قسمًا' : 'Select department'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full rounded-xl gradient-accent text-accent-foreground gap-2"
                disabled={!chosenDept || fixMut.isPending}
                onClick={() => fixMut.mutate()}
                data-testid="confirm-fix-btn"
              >
                {fixMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? 'حفظ' : 'Save'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
