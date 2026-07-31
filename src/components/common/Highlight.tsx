import { memo, useMemo } from 'react';

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

/**
 * Highlights occurrences of `query` inside `text` with a subtle <mark> wrapper.
 * Case-insensitive, safe against regex injection.
 */
export const Highlight = memo(function Highlight({ text, query, className }: HighlightProps) {
  const parts = useMemo(() => {
    const q = query.trim();
    if (!q || !text) return [{ text, match: false }];
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.split(regex).map((part, i) => ({
      text: part,
      match: i % 2 === 1,
    }));
  }, [text, query]);

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            className="bg-warning/25 text-foreground rounded-[3px] px-0.5 py-px font-semibold ring-1 ring-warning/30"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
});
