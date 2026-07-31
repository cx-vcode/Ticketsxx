import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Lightbulb, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TicketSummaryData {
  problem_summary: string;
  actions_taken: string[];
  current_status: string;
  recommendations: string[];
  resolution_time_assessment?: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

const complexityConfig = {
  simple: { label: 'بسيطة', color: 'bg-success/15 text-success border-success/30' },
  moderate: { label: 'متوسطة', color: 'bg-warning/15 text-warning border-warning/30' },
  complex: { label: 'معقدة', color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function TicketSummary({ ticketId }: { ticketId: string }) {
  const [summary, setSummary] = useState<TicketSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-ticket', {
        body: { ticketId },
      });
      if (error) throw error;
      setSummary(data?.summary || null);
      setLoaded(true);
    } catch (e: any) {
      toast.error(e.message || 'خطأ في إنشاء الملخص');
    }
    setLoading(false);
  };

  if (!loaded) {
    return (
      <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading} className="gap-2 text-xs w-full">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        {loading ? 'جاري إنشاء الملخص...' : 'ملخص ذكي للتذكرة'}
      </Button>
    );
  }

  if (!summary) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
        <FileText className="h-3.5 w-3.5" />
        لا يمكن إنشاء ملخص لهذه التذكرة
      </div>
    );
  }

  const complexity = complexityConfig[summary.complexity];

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            ملخص ذكي
            <Badge variant="outline" className={`text-[10px] ${complexity.color}`}>
              {complexity.label}
            </Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <CardContent className="pt-0 px-4 pb-4 space-y-4">
              {/* Problem Summary */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  ملخص المشكلة
                </h4>
                <p className="text-sm leading-relaxed">{summary.problem_summary}</p>
              </div>

              {/* Actions Taken */}
              {summary.actions_taken.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    الإجراءات المتخذة
                  </h4>
                  <ul className="space-y-1">
                    {summary.actions_taken.map((action, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="text-xs text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        {action}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Current Status */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  الحالة الحالية
                </h4>
                <p className="text-xs text-muted-foreground">{summary.current_status}</p>
              </div>

              {/* Recommendations */}
              {summary.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    التوصيات
                  </h4>
                  <ul className="space-y-1">
                    {summary.recommendations.map((rec, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="text-xs flex items-start gap-1.5 bg-accent/5 rounded-lg p-2 border border-accent/10"
                      >
                        <Lightbulb className="h-3 w-3 text-accent shrink-0 mt-0.5" />
                        {rec}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.resolution_time_assessment && (
                <p className="text-[10px] text-muted-foreground/60 border-t pt-2">
                  تقييم وقت الحل: {summary.resolution_time_assessment}
                </p>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
