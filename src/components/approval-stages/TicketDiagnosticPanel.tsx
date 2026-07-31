import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Search, Stethoscope, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { diagnoseTicketApprovals, findTicketByNumber, type TicketApprovalDiagnostics } from '@/lib/api';

interface Props {
  isAr: boolean;
}

export function TicketDiagnosticPanel({ isAr }: Props) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TicketApprovalDiagnostics | null>(null);

  const mut = useMutation({
    mutationFn: async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) throw new Error(isAr ? 'أدخل رقم أو معرّف تذكرة' : 'Enter a ticket number or ID');
      let ticketId = trimmed;
      // If numeric, look up by ticket_number
      if (/^\d+$/.test(trimmed)) {
        const id = await findTicketByNumber(parseInt(trimmed, 10));
        if (!id) throw new Error(isAr ? 'لم يتم العثور على تذكرة بهذا الرقم' : 'No ticket found with this number');
        ticketId = id;
      }
      return diagnoseTicketApprovals(ticketId);
    },
    onSuccess: (data) => {
      if ((data as any).error) {
        toast({ title: '⚠️', description: (data as any).error, variant: 'destructive' });
        setResult(null);
      } else {
        setResult(data);
      }
    },
    onError: (err: any) => {
      toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' });
      setResult(null);
    },
  });

  const reasonLabel = (r: string) =>
    isAr
      ? r === 'service_match'
        ? 'مطابقة بالخدمة'
        : r === 'department_match'
        ? 'مطابقة بالقسم'
        : r === 'system_match'
        ? 'مطابقة بالنظام'
        : r
      : r.replace('_', ' ');

  return (
    <Card className="rounded-2xl border-border/50 shadow-card mb-4" data-testid="ticket-diagnostic-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          {isAr ? 'تشخيص اعتمادات تذكرة محددة' : 'Diagnose specific ticket approvals'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAr ? 'رقم التذكرة (مثل 1234) أو UUID' : 'Ticket number (e.g. 1234) or UUID'}
            className="rounded-xl text-sm h-9"
            onKeyDown={(e) => e.key === 'Enter' && mut.mutate(input)}
            data-testid="diagnose-input"
          />
          <Button
            onClick={() => mut.mutate(input)}
            disabled={mut.isPending || !input.trim()}
            className="rounded-xl gap-1.5 h-9 text-xs"
            data-testid="diagnose-btn"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {isAr ? 'تشخيص' : 'Diagnose'}
          </Button>
        </div>

        {result && (
          <div className="space-y-2" data-testid="diagnose-result">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="text-xs">
                <span className="font-mono text-muted-foreground">#{result.ticket_number}</span>{' '}
                <span className="font-semibold">{result.ticket_title}</span>
              </div>
              <Badge variant={result.existing_approvals_count > 0 ? 'default' : 'destructive'}>
                {result.existing_approvals_count} {isAr ? 'اعتماد موجود' : 'approvals'}
              </Badge>
            </div>

            {/* Match summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <MatchCell label={isAr ? 'بالخدمة' : 'Service'} value={result.service_match_count} />
              <MatchCell label={isAr ? 'بالقسم' : 'Department'} value={result.department_match_count} />
              <MatchCell label={isAr ? 'بالنظام' : 'System'} value={result.system_match_count} />
              <MatchCell
                label={isAr ? 'تخطّيات شرطية' : 'Skipped'}
                value={result.skipped_by_conditions_count}
                tone="warning"
              />
            </div>

            {/* Context fields */}
            <div className="text-xs space-y-1 p-2 rounded-lg bg-background border border-border/50">
              <Row label={isAr ? 'الخدمة' : 'Service'} value={result.service_name || '—'} />
              <Row
                label={isAr ? 'القسم المباشر' : 'Direct dept'}
                value={result.department_id || (isAr ? 'فارغ' : 'empty')}
              />
              <Row
                label={isAr ? 'القسم المشتق' : 'Derived dept'}
                value={result.derived_department_id || (isAr ? 'فارغ' : 'empty')}
              />
              <Row
                label={isAr ? 'الخدمة لها قسم افتراضي' : 'Service has default group'}
                value={
                  result.service_has_default_group ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {isAr ? 'نعم' : 'Yes'}
                    </span>
                  ) : (
                    <span className="text-destructive inline-flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> {isAr ? 'لا' : 'No'}
                    </span>
                  )
                }
              />
            </div>

            {/* Verdict */}
            {result.total_potential_matches === 0 ? (
              <Alert variant="destructive" className="rounded-xl">
                <XCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">
                  {isAr ? 'لا توجد أي مرحلة مطابقة' : 'No matching stages at all'}
                </AlertTitle>
                <AlertDescription className="text-[11px] space-y-0.5">
                  {!result.service_has_default_group && (
                    <p>
                      •{' '}
                      {isAr
                        ? 'الخدمة بدون default_assignment_group — أضف قسم افتراضي من /admin/services.'
                        : 'Service has no default_assignment_group — set a default department in /admin/services.'}
                    </p>
                  )}
                  <p>
                    •{' '}
                    {isAr
                      ? 'أنشئ مرحلة اعتماد مرتبطة بهذه الخدمة أو بقسمها الافتراضي.'
                      : 'Create an approval stage linked to this service or its department.'}
                  </p>
                </AlertDescription>
              </Alert>
            ) : result.existing_approvals_count === 0 ? (
              <Alert className="rounded-xl border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs text-amber-700 dark:text-amber-400">
                  {isAr ? 'مراحل مطابقة موجودة لكن لم تُنشأ السجلات' : 'Matches exist but records were not created'}
                </AlertTitle>
                <AlertDescription className="text-[11px]">
                  {isAr
                    ? 'استخدم "Backfill" لإنشاء السجلات يدويًا، أو افحص شروط التخطي إذا كان العدد كله مُتخطّى.'
                    : 'Use "Backfill" to insert records manually, or check skip conditions if all matches are skipped.'}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-xs text-emerald-700 dark:text-emerald-400">
                  {isAr ? 'الاعتمادات منشأة بشكل صحيح' : 'Approvals created correctly'}
                </AlertTitle>
              </Alert>
            )}

            {/* Matched stages list */}
            {result.matched_stages.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-semibold">
                  {isAr ? 'المراحل المطابقة:' : 'Matched stages:'}
                </p>
                {result.matched_stages.map((s) => (
                  <div
                    key={s.stage_id}
                    className="flex items-center justify-between text-[11px] p-1.5 rounded bg-background border border-border/30"
                  >
                    <div>
                      <span className="font-mono text-muted-foreground">#{s.stage_order}</span>{' '}
                      <span className="font-semibold">{s.stage_name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {reasonLabel(s.match_reason)}
                      </Badge>
                      {s.will_skip && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-700">
                          {isAr ? 'سيُتخطّى' : 'skipped'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchCell({ label, value, tone }: { label: string; value: number; tone?: 'warning' }) {
  const colorClass =
    value === 0
      ? 'bg-muted/30 text-muted-foreground'
      : tone === 'warning'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      : 'bg-primary/10 text-primary';
  return (
    <div className={`p-2 rounded-lg ${colorClass}`}>
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono text-[11px] truncate max-w-[60%]">{value}</span>
    </div>
  );
}
