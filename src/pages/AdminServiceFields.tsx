import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchServices, fetchServiceFields, createServiceField, deleteServiceField, ServiceField } from '@/lib/api';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { Plus, Trash2, Loader2, FormInput, Type, Hash, List, AlignLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const fieldTypeLabels: Record<string, string> = {
  text: 'نص قصير',
  number: 'رقم',
  select: 'قائمة اختيار',
  textarea: 'نص طويل',
};

const fieldTypeIcons: Record<string, any> = {
  text: Type,
  number: Hash,
  select: List,
  textarea: AlignLeft,
};

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function AdminServiceFields() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedService, setSelectedService] = useState('');
  const [open, setOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServices(),
  });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['service-fields', selectedService],
    queryFn: () => fetchServiceFields(selectedService || undefined),
    enabled: !!selectedService,
  });

  const createMut = useMutation({
    mutationFn: () => createServiceField({
      service_id: selectedService,
      field_name: fieldName.trim(),
      field_type: fieldType,
      options: fieldType === 'select' ? options.split('\n').map(o => o.trim()).filter(Boolean) : [],
      is_required: isRequired,
      sort_order: fields.length,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-fields'] });
      toast({ title: 'تم إضافة الحقل' });
      setOpen(false);
      setFieldName('');
      setFieldType('text');
      setIsRequired(false);
      setOptions('');
    },
    onError: (err: any) => {
      toast({ title: 'خطأ', description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteServiceField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-fields'] });
      toast({ title: 'تم حذف الحقل' });
    },
  });

  const newFieldDialog = selectedService && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-accent text-accent-foreground gap-1 text-xs shadow-sm rounded-lg">
          <Plus className="h-3.5 w-3.5" /> حقل جديد
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إضافة حقل مخصص</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>اسم الحقل *</Label>
            <Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="مثال: رقم الموظف" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label>نوع الحقل</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">نص قصير</SelectItem>
                <SelectItem value="number">رقم</SelectItem>
                <SelectItem value="select">قائمة اختيار</SelectItem>
                <SelectItem value="textarea">نص طويل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldType === 'select' && (
            <div className="space-y-2">
              <Label>الخيارات (كل سطر = خيار)</Label>
              <textarea
                value={options}
                onChange={e => setOptions(e.target.value)}
                placeholder={"الخيار الأول\nالخيار الثاني\nالخيار الثالث"}
                className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch id="required" checked={isRequired} onCheckedChange={setIsRequired} />
            <Label htmlFor="required" className="text-sm">حقل مطلوب</Label>
          </div>
          <Button
            className="w-full gradient-accent text-accent-foreground rounded-lg"
            disabled={!fieldName.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            إضافة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageLayout>
      <PageHeader
        title="محرر حقول الخدمات"
        actions={newFieldDialog}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
            <motion.div variants={pageVariants} initial="hidden" animate="visible" className="max-w-3xl mx-auto space-y-4">
              <motion.div variants={fadeUp} className="space-y-2">
                <Label>اختر الخدمة</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="max-w-sm rounded-xl">
                    <SelectValue placeholder="اختر خدمة لإدارة حقولها" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.systems?.name} → {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {!selectedService ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 text-muted-foreground">
                  <FormInput className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">اختر خدمة لعرض وإدارة حقولها المخصصة</p>
                </motion.div>
              ) : isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : fields.length === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 text-muted-foreground">
                  <FormInput className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium">لا توجد حقول مخصصة لهذه الخدمة</p>
                  <p className="text-xs mt-1">أضف حقلاً جديداً من الزر أعلاه</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, i) => {
                    const Icon = fieldTypeIcons[field.field_type] || Type;
                    return (
                      <motion.div key={field.id} variants={fadeUp} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                        <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                          <CardContent className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">{field.field_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{fieldTypeLabels[field.field_type]}</span>
                                  {field.is_required && (
                                    <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-lg">مطلوب</span>
                                  )}
                                  {field.field_type === 'select' && field.options?.length > 0 && (
                                    <span className="text-xs text-muted-foreground">({field.options.length} خيارات)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => deleteMut.mutate(field.id)} disabled={deleteMut.isPending}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
      </main>
    </PageLayout>
  );
}
