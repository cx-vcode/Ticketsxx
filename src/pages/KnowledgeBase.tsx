import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Search, Plus, Eye, ThumbsUp, Loader2, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '@/i18n';

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  views_count: number;
  helpful_count: number;
  author_id: string;
  service_id: string | null;
  created_at: string;
  updated_at: string;
}

type KBType = 'customer' | 'internal';

const categories = ['general', 'how-to', 'troubleshooting', 'faq', 'policy'];

export default function KnowledgeBase() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();
  const isStaff = role === 'admin' || role === 'agent';
  const isDeveloper = role === 'developer';

  const [activeTab, setActiveTab] = useState<KBType>(isStaff || isDeveloper ? 'internal' : 'customer');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '' });

  const categoryLabels: Record<string, string> = {
    general: t.admin.categoryLabels.general,
    'how-to': t.admin.categoryLabels.howTo,
    troubleshooting: t.admin.categoryLabels.troubleshooting,
    faq: t.admin.categoryLabels.faq,
    policy: t.admin.categoryLabels.policy,
  };

  const currentTable = activeTab === 'internal' ? 'internal_kb_articles' : 'knowledge_base_articles';
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['kb-articles', activeTab, search],
    queryFn: async () => {
      const table = activeTab === 'internal' ? 'internal_kb_articles' : 'knowledge_base_articles';
      let query = supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as KBArticle[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (article: typeof form) => {
      const { error } = await supabase.from(currentTable as any).insert({
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags.split(',').map(t => t.trim()).filter(Boolean),
        author_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
      setShowCreate(false);
      setForm({ title: '', content: '', category: 'general', tags: '' });
      toast({ title: t.common.success });
    },
    onError: () => toast({ title: t.common.error, variant: 'destructive' }),
  });

  const markHelpful = async (id: string) => {
    await supabase.rpc('increment_helpful' as any, { article_id: id }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['kb-articles'] });
    });
  };

  const filtered = articles.filter(a => catFilter === 'all' || a.category === catFilter);
  const canCreate = isStaff;

  const headerActions = canCreate ? (
    <Dialog open={showCreate} onOpenChange={setShowCreate}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-primary text-white gap-1.5 rounded-xl shadow-md shadow-primary/20">
          <Plus className="h-4 w-4" /> {t.admin.addArticle}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader><DialogTitle>{t.admin.addArticle} ({activeTab === 'internal' ? t.admin.internalKB : t.admin.customerKB})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder={t.admin.articleTitle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" />
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {categories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}
          </select>
          <Input placeholder={t.admin.articleTags} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="rounded-xl" />
          <Textarea rows={8} placeholder={t.admin.articleContent} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="rounded-xl" />
          <Button
            className="w-full gradient-primary text-white rounded-xl"
            disabled={!form.title || !form.content || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : undefined;

  const showTabs = isStaff || isDeveloper;

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.knowledgeBaseTitle}
        icon={<BookOpen className="h-5 w-5" />}
        actions={headerActions}
      />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Tabs for staff */}
          {showTabs && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as KBType); setCatFilter('all'); setSearch(''); }}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="internal" className="gap-1.5 rounded-lg">
                    <Lock className="h-3.5 w-3.5" />
                    {t.admin.internalKB}
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="gap-1.5 rounded-lg">
                    <BookOpen className="h-3.5 w-3.5" />
                    {t.admin.customerKB}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </motion.div>
          )}

          {/* Internal KB description */}
          {activeTab === 'internal' && showTabs && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-primary shrink-0" />
                {t.admin.internalKBDesc}
              </div>
            </motion.div>
          )}

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative">
              <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
              <Input
                placeholder={t.admin.searchArticles}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`${isRTL ? 'pr-11' : 'pl-11'} h-12 rounded-2xl text-base border-border/40 focus:border-primary/40`}
              />
            </div>
          </motion.div>

          {/* Category filter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-2 flex-wrap">
            <button onClick={() => setCatFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${catFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{t.common.all}</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${catFilter === c ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {categoryLabels[c]}
              </button>
            ))}
          </motion.div>

          {/* Articles */}
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-medium">{t.admin.noArticles}</p>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="group cursor-pointer rounded-2xl border-border/40 hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 overflow-hidden"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className={`h-0.5 w-0 bg-gradient-to-r ${activeTab === 'internal' ? 'from-warning to-accent' : 'from-primary to-accent'} group-hover:w-full transition-all duration-500`} />
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {activeTab === 'internal' && <Lock className="h-3.5 w-3.5 text-warning shrink-0" />}
                            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors duration-200">{article.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.content.slice(0, 150)}...</p>
                          <div className="flex items-center gap-3 mt-3">
                            <Badge variant="secondary" className="text-[10px] rounded-lg">{categoryLabels[article.category] || article.category}</Badge>
                            {article.tags?.map(tag => <Badge key={tag} variant="outline" className="text-[10px] rounded-lg">{tag}</Badge>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views_count}</span>
                          <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpful_count}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Article Detail Dialog */}
        <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
            {selectedArticle && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {activeTab === 'internal' && <Lock className="h-4 w-4 text-warning" />}
                    {selectedArticle.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex gap-2 mb-4">
                  <Badge variant="secondary" className="rounded-lg">{categoryLabels[selectedArticle.category]}</Badge>
                  {activeTab === 'internal' && <Badge variant="outline" className="rounded-lg text-warning border-warning/30">{t.admin.internalKB}</Badge>}
                  {selectedArticle.tags?.map(tg => <Badge key={tg} variant="outline" className="rounded-lg">{tg}</Badge>)}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
                </div>
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {selectedArticle.views_count} {t.admin.views}
                  </span>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => markHelpful(selectedArticle.id)}>
                    <ThumbsUp className="h-3.5 w-3.5" /> {t.admin.helpful} ({selectedArticle.helpful_count})
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </PageLayout>
  );
}
