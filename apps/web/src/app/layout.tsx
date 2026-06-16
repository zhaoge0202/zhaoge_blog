import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Java 面试进阶平台',
  description: '面向 3-5 年 Java 后端工程师的进阶面试知识库。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link className="brand" href="/">Java 面试进阶</Link>
            <div className="nav-links">
              <Link href="/topics">专题</Link>
              <Link href="/questions">题库</Link>
              <Link href="/journey">心路历程</Link>
            </div>
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
