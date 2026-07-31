import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Timer, Play, Square, Plus, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeEntry {
  id: string;
  ticket_id: string;
  user_id: string;
  description: string | null;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  is_running: boolean;
  created_at: string;
}

async function fetchTimeEntries(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_time_entries')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TimeEntry[];
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} د`;
  return `${h} س ${m} د`;
}

function getElapsedMinutes(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
}

export function TimeTracker({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { data: entries = [] } = useQuery({
    queryKey: ['time-entries', ticketId],
    queryFn: () => fetchTimeEntries(ticketId),
  });

  const runningEntry = entries.find(e => e.is_running && e.user_id === user?.id);

  // Tick every minute for running timer
  useEffect(() => {
    if (!runningEntry?.started_at) { setElapsed(0); return; }
    setElapsed(getElapsedMinutes(runningEntry.started_at));
    const interval = setInterval(() => {
      setElapsed(getElapsedMinutes(runningEntry.started_at!));
    }, 60000);
    return () => clearInterval(interval);
  }, [runningEntry?.started_at]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ticket_time_entries').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        description: description || null,
        started_at: new Date().toISOString(),
        is_running: true,
        duration_minutes: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
      setDescription('');
      toast({ title: 'تم بدء تتبع الوقت' });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!runningEntry) return;
      const duration = getElapsedMinutes(runningEntry.started_at!);
      const { error } = await supabase.from('ticket_time_entries').update({
        is_running: false,
        ended_at: new Date().toISOString(),
        duration_minutes: Math.max(duration, 1),
      }).eq('id', runningEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
      toast({ title: 'تم إيقاف تتبع الوقت' });
    },
  });

  const addManualMutation = useMutation({
    mutationFn: async () => {
      const mins = parseInt(manualMinutes);
      if (isNaN(mins) || mins <= 0) throw new Error('أدخل وقت صحيح');
      const { error } = await supabase.from('ticket_time_entries').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        description: description || null,
        duration_minutes: mins,
        is_running: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
      setManualMinutes('');
      setDescription('');
      setShowManual(false);
      toast({ title: 'تم إضافة الوقت' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_time_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.is_running ? elapsed : e.duration_minutes), 0);

  return (
    <Card className="rounded-2xl border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            تتبع الوقت
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            الإجمالي: <span className="font-semibold text-foreground">{formatDuration(totalMinutes)}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Timer Controls */}
        {runningEntry ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <span className="text-sm font-semibold text-success">{formatDuration(elapsed)}</span>
              {runningEntry.description && (
                <span className="text-xs text-muted-foreground truncate">— {runningEntry.description}</span>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1 text-xs rounded-xl"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              <Square className="h-3 w-3" />
              إيقاف
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="وصف العمل (اختياري)..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5 text-xs rounded-xl flex-1 gradient-accent text-accent-foreground"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                <Play className="h-3 w-3" />
                بدء المؤقت
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs rounded-xl"
                onClick={() => setShowManual(!showManual)}
              >
                <Plus className="h-3 w-3" />
                يدوي
              </Button>
            </div>
          </div>
        )}

        {/* Manual Entry */}
        <AnimatePresence>
          {showManual && !runningEntry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-muted-foreground">المدة (بالدقائق)</label>
                  <Input
                    type="number"
                    min="1"
                    value={manualMinutes}
                    onChange={e => setManualMinutes(e.target.value)}
                    placeholder="30"
                    className="rounded-xl text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  className="rounded-xl text-xs"
                  disabled={!manualMinutes || addManualMutation.isPending}
                  onClick={() => addManualMutation.mutate()}
                >
                  إضافة
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entries List */}
        {entries.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {entries.filter(e => !e.is_running).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium">{formatDuration(e.duration_minutes)}</span>
                  {e.description && <span className="text-muted-foreground truncate">— {e.description}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(e.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
