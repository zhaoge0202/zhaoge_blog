import { Children } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { externalLinkProps, safeHref } from '@/lib/safe-link';

export function MarkdownBlock({ value, className }: { value?: string | null; className?: string }) {
  const markdown = value?.trim();

  if (!markdown) {
    return (
      <div className={className ?? 'markdown-body'}>
        <p className="empty-preview">暂无内容。</p>
      </div>
    );
  }

  return (
    <div className={className ?? 'markdown-body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ children, href }) {
            const props = externalLinkProps(href);
            return <a {...props}>{Children.toArray(children)}</a>;
          },
          img({ alt, src }) {
            const safeSrc = typeof src === 'string' ? safeHref(src) : null;
            return safeSrc ? <img alt={alt ?? ''} loading="lazy" src={safeSrc} /> : null;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
