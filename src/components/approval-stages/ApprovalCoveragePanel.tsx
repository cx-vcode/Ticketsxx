import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, FileWarning, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import {
  fetchServicesWithoutApprovalCoverage,
  fetchTicketsMissingApprovals,
  backfillTicketApprovals,
  backfillAllMissingApprovals,
} from '@/lib/api';

interface Props {
  isAr: boolean;
}

export function ApprovalCoveragePanel({ isAr }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [backfillingId, setBackfillingId] = useState<string | null>(null);

  const { data: uncoveredServices = [], isLoading: loadingServices, refetch: refetchServices } = useQuery({
    queryKey: ['approval-coverage-services'],
    queryFn: fetchServicesWithoutApprovalCoverage,
  });

  const { data: missingApprovals = [], isLoading: loadingMissing, refetch: refetchMissing } = useQuery({
    queryKey: ['tickets-missing-approvals'],
    queryFn: fetchTicketsMissingApprovals,
  });

  const backfillOneMut = useMutation({
    mutationFn: (ticketId: string) => backfillTicketApprovals(ticketId),
    onMutate: (id) => setBackfillingId(id),
    onSettled: () => setBackfillingId(null),
    onSuccess: (result) => {
      toast({
        title: isAr ? '✅ تم إنشاء الاعتمادات' : '✅ Approvals created',
        description: isAr
          ? `أُنشئت ${result.inserted_count} مرحلة من أصل ${result.matched_stages} متاحة`
          : `Created ${result.inserted_count} of ${result.matched_stages} matched stages`,
      });
      refetchMissing();
      queryClient.invalidateQueries({ queryKey: ['ticket-approvals-stats'] });
    },
    onError: (err: any) =>
      toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' }),
  });

  const backfillAllMut = useMutation({
    mutationFn: backfillAllMissingApprovals,
    onSuccess: (result) => {
      toast({
        title: isAr ? '✅ اكتمل الإصلاح الجماعي' : '✅ Bulk backfill complete',
        description: isAr
          ? `عولجت ${result.processed} تذكرة، أُنشئت ${result.total_inserted} سجل اعتماد`
          : `Processed ${result.processed} tickets, inserted ${result.total_inserted} approvals`,
      });
      refetchMissing();
      queryClient.invalidateQueries({ queryKey: ['ticket-approvals-stats'] });
    },
    onError: (err: any) =>
      toast({ title: '❌', description: sanitizeError(err), variant: 'destructive' }),
  });

  const isLoading = loadingServices || loadingMissing;
  const hasIssues = uncoveredServices.length > 0 || missingApprovals.length > 0;

  return (
    <Card className="rounded-2xl border-border/50 shadow-card mb-4" data-testid="coverage-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            {isAr ? 'تشخيص تغطية الاعتمادات' : 'Approval Coverage Diagnostics'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => {
              refetchServices();
              refetchMissing();
            }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasIssues ? (
          <Alert className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-emerald-700 dark:text-emerald-400">
              {isAr ? 'كل شيء على ما يرام' : 'All good'}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {isAr
                ? 'كل الخدمات النشطة لديها مراحل اعتماد، وكل التذاكر مرتبطة بسجلات الاعتماد المتوقعة.'
                : 'Every active service has approval stages, and all tickets are linked to expected approval records.'}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Uncovered Services */}
            {uncoveredServices.length > 0 && (
              <Alert variant="destructive" className="rounded-xl" data-testid="uncovered-services-alert">
                <FileWarning className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  {isAr ? 'خدمات بدون مراحل اعتماد' : 'Services without approval stages'}
                  <Badge variant="destructive" className="text-[10px]">
                    {uncoveredServices.length}
                  </Badge>
                </AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {uncoveredServices.map((s) => (
                      <div
                        key={s.service_id}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-background/50"
                      >
                        <div>
                          <span className="font-semibold">{s.service_name}</span>
                          {s.system_name && (
                            <span className="text-muted-foreground"> · {s.system_name}</span>
                          )}
                        </div>
                        {s.active_tickets_count > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {isAr ? 'تذاكر نشطة:' : 'Active tickets:'} {s.active_tickets_count}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-2 opacity-80">
                    {isAr
                      ? '💡 أضف مرحلة اعتماد جديدة واختر الخدمة المعنية من القائمة.'
                      : '💡 Add a new approval stage and select the service from the dropdown.'}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Tickets Missing Approvals */}
            {missingApprovals.length > 0 && (
              <Alert className="rounded-xl border-amber-500/30 bg-amber-500/5" data-testid="missing-approvals-alert">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  {isAr ? 'تذاكر بحاجة إصلاح' : 'Tickets needing backfill'}
                  <Badge variant="outline" className="text-[10px] border-amber-500/30">
                    {missingApprovals.length}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 text-[10px] gap-1 rounded-lg"
                    onClick={() => backfillAllMut.mutate()}
                    disabled={backfillAllMut.isPending}
                    data-testid="backfill-all-btn"
                  >
                    {backfillAllMut.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {isAr ? 'إصلاح الكل' : 'Backfill all'}
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  <p className="text-xs mb-2">
                    {isAr
                      ? 'تذاكر مفتوحة بدون سجلات اعتماد رغم وجود مراحل مطابقة:'
                      : 'Open tickets without approval records despite matching stages existing:'}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {missingApprovals.slice(0, 10).map((t) => (
                      <div
                        key={t.ticket_id}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-background/50"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-muted-foreground">#{t.ticket_number}</span>{' '}
                          <span className="font-semibold truncate">{t.ticket_title}</span>
                          {t.service_name && (
                            <span className="text-muted-foreground"> · {t.service_name}</span>
                          )}
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {t.expected_stages_count} {isAr ? 'مرحلة' : 'stages'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => backfillOneMut.mutate(t.ticket_id)}
                          disabled={backfillingId === t.ticket_id}
                        >
                          {backfillingId === t.ticket_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            isAr ? 'إصلاح' : 'Fix'
                          )}
                        </Button>
                      </div>
                    ))}
                    {missingApprovals.length > 10 && (
                      <p className="text-[10px] text-muted-foreground text-center pt-1">
                        {isAr
                          ? `+ ${missingApprovals.length - 10} تذكرة أخرى`
                          : `+ ${missingApprovals.length - 10} more tickets`}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
