import { ReactNode, memo } from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeadProps {
  children: ReactNode;
  active?: boolean;
  direction?: 'asc' | 'desc';
  onSort: () => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * Accessible sortable column header.
 * Wraps content in a real <button> so keyboard users can focus & sort,
 * exposes aria-sort on the <th>, and ships a visible focus ring.
 */
export const SortableHead = memo(function SortableHead({
  children,
  active = false,
  direction = 'asc',
  onSort,
  className,
  align = 'start',
}: SortableHeadProps) {
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const justify =
    align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start';

  return (
    <TableHead aria-sort={ariaSort} className={cn('p-0', className)}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'flex w-full items-center gap-1.5 px-3 py-3 text-start text-xs font-medium transition-colors',
          'min-h-[44px] hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm',
          justify,
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        {active ? (
          direction === 'asc' ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
        )}
      </button>
    </TableHead>
  );
});
