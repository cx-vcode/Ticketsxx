import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Zap, Edit2, Trash2, BookmarkPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_shared: boolean;
  created_by: string;
  created_at: string;
}

async function fetchCannedResponses() {
  const { data, error } = await supabase
    .from('canned_responses')
    .select('*')
    .order('category')
    .order('title');
  if (error) throw error;
  return data as CannedResponse[];
}

interface CannedResponsesProps {
  onSelect: (content: string) => void;
}

export function CannedResponsesPicker({ onSelect }: CannedResponsesProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: responses = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: fetchCannedResponses,
  });

  const filtered = responses.filter(r =>
    !search || r.title.includes(search) || r.content.includes(search) || r.shortcut?.includes(search)
  );

  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, CannedResponse[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl">
          <Zap className="h-3.5 w-3.5" />
          ردود جاهزة
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            الردود الجاهزة
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في الردود..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 rounded-xl"
          />
        </div>
        <div className="flex-1 overflow-auto space-y-4 mt-2">
          {Object.entries(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد ردود جاهزة</p>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{category}</p>
                <div className="space-y-1.5">
                  {items.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { onSelect(r.content); setOpen(false); }}
                      className="w-full text-right p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{r.title}</span>
                        {r.shortcut && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">/{r.shortcut}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Management page component
export function CannedResponsesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<CannedResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'عام', shortcut: '', is_shared: true });

  const { data: responses = [] } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: fetchCannedResponses,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('canned_responses').insert({
        ...form,
        shortcut: form.shortcut || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      setShowForm(false);
      setForm({ title: '', content: '', category: 'عام', shortcut: '', is_shared: true });
      toast({ title: 'تم إضافة الرد الجاهز' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const { error } = await supabase.from('canned_responses').update({
        title: form.title,
        content: form.content,
        category: form.category,
        shortcut: form.shortcut || null,
        is_shared: form.is_shared,
      }).eq('id', editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      setEditItem(null);
      setShowForm(false);
      toast({ title: 'تم تحديث الرد الجاهز' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('canned_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      toast({ title: 'تم حذف الرد الجاهز' });
    },
  });

  const openEdit = (r: CannedResponse) => {
    setEditItem(r);
    setForm({ title: r.title, content: r.content, category: r.category, shortcut: r.shortcut || '', is_shared: r.is_shared });
    setShowForm(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ title: '', content: '', category: 'عام', shortcut: '', is_shared: true });
    setShowForm(true);
  };

  const grouped = responses.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, CannedResponse[]>);

  return (
    <Card className="rounded-2xl border-border/50 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          الردود الجاهزة
        </CardTitle>
        <Button size="sm" className="gap-1.5 text-xs rounded-xl" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          إضافة
        </Button>
      </CardHeader>
      <CardContent>
        {Object.entries(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد ردود جاهزة بعد</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{category}</p>
                <div className="space-y-2">
                  <AnimatePresence>
                    {items.map(r => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start justify-between p-3 rounded-xl bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{r.title}</span>
                            {r.shortcut && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">/{r.shortcut}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{r.content}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mr-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editItem ? 'تعديل الرد' : 'إضافة رد جاهز'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">العنوان</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: ترحيب بالعميل" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">المحتوى</label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="محتوى الرد..." className="min-h-[100px] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">التصنيف</label>
                  <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="عام" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">الاختصار</label>
                  <Input value={form.shortcut} onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))} placeholder="مثال: welcome" className="rounded-xl font-mono" dir="ltr" />
                </div>
              </div>
              <Button
                className="w-full gradient-accent text-accent-foreground rounded-xl"
                disabled={!form.title.trim() || !form.content.trim()}
                onClick={() => editItem ? updateMutation.mutate() : createMutation.mutate()}
              >
                {editItem ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
