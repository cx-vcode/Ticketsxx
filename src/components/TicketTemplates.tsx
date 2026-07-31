import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TicketPriority, priorityLabels } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: TicketPriority;
  is_shared: boolean;
}

interface Props {
  onSelect: (template: { title: string; description: string; priority: TicketPriority }) => void;
}

export function TicketTemplatesPicker({ onSelect }: Props) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');

  const isStaff = role === 'admin' || role === 'agent';

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ticket-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_templates')
        .select('id, name, title, description, priority, is_shared')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ticket_templates').insert({
        name: name.trim(),
        title: title.trim(),
        description: description.trim(),
        priority,
        created_by: user!.id,
        is_shared: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-templates'] });
      setShowCreate(false);
      setName(''); setTitle(''); setDescription(''); setPriority('medium');
      toast.success('تم إنشاء القالب');
    },
    onError: () => toast.error('خطأ في إنشاء القالب'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-templates'] });
      toast.success('تم حذف القالب');
    },
  });

  if (templates.length === 0 && !isStaff) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          قوالب جاهزة
        </p>
        {isStaff && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="h-3 w-3" /> إنشاء قالب
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {templates.map(t => (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect({ title: t.title, description: t.description, priority: t.priority })}
              className="group relative text-xs bg-muted/50 hover:bg-muted border border-border/50 rounded-lg px-3 py-2 text-start transition-colors"
            >
              <span className="font-medium">{t.name}</span>
              {isStaff && (
                <button
                  onClick={e => { e.stopPropagation(); deleteMutation.mutate(t.id); }}
                  className="absolute -top-1 -left-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء قالب تذكرة جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم القالب *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثل: مشكلة تسجيل دخول" />
            </div>
            <div className="space-y-2">
              <Label>عنوان التذكرة</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان التذكرة الافتراضي" />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف افتراضي..." className="min-h-[100px]" />
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['low', 'medium', 'high', 'urgent'] as TicketPriority[]).map(p => (
                    <SelectItem key={p} value={p}>{priorityLabels[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="w-full gap-2">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              إنشاء القالب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
