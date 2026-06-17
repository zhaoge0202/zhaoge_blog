import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Java 面试进阶平台',
  description: '面向 3-5 年 Java 后端工程师的进阶面试知识库。',
};

type SidebarGroup = {
  title: string;
  links: Array<{ href: Route; label: string }>;
};

type TopNavLink = {
  href: Route;
  label: string;
};

type ExternalNavLink = {
  href: string;
  label: string;
};

const sidebarGroups: SidebarGroup[] = [
  {
    title: '文档导航',
    links: [
      { href: '/', label: '站点首页' },
      { href: '/topics', label: '学习路线' },
      { href: '/questions', label: '题库总览' },
    ],
  },
  {
    title: 'Java 核心',
    links: [
      { href: '/topics/java-concurrency' as Route, label: '并发编程' },
      { href: '/topics/jvm' as Route, label: 'JVM 与内存模型' },
    ],
  },
  {
    title: '中间件与存储',
    links: [
      { href: '/topics/mysql' as Route, label: 'MySQL 索引与事务' },
      { href: '/topics/redis' as Route, label: 'Redis 缓存体系' },
    ],
  },
  {
    title: '面试训练',
    links: [
      { href: '/questions?status=published' as Route, label: '已发布题目' },
      { href: '/questions?topic=java-concurrency' as Route, label: '并发专题题目' },
      { href: '/questions?q=%E7%BA%BF%E7%A8%8B%E6%B1%A0' as Route, label: '线程池检索' },
      { href: '/journey', label: '备战复盘' },
    ],
  },
];

const topNavLinks: TopNavLink[] = [
  { href: '/topics', label: '学习路线' },
  { href: '/questions', label: '面试题库' },
  { href: '/journey', label: '备战记录' },
];

const externalNavLinks: ExternalNavLink[] = [
  { href: 'https://github.com/zhaoge0202/zhaoge_blog', label: 'GitHub' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
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
            </div>
          </header>

          <div className="docs-shell">
            <aside className="sidebar" aria-label="文档导航">
              {sidebarGroups.map((group) => (
                <section className="sidebar-group" key={group.title}>
                  <p>{group.title}</p>
                  {group.links.map((item) => (
                    <Link href={item.href} key={item.href}>
                      {item.label}
                    </Link>
                  ))}
                </section>
              ))}
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
