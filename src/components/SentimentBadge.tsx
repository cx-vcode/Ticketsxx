import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Meh, Frown, AlertTriangle, Flame, Loader2, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SentimentData {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent';
  satisfaction_score: number;
  needs_escalation: boolean;
  summary: string;
  key_emotions: string[];
}

const sentimentConfig = {
  positive: { label: 'إيجابي', icon: Smile, color: 'bg-success/15 text-success border-success/30' },
  neutral: { label: 'محايد', icon: Meh, color: 'bg-info/15 text-info border-info/30' },
  negative: { label: 'سلبي', icon: Frown, color: 'bg-warning/15 text-warning border-warning/30' },
  frustrated: { label: 'محبط', icon: AlertTriangle, color: 'bg-destructive/15 text-destructive border-destructive/30' },
  urgent: { label: 'عاجل', icon: Flame, color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function SentimentAnalysis({ title, description, comments }: {
  title: string;
  description: string;
  comments?: string[];
}) {
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { title, description, comments },
      });
      if (error) throw error;
      setSentiment(data?.sentiment || null);
      setLoaded(true);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في تحليل المشاعر');
    }
    setLoading(false);
  };

  if (!loaded) {
    return (
      <Button variant="outline" size="sm" onClick={analyze} disabled={loading} className="gap-1.5 text-xs">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        {loading ? 'جاري التحليل...' : 'تحليل المشاعر'}
      </Button>
    );
  }

  if (!sentiment) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Brain className="h-3.5 w-3.5" />
        لا يمكن تحليل المشاعر
      </span>
    );
  }

  const config = sentimentConfig[sentiment.sentiment];
  const Icon = config.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Badge
            variant="outline"
            className={`cursor-pointer text-xs gap-1 ${config.color}`}
          >
            <Icon className="h-3 w-3" />
            {config.label}
            {sentiment.needs_escalation && (
              <Flame className="h-3 w-3 text-destructive ml-1" />
            )}
          </Badge>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent className="w-72" dir="rtl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              تحليل المشاعر
            </h4>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < sentiment.satisfaction_score
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed">{sentiment.summary}</p>
          
          {sentiment.key_emotions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sentiment.key_emotions.map((emotion, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {emotion}
                </Badge>
              ))}
            </div>
          )}

          {sentiment.needs_escalation && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              يحتاج تدخل عاجل من المدير
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
