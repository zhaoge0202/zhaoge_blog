import { Children } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { CodeBlock } from './CodeBlock';
import { externalLinkProps, safeHref } from '@/lib/safe-link';

const autolinkOptions = {
  behavior: 'append' as const,
  properties: { className: ['heading-anchor'], ariaHidden: true, tabIndex: -1 },
  content: { type: 'element' as const, tagName: 'span', properties: {}, children: [{ type: 'text' as const, value: '#' }] },
};

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
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, autolinkOptions],
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        skipHtml
        components={{
          a({ children, href, className }) {
            const props = externalLinkProps(href);
            return <a {...props} className={className}>{Children.toArray(children)}</a>;
          },
          img({ alt, src }) {
            const safeSrc = typeof src === 'string' ? safeHref(src) : null;
            return safeSrc ? <img alt={alt ?? ''} loading="lazy" src={safeSrc} /> : null;
          },
          pre({ node, ...props }) {
            return <CodeBlock {...props} />;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
