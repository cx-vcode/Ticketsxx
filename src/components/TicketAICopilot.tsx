import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Loader2, Lightbulb, CheckCircle2, Copy, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';

interface Props {
  ticketId: string;
  ticketTitle: string;
  ticketDescription: string;
  ticketStatus: string;
  comments: Array<{ content: string; author?: { full_name: string } }>;
}

interface AISuggestion {
  summary: string;
  rootCause: string;
  solutions: string[];
  nextSteps: string;
  priority_recommendation: string;
}

export const TicketAICopilot = memo(function TicketAICopilot({ ticketId, ticketTitle, ticketDescription, ticketStatus, comments }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const commentsText = comments.slice(-10).map(c => `${c.author?.full_name || 'User'}: ${c.content}`).join('\n');

      const { data, error } = await supabase.functions.invoke('suggest-solutions', {
        body: {
          ticketId,
          title: ticketTitle,
          description: ticketDescription,
          status: ticketStatus,
          comments: commentsText,
          mode: 'copilot',
        },
      });

      if (error) throw error;

      // Parse AI response
      if (data?.suggestions || data?.summary) {
        setSuggestion({
          summary: data.summary || data.suggestions?.summary || (isAr ? 'ملخص غير متوفر' : 'Summary not available'),
          rootCause: data.rootCause || data.suggestions?.rootCause || (isAr ? 'تحليل السبب الجذري غير متوفر' : 'Root cause analysis not available'),
          solutions: data.solutions || data.suggestions?.solutions || [],
          nextSteps: data.nextSteps || data.suggestions?.nextSteps || '',
          priority_recommendation: data.priority_recommendation || data.suggestions?.priority_recommendation || '',
        });
      } else {
        // Fallback - create structured response from raw text
        const rawText = typeof data === 'string' ? data : JSON.stringify(data);
        setSuggestion({
          summary: rawText.slice(0, 200),
          rootCause: isAr ? 'يتطلب مزيد من التحليل' : 'Requires further analysis',
          solutions: [rawText.slice(0, 150)],
          nextSteps: isAr ? 'مراجعة التذكرة والتواصل مع مقدم الطلب' : 'Review ticket and contact requester',
          priority_recommendation: '',
        });
      }
      setHasGenerated(true);
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'حدث خطأ في تحليل AI' : 'AI analysis error');
    } finally {
      setLoading(false);
    }
  }, [ticketId, ticketTitle, ticketDescription, ticketStatus, comments, isAr]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isAr ? 'تم النسخ' : 'Copied');
  };

  return (
    <Card className="rounded-2xl border-border/50 shadow-card hover:shadow-card-hover transition-shadow duration-300 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-accent/30 to-primary/10" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          {isAr ? 'مساعد AI للوكيل' : 'AI Agent Copilot'}
          <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ms-auto">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasGenerated ? (
          <Button
            onClick={generate}
            disabled={loading}
            variant="outline"
            className="w-full gap-2 rounded-xl text-xs h-9 border-dashed border-primary/30 text-primary hover:bg-primary/5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {isAr ? 'تحليل التذكرة وتقديم توصيات' : 'Analyze & Get Recommendations'}
          </Button>
        ) : (
          <AnimatePresence>
            {suggestion && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Summary */}
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isAr ? 'ملخص ذكي' : 'AI Summary'}</p>
                    <button onClick={() => copyToClipboard(suggestion.summary)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{suggestion.summary}</p>
                </div>

                {/* Root Cause */}
                <div className="rounded-xl bg-warning/5 border border-warning/15 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-warning">{isAr ? 'السبب الجذري المحتمل' : 'Probable Root Cause'}</p>
                  <p className="text-xs text-foreground leading-relaxed">{suggestion.rootCause}</p>
                </div>

                {/* Solutions */}
                {suggestion.solutions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="h-3 w-3 text-primary" />
                      {isAr ? 'الحلول المقترحة' : 'Suggested Solutions'}
                    </p>
                    {suggestion.solutions.map((sol, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: isAr ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 rounded-xl bg-success/5 border border-success/15 p-2.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{sol}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Next Steps */}
                {suggestion.nextSteps && (
                  <div className="rounded-xl bg-info/5 border border-info/15 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-info">{isAr ? 'الخطوات التالية' : 'Next Steps'}</p>
                    <p className="text-xs text-foreground leading-relaxed">{suggestion.nextSteps}</p>
                  </div>
                )}

                {/* Regenerate */}
                <Button
                  onClick={generate}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-[10px] rounded-xl h-7"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {isAr ? 'إعادة التحليل' : 'Re-analyze'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
});
