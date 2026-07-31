import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchDepartments, fetchServices, TicketStatus, TicketPriority } from '@/lib/api';
import { PageLayout, PageHeader } from '@/components/layout';
import { TicketListItem } from '@/components/TicketListItem';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Inbox, Filter, CalendarDays, Plus, X, Bookmark, LayoutGrid, List, TableProperties, Keyboard } from 'lucide-react';
import { TicketListSkeleton, InboxSkeleton } from '@/components/SkeletonLoaders';
import { EmptyState, ErrorState } from '@/components/common';
import { TicketTableView } from '@/components/TicketTableView';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const allStatuses: TicketStatus[] = ['new', 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'reopened'];
const allPriorities: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const staggerList = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, x: 15 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

interface SavedFilter {
  name: string;
  status: TicketStatus | 'all';
  priority: TicketPriority | 'all';
}

export default function TicketsInbox() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLanguage();
  const { statusLabels, priorityLabels } = useLocalizedLabels();
  const dateLocale = lang === 'ar' ? ar : enUS;

  useRealtimeTickets();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'kanban'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ticket-saved-filters') || '[]');
    } catch { return []; }
  });

  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServices(),
  });

  const isAgentOrAdmin = role === 'agent' || role === 'admin' || role === 'developer';

  const applyFilters = (list: typeof tickets) => {
    return list.filter((t) => {
      const matchesSearch = !searchQuery || t.title.includes(searchQuery) || t.ticket_number.toString().includes(searchQuery) || t.code?.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesDateFrom = !dateFrom || !isBefore(new Date(t.created_at), startOfDay(dateFrom));
      const matchesDateTo = !dateTo || !isAfter(new Date(t.created_at), endOfDay(dateTo));
      return matchesSearch && matchesStatus && matchesPriority && matchesDateFrom && matchesDateTo;
    });
  };

  const unassigned = useMemo(() => applyFilters(tickets.filter(t => !t.assigned_agent_id)), [tickets, searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);
  const assignedToMe = useMemo(() => applyFilters(tickets.filter(t => t.assigned_agent_id === user?.id)), [tickets, user, searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);
  
  const byDepartment = useMemo(() => {
    const filtered = applyFilters(tickets);
    const map: Record<string, typeof tickets> = {};
    filtered.forEach(tk => {
      const key = tk.departments?.name || '__none__';
      if (!map[key]) map[key] = [];
      map[key].push(tk);
    });
    return map;
  }, [tickets, searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);

  const byService = useMemo(() => {
    const filtered = applyFilters(tickets);
    const map: Record<string, typeof tickets> = {};
    filtered.forEach(tk => {
      const svcName = tk.services ? `${tk.services.systems?.name || ''} → ${tk.services.name}` : '__none__';
      if (!map[svcName]) map[svcName] = [];
      map[svcName].push(tk);
    });
    return map;
  }, [tickets, searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);

  const allFiltered = useMemo(() => applyFilters(tickets), [tickets, searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);

  const activeFiltersCount = [statusFilter !== 'all', priorityFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length;

  const saveCurrentFilter = () => {
    const name = `${t.tickets.filter} ${savedFilters.length + 1}`;
    const newFilter: SavedFilter = { name, status: statusFilter, priority: priorityFilter };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('ticket-saved-filters', JSON.stringify(updated));
  };

  const applySavedFilter = (filter: SavedFilter) => {
    setStatusFilter(filter.status);
    setPriorityFilter(filter.priority);
  };

  const removeSavedFilter = (index: number) => {
    const updated = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(updated);
    localStorage.setItem('ticket-saved-filters', JSON.stringify(updated));
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchQuery('');
  };

  // Reset highlighted row when filters/search change
  useEffect(() => { setActiveIndex(-1); }, [searchQuery, statusFilter, priorityFilter, dateFrom, dateTo]);

  // Global keyboard shortcuts: '/' focus search, 'j'/'k' navigate, 'Enter' open, 'Esc' clear
  const visibleListRef = useRef<typeof tickets>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (isTyping && target !== searchInputRef.current) return;
      const list = visibleListRef.current;
      if (!list || list.length === 0) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (isTyping && target !== searchInputRef.current) return;
        e.preventDefault();
        setActiveIndex((i) => Math.min((i < 0 ? -1 : i) + 1, list.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (isTyping && target !== searchInputRef.current) return;
        e.preventDefault();
        setActiveIndex((i) => Math.max((i < 0 ? 0 : i) - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        const tk = list[activeIndex];
        if (tk) navigate(`/tickets/${tk.id}`);
      } else if (e.key === 'Escape') {
        if (searchQuery) { setSearchQuery(''); }
        setActiveIndex(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, searchQuery, navigate]);

  // Auto-scroll active row into view
  useEffect(() => {
    if (activeIndex < 0 || !listContainerRef.current) return;
    const rows = listContainerRef.current.querySelectorAll('[data-ticket-row]');
    const el = rows[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const renderList = (list: typeof tickets) => {
    visibleListRef.current = list;
    if (isLoading) {
      return <TicketListSkeleton count={6} />;
    }
    if (isError) {
      return <ErrorState onRetry={() => refetch()} className="py-16" />;
    }
    if (list.length === 0) {
      const hasFilters = activeFiltersCount > 0 || !!searchQuery;
      return (
        <EmptyState
          icon={Inbox}
          title={t.tickets.noTicketsFound}
          description={
            hasFilters
              ? (isRTL ? 'جرّب تعديل عوامل التصفية أو مسحها للعرض الكامل.' : 'Try adjusting or clearing your filters to see more results.')
              : (isRTL ? 'ابدأ بإنشاء أول تذكرة.' : 'Start by creating your first ticket.')
          }
          action={
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 h-8 text-xs">
                  <X className="h-3.5 w-3.5" />{t.tickets.clearCount} ({activeFiltersCount + (searchQuery ? 1 : 0)})
                </Button>
              )}
              <Button size="sm" onClick={() => navigate('/tickets/new')} className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />{t.tickets.createNewTicket}
              </Button>
            </div>
          }
        />
      );
    }
    if (viewMode === 'table') {
      return (
        <TicketTableView
          tickets={list}
          onTicketClick={(id) => navigate(`/tickets/${id}`)}
          page={currentPage}
          onPageChange={setCurrentPage}
        />
      );
    }
    return (
      <motion.div ref={listContainerRef} variants={staggerList} initial="hidden" animate="visible" className="divide-y divide-border/50">
        {list.map((ticket, i) => (
          <motion.div key={ticket.id} variants={listItem}>
            <TicketListItem ticket={ticket} index={i} highlight={searchQuery} active={i === activeIndex} onClick={() => navigate(`/tickets/${ticket.id}`)} />
          </motion.div>
        ))}
      </motion.div>
    );
  };

  const FiltersBar = () => (
    <motion.div variants={fadeUp} className="px-3 sm:px-4 py-2.5 border-b border-border/40 space-y-2 bg-muted/30 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors ${searchQuery ? 'text-primary' : ''}`} />
          <Input
            ref={searchInputRef}
            placeholder={t.tickets.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`${isRTL ? 'pr-8 pl-20' : 'pl-8 pr-20'} h-8 rounded-md border-border/60 bg-background text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40`}
          />
          <div className={`absolute ${isRTL ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 flex items-center gap-1`}>
            {searchQuery ? (
              <>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded tabular-nums">
                  {allFiltered.length}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <kbd className="hidden md:inline-flex items-center text-[10px] font-mono font-medium text-muted-foreground/80 bg-muted border border-border/60 rounded px-1.5 py-0.5 cursor-help">/</kbd>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">
                    <div className="space-y-0.5">
                      <div>{isRTL ? 'اضغط / للبحث' : 'Press / to search'}</div>
                      <div>{isRTL ? 'J / K للتنقل' : 'J / K to navigate'}</div>
                      <div>{isRTL ? 'Enter للفتح' : 'Enter to open'}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-32 h-8 rounded-md border-border/60 bg-background text-xs">
            <SelectValue placeholder={t.tickets.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.tickets.allStatuses}</SelectItem>
            {allStatuses.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
          <SelectTrigger className="w-28 h-8 rounded-md border-border/60 bg-background text-xs">
            <SelectValue placeholder={t.tickets.priority.low} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.tickets.allPriorities}</SelectItem>
            {allPriorities.map(p => <SelectItem key={p} value={p}>{priorityLabels[p]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-md border-border/60 bg-background">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, 'dd/MM', { locale: dateLocale }) : t.common.from}
              {' - '}
              {dateTo ? format(dateTo, 'dd/MM', { locale: dateLocale }) : t.common.to}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t.common.fromDate}</p>
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={dateLocale} />
              <p className="text-xs font-medium text-muted-foreground">{t.common.toDate}</p>
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={dateLocale} />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  {t.common.clearDates}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs rounded-md text-muted-foreground hover:text-foreground" onClick={saveCurrentFilter}>
          <Bookmark className="h-3.5 w-3.5" />
          {t.tickets.filters.saveFilter}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs text-destructive" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            {t.tickets.clearCount} ({activeFiltersCount})
          </Button>
        )}
      </div>

      {savedFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">{t.tickets.savedFiltersLabel}</span>
          {savedFilters.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1">
              <button className="text-[10px] font-medium" onClick={() => applySavedFilter(f)}>{f.name}</button>
              <button onClick={() => removeSavedFilter(i)} className="hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  const defaultTab = isAgentOrAdmin ? 'unassigned' : 'my';

  const headerActions = (
    <>
      {isAgentOrAdmin && (
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 border border-border/40">
          <button onClick={() => { setViewMode('list'); setCurrentPage(1); }} className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-label="List view">
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setViewMode('table'); setCurrentPage(1); }} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Table view">
            <TableProperties className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Kanban view">
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Button size="sm" className="bg-primary text-primary-foreground gap-1.5 text-xs rounded-md hover:bg-primary/90 transition-colors h-8" onClick={() => navigate('/tickets/new')}>
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t.tickets.createNewTicket}</span>
      </Button>
    </>
  );

  const liveBadge = (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-[10px] text-success font-medium hidden sm:inline">{t.common.live}</span>
    </div>
  );

  const isInitialLoad = isLoading && tickets.length === 0;

  return (
    <PageLayout>
      <PageHeader
        title={t.tickets.inbox}
        icon={<Inbox className="h-5 w-5" />}
        badge={liveBadge}
        actions={headerActions}
      />

          <main className="flex-1 overflow-auto">
            {isInitialLoad ? <InboxSkeleton /> : (
            <motion.div
              variants={pageVariants}
              initial="hidden"
              animate="visible"
            >
              {viewMode === 'kanban' && isAgentOrAdmin ? (
                <motion.div variants={fadeUp} className="p-4 md:p-6">
                  <KanbanBoard tickets={allFiltered} isAdmin={isAgentOrAdmin} />
                </motion.div>
              ) : (
              <Tabs defaultValue={defaultTab} className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
                <motion.div variants={fadeUp} className="border-b border-border/50 bg-card/60 backdrop-blur-sm px-4">
                  <TabsList className="bg-transparent h-auto p-0 gap-0">
                    {isAgentOrAdmin && (
                      <TabsTrigger value="unassigned" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm transition-all duration-200">
                        {t.tickets.unassigned}
                        <span className={`${isRTL ? 'mr-1.5' : 'ml-1.5'} bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium`}>{unassigned.length}</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="my" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm transition-all duration-200">
                      {isAgentOrAdmin ? t.tickets.assignedToMe : t.sidebar.myTickets}
                      <span className={`${isRTL ? 'mr-1.5' : 'ml-1.5'} bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium`}>{assignedToMe.length}</span>
                    </TabsTrigger>
                    {isAgentOrAdmin && (
                      <TabsTrigger value="department" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm transition-all duration-200">
                        {t.tickets.byDepartment}
                        <span className={`${isRTL ? 'mr-1.5' : 'ml-1.5'} bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium`}>{Object.keys(byDepartment).length}</span>
                      </TabsTrigger>
                    )}
                    {isAgentOrAdmin && (
                      <TabsTrigger value="service" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm transition-all duration-200">
                        {t.tickets.byService}
                        <span className={`${isRTL ? 'mr-1.5' : 'ml-1.5'} bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium`}>{Object.keys(byService).length}</span>
                      </TabsTrigger>
                    )}
                    {role === 'admin' && (
                      <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm transition-all duration-200">
                        {t.common.all}
                        <span className={`${isRTL ? 'mr-1.5' : 'ml-1.5'} bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium`}>{allFiltered.length}</span>
                      </TabsTrigger>
                    )}
                  </TabsList>
                </motion.div>

                <motion.div variants={fadeUp} className="rounded-xl border border-border/50 bg-card mx-3 sm:mx-4 md:mx-6 my-3 sm:my-4 flex-1 flex flex-col overflow-hidden shadow-sm">
                  <FiltersBar />

                  {isAgentOrAdmin && (
                    <TabsContent value="unassigned" className="m-0 flex-1">
                      {renderList(unassigned)}
                    </TabsContent>
                  )}

                  <TabsContent value="my" className="m-0 flex-1">
                    {renderList(assignedToMe)}
                  </TabsContent>

                  {isAgentOrAdmin && (
                    <TabsContent value="department" className="m-0 flex-1">
                      {isLoading ? (
                        <TicketListSkeleton count={4} />
                      ) : Object.keys(byDepartment).length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Inbox className="h-12 w-12 mb-3 opacity-30" />
                          <p className="font-medium">{t.tickets.noTicketsFound}</p>
                        </motion.div>
                      ) : (
                        <motion.div variants={staggerList} initial="hidden" animate="visible" className="divide-y divide-border/50">
                          {Object.entries(byDepartment).map(([dept, deptTickets]) => (
                            <motion.div key={dept} variants={listItem}>
                              <div className="px-4 py-2.5 bg-muted/30 sticky top-0 backdrop-blur-sm border-b border-border/30">
                                <span className="text-sm font-semibold text-foreground">{dept === '__none__' ? t.tickets.noDepartment : dept}</span>
                                <span className={`text-xs text-muted-foreground ${isRTL ? 'mr-2' : 'ml-2'} bg-primary/10 text-primary px-2 py-0.5 rounded-full`}>({deptTickets.length})</span>
                              </div>
                              {deptTickets.map((ticket, i) => (
                                <TicketListItem key={ticket.id} ticket={ticket} index={i} highlight={searchQuery} onClick={() => navigate(`/tickets/${ticket.id}`)} />
                              ))}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </TabsContent>
                  )}

                  {isAgentOrAdmin && (
                    <TabsContent value="service" className="m-0 flex-1">
                      {isLoading ? (
                        <TicketListSkeleton count={4} />
                      ) : Object.keys(byService).length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Inbox className="h-12 w-12 mb-3 opacity-30" />
                          <p className="font-medium">{t.tickets.noTicketsFound}</p>
                        </motion.div>
                      ) : (
                        <motion.div variants={staggerList} initial="hidden" animate="visible" className="divide-y divide-border/50">
                          {Object.entries(byService).map(([svc, svcTickets]) => (
                            <motion.div key={svc} variants={listItem}>
                              <div className="px-4 py-2.5 bg-muted/30 sticky top-0 backdrop-blur-sm border-b border-border/30">
                                <span className="text-sm font-semibold text-foreground">{svc === '__none__' ? t.tickets.noService : svc}</span>
                                <span className={`text-xs text-muted-foreground ${isRTL ? 'mr-2' : 'ml-2'} bg-primary/10 text-primary px-2 py-0.5 rounded-full`}>({svcTickets.length})</span>
                              </div>
                              {svcTickets.map((ticket, i) => (
                                <TicketListItem key={ticket.id} ticket={ticket} index={i} highlight={searchQuery} onClick={() => navigate(`/tickets/${ticket.id}`)} />
                              ))}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </TabsContent>
                  )}

                  {role === 'admin' && (
                    <TabsContent value="all" className="m-0 flex-1">
                      {renderList(allFiltered)}
                    </TabsContent>
                  )}
                </motion.div>
              </Tabs>
              )}
            </motion.div>
            )}
          </main>
    </PageLayout>
  );
}
