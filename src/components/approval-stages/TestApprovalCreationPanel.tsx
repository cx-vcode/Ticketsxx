import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FlaskConical, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { fetchServices, testTicketApprovalCreation, type TestTicketResult } from '@/lib/api';

interface Props {
  isAr: boolean;
}

export function TestApprovalCreationPanel({ isAr }: Props) {
  const { toast } = useToast();
  const [serviceId, setServiceId] = useState('');
  const [result, setResult] = useState<TestTicketResult | null>(null);

  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });

  const mut = useMutation({
    mutationFn: () => testTicketApprovalCreation(serviceId),
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: data.success
          ? isAr ? '✅ تم إنشاء الاعتمادات' : '✅ Approvals created'
          : isAr ? '⚠️ لم تُنشأ اعتمادات' : '⚠️ No approvals created',
        description: isAr
          ? `أُنشئت ${data.approvals_created} مرحلة وحُذفت التذكرة التجريبية.`
          : `${data.approvals_created} stages created. Test ticket cleaned up.`,
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (err: any) => {
      setResult(null);
      toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' });
    },
  });

  return (
    <Card className="rounded-2xl border-border/50 shadow-card mb-4" data-testid="test-approval-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          {isAr ? 'اختبار إنشاء تذكرة تجريبية' : 'Test ticket approval creation'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          {isAr
            ? 'يُنشئ تذكرة مؤقتة بالخدمة المحددة، يحسب عدد ticket_approvals الناتج، ثم يحذفها تلقائيًا.'
            : 'Creates a temporary ticket with the chosen service, counts the resulting ticket_approvals, then deletes it.'}
        </p>
        <div className="flex gap-2">
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger className="rounded-xl text-xs h-9 flex-1" data-testid="test-service-select">
              <SelectValue placeholder={isAr ? 'اختر خدمة' : 'Select service'} />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.systems?.name ? `${s.systems.name} → ` : ''}
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => mut.mutate()}
            disabled={!serviceId || mut.isPending}
            className="rounded-xl gap-1.5 h-9 text-xs"
            data-testid="run-test-btn"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {isAr ? 'تشغيل' : 'Run test'}
          </Button>
        </div>

        {result && (
          <Alert
            className={`rounded-xl ${
              result.success
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-destructive/30 bg-destructive/5'
            }`}
            data-testid="test-result"
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <AlertTitle className="text-xs flex items-center gap-2">
              {result.service_name}
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.approvals_created} {isAr ? 'مرحلة' : 'stages'}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-[11px] mt-1">
              {result.stages.length === 0 ? (
                <span>
                  {isAr
                    ? 'لم تتم مطابقة أي مرحلة. تحقق من القسم الافتراضي للخدمة وربطها بمراحل اعتماد.'
                    : 'No stages matched. Check the service default group and approval-stage links.'}
                </span>
              ) : (
                <div className="space-y-1 mt-1">
                  {result.stages.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">#{s.stage_order}</span>
                      <span className="font-semibold">{s.stage_name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
