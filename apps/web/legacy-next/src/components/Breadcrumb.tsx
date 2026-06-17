import Link from 'next/link';
import type { Route } from 'next';

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <nav className="doc-breadcrumb" aria-label="面包屑">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="crumb">
          {item.href ? (
            <Link href={item.href as Route}>{item.label}</Link>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="crumb-sep" aria-hidden>›</span> : null}
        </span>
      ))}
    </nav>
  );
}
