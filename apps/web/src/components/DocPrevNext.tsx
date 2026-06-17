import Link from 'next/link';
import type { Route } from 'next';
import type { DocLeaf } from '@/lib/nav';

export function DocPrevNext({ prev, next }: { prev: DocLeaf | null; next: DocLeaf | null }) {
  if (!prev && !next) {
    return null;
  }
  return (
    <nav className="doc-prevnext" aria-label="上下篇导航">
      {prev ? (
        <Link className="prev" href={prev.href as Route}>
          <span className="pn-label">上一篇</span>
          <span className="pn-title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="next" href={next.href as Route}>
          <span className="pn-label">下一篇</span>
          <span className="pn-title">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
