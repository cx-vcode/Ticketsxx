import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Search, ListFilter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TicketListItem } from '@/components/TicketListItem';
import { DashboardSkeleton } from '@/components/SkeletonLoaders';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n';
import { TicketStatus, Ticket } from '@/lib/api';

interface Props {
  tickets: Ticket[];
  ticketsLoading: boolean;
  statusFilter: TicketStatus | 'all';
  setStatusFilter: (v: TicketStatus | 'all') => void;
  statusFilters: { label: string; value: TicketStatus | 'all' }[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  deptFilter: string;
  setDeptFilter: (v: string) => void;
  departments: any[];
  isAdmin: boolean;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

const listItem = {
  hidden: { opacity: 0, x: 16, filter: 'blur(3px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export const DashboardTicketList = memo(function DashboardTicketList({
  tickets, ticketsLoading, statusFilter, setStatusFilter, statusFilters,
  searchQuery, setSearchQuery, deptFilter, setDeptFilter, departments, isAdmin,
}: Props) {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-card"
    >
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center gap-2 mb-3">
          <ListFilter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{lang === 'ar' ? 'التذاكر' : 'Tickets'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
            {tickets.length}
          </span>
        </div>

        {/* Mobile search */}
        <div className="flex items-center gap-3 mb-3 md:hidden">
          <div className="relative flex-1">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.tickets.searchTickets}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ltr:pl-9 rtl:pr-9 rounded-xl"
            />
          </div>
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Department filters */}
        {isAdmin && departments.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            <button
              onClick={() => setDeptFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${deptFilter === 'all' ? 'bg-accent text-accent-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
            >{t.common.all}</button>
            {departments.map(d => (
              <button
                key={d.id}
                onClick={() => setDeptFilter(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${deptFilter === d.id ? 'bg-accent text-accent-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
              >{d.name}</button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {ticketsLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DashboardSkeleton />
          </motion.div>
        ) : tickets.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 opacity-30" />
            </div>
            <p className="font-medium">{t.dashboard.noTickets}</p>
          </motion.div>
        ) : (
          <motion.div key="list" variants={staggerContainer} initial="hidden" animate="visible" className="divide-y divide-border/40">
            {tickets.map((ticket, i) => (
              <motion.div key={ticket.id} variants={listItem}>
                <TicketListItem ticket={ticket} index={i} onClick={() => navigate(`/tickets/${ticket.id}`)} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
