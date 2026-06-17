'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { DocGroup } from '@/lib/nav';

function SidebarGroup({ group, pathname }: { group: DocGroup; pathname: string }) {
  const groupActive = pathname === group.href;
  const childActive = group.questions.some((question) => question.href === pathname);
  const [open, setOpen] = useState(groupActive || childActive);

  return (
    <section className="doc-group">
      <div className={`doc-group-head ${groupActive ? 'active' : ''}`}>
        <Link className="doc-group-title" href={group.href as Route}>
          {group.title}
        </Link>
        {group.questions.length > 0 ? (
          <button
            type="button"
            className={`doc-group-toggle ${open ? 'open' : ''}`}
            aria-expanded={open}
            aria-label={open ? '收起' : '展开'}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden>›</span>
          </button>
        ) : null}
      </div>
      {open && group.questions.length > 0 ? (
        <div className="doc-group-items">
          {group.questions.map((question) => (
            <Link
              key={question.href}
              className={`doc-link ${question.href === pathname ? 'active' : ''}`}
              href={question.href as Route}
            >
              {question.title}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DocSidebar({ groups }: { groups: DocGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="doc-sidebar" aria-label="文档导航">
      {groups.map((group) => (
        <SidebarGroup key={group.id} group={group} pathname={pathname} />
      ))}
    </nav>
  );
}
