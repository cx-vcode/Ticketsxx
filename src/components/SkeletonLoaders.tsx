import { Skeleton } from "@/components/ui/skeleton";
import { motion, useReducedMotion } from "framer-motion";

/* ─── Internal helpers ─────────────────────────────────────────────── */

function ShimmerBar({ className }: { className?: string }) {
  return <Skeleton className={`shimmer ${className || ''}`} />;
}

function FadeWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
});

/* ─── Dashboard ────────────────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <FadeWrap className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <ShimmerBar className="h-8 w-64" />
          <ShimmerBar className="h-3.5 w-40" />
        </div>
        <ShimmerBar className="hidden md:block h-9 w-20 rounded-full" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            {...stagger(i)}
            className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <ShimmerBar className="h-10 w-10 rounded-xl" />
              <ShimmerBar className="h-3 w-3 rounded" />
            </div>
            <ShimmerBar className="h-7 w-16" />
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-2.5 w-14" />
          </motion.div>
        ))}
      </div>

      {/* Overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ShimmerBar className="h-7 w-7 rounded-lg" />
            <ShimmerBar className="h-4 w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <ShimmerBar className="h-3 w-20" />
              <ShimmerBar className="h-7 flex-1 rounded-lg" />
              <ShimmerBar className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShimmerBar className="h-7 w-7 rounded-lg" />
            <ShimmerBar className="h-4 w-28" />
          </div>
          <div className="flex items-center gap-4">
            <ShimmerBar className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <ShimmerBar className="h-4 w-24" />
              <ShimmerBar className="h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ShimmerBar className="h-16 rounded-xl" />
            <ShimmerBar className="h-16 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Ticket list */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerBar key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
        </div>
        <TicketListSkeleton count={5} />
      </div>
    </FadeWrap>
  );
}

/* ─── Ticket list (Inbox rows) ─────────────────────────────────────── */

export function TicketListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          {...stagger(i)}
          className="px-4 py-3.5 flex items-start gap-3"
        >
          <ShimmerBar className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <ShimmerBar className="h-3.5 w-16 rounded" />
              <ShimmerBar className="h-4 w-2/3 max-w-md rounded" />
            </div>
            <div className="flex items-center gap-2">
              <ShimmerBar className="h-5 w-16 rounded-full" />
              <ShimmerBar className="h-5 w-14 rounded-full" />
              <ShimmerBar className="h-5 w-20 rounded-full hidden sm:block" />
              <ShimmerBar className="h-5 w-24 rounded-full hidden md:block" />
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-3 w-16" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Inbox full page ──────────────────────────────────────────────── */

export function InboxSkeleton() {
  return (
    <FadeWrap className="flex-1 flex flex-col">
      {/* Tabs row */}
      <div className="border-b border-border/50 bg-card/60 px-4 py-3 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBar key={i} className="h-6 w-24" />
        ))}
      </div>
      {/* Container */}
      <div className="rounded-xl border border-border/50 bg-card mx-3 sm:mx-4 md:mx-6 my-3 sm:my-4 flex-1 overflow-hidden">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex gap-2 flex-wrap">
          <ShimmerBar className="h-8 w-48 rounded-md" />
          <ShimmerBar className="h-8 w-32 rounded-md" />
          <ShimmerBar className="h-8 w-28 rounded-md" />
          <ShimmerBar className="h-8 w-36 rounded-md" />
        </div>
        <TicketListSkeleton count={8} />
      </div>
    </FadeWrap>
  );
}

/* ─── Ticket Detail ────────────────────────────────────────────────── */

export function TicketDetailSkeleton() {
  return (
    <FadeWrap className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Approval stepper */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShimmerBar className="h-5 w-5 rounded" />
          <ShimmerBar className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <ShimmerBar className="h-8 w-8 rounded-full shrink-0" />
              <ShimmerBar className="h-3 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Header card */}
          <motion.div {...stagger(0)} className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
            <div className="flex gap-2">
              <ShimmerBar className="h-6 w-20 rounded-full" />
              <ShimmerBar className="h-6 w-16 rounded-full" />
              <ShimmerBar className="h-6 w-24 rounded-full" />
            </div>
            <ShimmerBar className="h-7 w-3/4" />
            <div className="space-y-2">
              <ShimmerBar className="h-3.5 w-full" />
              <ShimmerBar className="h-3.5 w-full" />
              <ShimmerBar className="h-3.5 w-5/6" />
              <ShimmerBar className="h-3.5 w-2/3" />
            </div>
            <div className="flex gap-2 pt-2">
              <ShimmerBar className="h-8 w-24 rounded-xl" />
              <ShimmerBar className="h-8 w-28 rounded-xl" />
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div {...stagger(1)} className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerBar key={i} className="h-9 w-28 rounded-lg" />
            ))}
          </motion.div>

          {/* Comments */}
          <motion.div {...stagger(2)} className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <ShimmerBar className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <ShimmerBar className="h-3.5 w-28" />
                    <ShimmerBar className="h-3 w-16" />
                  </div>
                  <ShimmerBar className="h-12 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <motion.div {...stagger(1)} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <ShimmerBar className="h-5 w-24 mb-2" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-2">
                <ShimmerBar className="h-3.5 w-20" />
                <ShimmerBar className="h-3.5 w-28" />
              </div>
            ))}
          </motion.div>
          <motion.div {...stagger(2)} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <ShimmerBar className="h-5 w-32 mb-2" />
            <ShimmerBar className="h-9 w-full rounded-lg" />
            <ShimmerBar className="h-9 w-full rounded-lg" />
            <ShimmerBar className="h-9 w-full rounded-lg" />
          </motion.div>
        </div>
      </div>
    </FadeWrap>
  );
}

/* ─── Generic table skeleton ───────────────────────────────────────── */

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <FadeWrap>
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <ShimmerBar key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div
            key={i}
            {...stagger(i)}
            className="px-4 py-3 border-t border-border/30 flex gap-4"
          >
            {Array.from({ length: cols }).map((_, j) => (
              <ShimmerBar key={j} className="h-4 flex-1" />
            ))}
          </motion.div>
        ))}
      </div>
    </FadeWrap>
  );
}
