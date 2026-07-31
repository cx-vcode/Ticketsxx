import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, Loader2, ArrowRight, X, Brain, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  ticket_number: number;
  title: string;
  status: string;
  priority: string;
  requester?: { full_name: string };
  agent?: { full_name: string };
}

export const AICopilotWidget = memo(function AICopilotWidget() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setShowResults(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query: query.trim(), type: 'search' },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Rate limit')) toast.error(lang === 'ar' ? 'تم تجاوز الحد المسموح، حاول لاحقاً' : 'Rate limited, try again later');
        else throw new Error(data.error);
        return;
      }

      setResults(data?.results || []);
      setInterpretation(data?.interpretation || '');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'ar' ? 'حدث خطأ في البحث' : 'Search error');
    } finally {
      setLoading(false);
    }
  }, [query, lang]);

  const suggestions = lang === 'ar'
    ? ['التذاكر المتأخرة', 'التذاكر العاجلة المفتوحة', 'التذاكر بدون وكيل', 'تذاكر آخر 24 ساعة']
    : ['Overdue tickets', 'Open urgent tickets', 'Unassigned tickets', 'Last 24h tickets'];

  const statusColors: Record<string, string> = {
    new: 'bg-primary/10 text-primary',
    open: 'bg-info/10 text-info',
    in_progress: 'bg-warning/10 text-warning',
    resolved: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl bg-card border border-border/50 overflow-hidden hover:shadow-card-hover transition-shadow duration-300"
    >
      {/* Header */}
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">{lang === 'ar' ? 'المساعد الذكي' : 'AI Copilot'}</h3>
          <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Wand2 className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={lang === 'ar' ? 'اسأل بلغة طبيعية... مثال: "أرني التذاكر المتأخرة"' : 'Ask in natural language... e.g. "Show overdue tickets"'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="ltr:pl-10 rtl:pr-10 ltr:pr-20 rtl:pl-20 h-10 rounded-xl bg-muted/50 border-border/50 text-xs focus:ring-1 focus:ring-primary/30"
          />
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="absolute ltr:right-1.5 rtl:left-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-lg text-[10px] gradient-primary text-primary-foreground"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          </Button>
        </div>

        {/* Quick suggestions */}
        {!showResults && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setQuery(s); }}
                className="text-[10px] px-2 py-1 rounded-lg bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {interpretation && (
              <div className="px-4 pt-3 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {interpretation}
                </p>
                <button onClick={() => { setShowResults(false); setResults([]); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-2">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
              ) : (
                results.slice(0, 5).map((r) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/tickets/${r.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-start group"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground">#{r.ticket_number}</span>
                    <span className="text-xs font-medium text-foreground flex-1 truncate group-hover:text-primary transition-colors">{r.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${statusColors[r.status] || ''}`}>{r.status}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                  </motion.button>
                ))
              )}
            </div>

            {results.length > 5 && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-muted-foreground text-center">
                  +{results.length - 5} {lang === 'ar' ? 'نتائج أخرى' : 'more results'}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
