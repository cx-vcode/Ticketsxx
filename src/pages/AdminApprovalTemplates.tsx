import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Sparkles, Layers, Clock, CheckCircle2, Wand2 } from 'lucide-react';
import {
  fetchApprovalTemplates,
  applyApprovalTemplate,
  fetchSystems,
  fetchServices,
  fetchDepartments,
  type ApprovalTemplate,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, { label: string; tone: string }> = {
  finance: { label: 'مالي', tone: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  technical: { label: 'تقني', tone: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  hr: { label: 'موارد بشرية', tone: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  general: { label: 'عام', tone: 'bg-muted text-muted-foreground border-border' },
};

export default function AdminApprovalTemplates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [applyTpl, setApplyTpl] = useState<ApprovalTemplate | null>(null);
  const [systemId, setSystemId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['approval-templates'],
    queryFn: fetchApprovalTemplates,
  });

  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: fetchSystems });
  const { data: services = [] } = useQuery({
    queryKey: ['services-by-system', systemId],
    queryFn: () => fetchServices(systemId),
    enabled: !!systemId,
  });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });

  const applyMut = useMutation({
    mutationFn: () => applyApprovalTemplate(applyTpl!.id, serviceId, departmentId),
    onSuccess: (r) => {
      toast({ title: 'تم التطبيق بنجاح', description: `أُضيفت ${r.inserted_stages} مرحلة وعُوّضت التذاكر المرتبطة` });
      qc.invalidateQueries();
      setApplyTpl(null);
      setSystemId(''); setServiceId(''); setDepartmentId('');
    },
    onError: (e: any) => toast({ title: 'فشل', description: sanitizeError(e), variant: 'destructive' }),
  });

  return (
    <PageLayout>
      <main className="flex-1 overflow-auto">
        <PageHeader
          icon={<Sparkles className="w-4 h-4" />}
          title="قوالب الاعتماد الجاهزة"
        />
        <p className="container mx-auto px-4 lg:px-6 pt-4 text-sm text-muted-foreground max-w-6xl">
          طبّق تدفقات اعتماد مُجهّزة على أي خدمة في ثوانٍ
        </p>

        <div className="container mx-auto px-4 lg:px-6 pb-10 max-w-6xl">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl, idx) => {
                const cat = categoryLabels[tpl.category] || categoryLabels.general;
                const stages = Array.isArray(tpl.stages) ? tpl.stages : [];
                return (
                  <motion.div
                    key={tpl.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="h-full hover:border-primary/40 transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <Badge variant="outline" className={cn('text-[10px]', cat.tone)}>{cat.label}</Badge>
                        </div>
                        <CardTitle className="text-base mt-3">{tpl.name}</CardTitle>
                        {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                          {stages.map((s: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">
                                {s.stage_order}
                              </div>
                              <span className="flex-1 truncate font-medium">{s.stage_name}</span>
                              {s.deadline_hours && (
                                <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
                                  <Clock className="w-3 h-3" />{s.deadline_hours}س
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="w-full gap-1.5" onClick={() => setApplyTpl(tpl)}>
                          <Wand2 className="w-3.5 h-3.5" /> تطبيق على خدمة
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!applyTpl} onOpenChange={(o) => !o && setApplyTpl(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تطبيق قالب: {applyTpl?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">النظام</Label>
                <Select value={systemId} onValueChange={(v) => { setSystemId(v); setServiceId(''); }}>
                  <SelectTrigger><SelectValue placeholder="اختر النظام..." /></SelectTrigger>
                  <SelectContent>
                    {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الخدمة</Label>
                <Select value={serviceId} onValueChange={setServiceId} disabled={!systemId}>
                  <SelectTrigger><SelectValue placeholder="اختر الخدمة..." /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">القسم المعتمد</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="اختر القسم..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                سيتم إنشاء {Array.isArray(applyTpl?.stages) ? applyTpl?.stages.length : 0} مرحلة وتعويض التذاكر المفتوحة لهذه الخدمة تلقائياً.
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setApplyTpl(null)}>إلغاء</Button>
              <Button onClick={() => applyMut.mutate()} disabled={!serviceId || !departmentId || applyMut.isPending}>
                {applyMut.isPending ? 'جاري التطبيق...' : 'تطبيق القالب'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </PageLayout>
  );
}
