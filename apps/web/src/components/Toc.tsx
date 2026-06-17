'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/toc';

export function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (items.length === 0) {
      return;
    }
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (headings.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="toc-rail" aria-label="本页目录">
      <p className="toc-title">本页目录</p>
      <nav className="toc-nav">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`toc-item depth-${item.depth} ${activeId === item.id ? 'active' : ''}`}
          >
            {item.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
