'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 移动端侧栏开合按钮 + 遮罩。
 * 行为对齐 vuepress-theme-hope：汉堡按钮在 tablet 以下显示，
 * 打开时给 .shell 加 sidebar-open 类（侧栏滑入），点遮罩或切换路由时关闭。
 */
export function SidebarToggle() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const shell = document.querySelector('.shell');
    if (!shell) {
      return;
    }
    shell.classList.toggle('sidebar-open', open);
  }, [open]);

  // 路由变化时自动收起
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className={`sidebar-toggle ${open ? 'is-open' : ''}`}
        aria-label={open ? '关闭侧栏' : '打开侧栏'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="bar" />
        <span className="bar" />
        <span className="bar" />
      </button>
      {open ? <div className="sidebar-overlay" onClick={() => setOpen(false)} /> : null}
    </>
  );
}
