import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Copy, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  ticketId: string;
  onSelectReply: (text: string) => void;
}

export function AiReplySuggestions({ ticketId, onSelectReply }: Props) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-reply', {
        body: { ticketId },
      });
      if (error) throw error;
      setReplies(data?.replies || []);
      setLoaded(true);
    } catch (e: any) {
      if (e?.message?.includes('429')) {
        toast.error('تم تجاوز حد الطلبات، حاول لاحقاً');
      } else if (e?.message?.includes('402')) {
        toast.error('يلزم إضافة رصيد للاستمرار');
      } else {
        toast.error('خطأ في جلب الاقتراحات');
      }
    }
    setLoading(false);
  };

  const handleUse = (text: string, index: number) => {
    onSelectReply(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('تم إدراج الرد');
  };

  if (!loaded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={fetchReplies}
        disabled={loading}
        className="gap-2 text-xs"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? 'جاري التحليل...' : 'اقتراح ردود ذكية'}
      </Button>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
        <Sparkles className="h-3.5 w-3.5" />
        لا توجد ردود مقترحة
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        ردود مقترحة بالذكاء الاصطناعي
      </p>
      <AnimatePresence>
        {replies.map((reply, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-3 rounded-lg border border-primary/20 bg-primary/[0.03] text-sm cursor-pointer hover:bg-primary/[0.06] transition-colors group"
            onClick={() => handleUse(reply, i)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs leading-relaxed whitespace-pre-wrap flex-1">{reply}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copiedIndex === i ? <Check className="h-3 w-3 text-success" /> : <MessageSquare className="h-3 w-3" />}
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
