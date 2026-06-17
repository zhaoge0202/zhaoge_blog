'use client';

import { useRef, useState, type ReactNode } from 'react';

type CodeChild = { props?: { className?: string } };

function readLanguage(children: ReactNode): string {
  const child = (Array.isArray(children) ? children[0] : children) as CodeChild | undefined;
  const className = child?.props?.className ?? '';
  const match = /language-([\w-]+)/.exec(className);
  return match ? match[1] : '';
}

export function CodeBlock({ children, ...rest }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const language = readLanguage(children);

  async function copy() {
    const text = preRef.current?.innerText ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <div className="code-block" data-lang={language || undefined}>
      <div className="code-block-bar">
        {language ? <span className="code-lang">{language}</span> : <span className="code-lang muted">code</span>}
        <button type="button" className="code-copy" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
    </div>
  );
}
