import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Lightbulb, BookOpen, History, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Suggestion {
  title: string;
  description: string;
  source: 'similar_ticket' | 'knowledge_base' | 'ai_generated';
  confidence: 'high' | 'medium' | 'low';
}

const sourceLabels: Record<string, { label: string; icon: typeof Lightbulb; color: string }> = {
  similar_ticket: { label: 'تذكرة مشابهة', icon: History, color: 'text-blue-600' },
  knowledge_base: { label: 'قاعدة المعرفة', icon: BookOpen, color: 'text-green-600' },
  ai_generated: { label: 'اقتراح ذكي', icon: Sparkles, color: 'text-purple-600' },
};

const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const confidenceLabels: Record<string, string> = {
  high: 'ثقة عالية',
  medium: 'ثقة متوسطة',
  low: 'ثقة منخفضة',
};

export function AiSuggestions({ ticketId }: { ticketId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-solutions', {
        body: { ticketId },
      });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
      setLoaded(true);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في جلب الاقتراحات');
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('تم النسخ');
  };

  if (!loaded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={fetchSuggestions}
        disabled={loading}
        className="gap-2 text-xs"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? 'جاري التحليل...' : 'اقتراحات ذكية'}
      </Button>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
        <Sparkles className="h-3.5 w-3.5" />
        لا توجد اقتراحات متاحة لهذه التذكرة
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            اقتراحات ذكية ({suggestions.length})
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <CardContent className="pt-0 px-4 pb-4 space-y-3">
              {suggestions.map((s, i) => {
                const src = sourceLabels[s.source] || sourceLabels.ai_generated;
                const Icon = src.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 rounded-lg bg-card border border-border/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${src.color} shrink-0`} />
                        <span className="text-sm font-medium">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={`text-[10px] ${confidenceColors[s.confidence]}`}>
                          {confidenceLabels[s.confidence]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(s.description, i)}
                        >
                          {copiedIndex === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.description}</p>
                    <div className="text-[10px] text-muted-foreground/60">
                      المصدر: {src.label}
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
