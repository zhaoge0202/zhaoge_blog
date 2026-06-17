import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DocSidebar } from '@/components/DocSidebar';
import { loadDocTree, type DocGroup } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'Java 面试进阶平台',
  description: '面向 3-5 年 Java 后端工程师的进阶面试知识库。',
};

type TopNavLink = { href: Route; label: string };
type ExternalNavLink = { href: string; label: string };

const topNavLinks: TopNavLink[] = [
  { href: '/topics', label: '学习路线' },
  { href: '/questions', label: '面试题库' },
  { href: '/journey', label: '备战记录' },
];

const externalNavLinks: ExternalNavLink[] = [
  { href: 'https://github.com/zhaoge0202/zhaoge_blog', label: 'GitHub' },
];

// paint 前根据 localStorage / 系统偏好设置主题，避免暗色闪屏。
const themeScript =
  "(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();";

async function safeTree(): Promise<DocGroup[]> {
  try {
    return await loadDocTree();
  } catch {
    return [];
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const groups = await safeTree();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="shell">
          <header className="navbar">
            <div className="navbar-start">
              <Link className="brand" href="/" aria-label="返回首页">
                <span className="brand-logo">面</span>
                <span className="brand-name">后端面试手册</span>
              </Link>
            </div>
            <nav className="nav-links" aria-label="主导航">
              {topNavLinks.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
              {externalNavLinks.map((item) => (
                <a href={item.href} key={item.href} rel="noreferrer" target="_blank">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="navbar-end">
              <Link className="search-entry" href="/questions" aria-label="搜索题库">
                <span>搜索文档</span>
                <kbd>⌘K</kbd>
              </Link>
              <ThemeToggle />
            </div>
          </header>

          <div className="docs-shell">
            <aside className="sidebar" aria-label="文档导航">
              <DocSidebar groups={groups} />
            </aside>
            <main className="main" id="main-content">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
