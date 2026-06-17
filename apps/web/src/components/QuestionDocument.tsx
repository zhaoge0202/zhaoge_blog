import { MarkdownBlock } from './MarkdownBlock';
import { Toc } from './Toc';
import { DocPrevNext } from './DocPrevNext';
import { extractToc, readingStats } from '@/lib/toc';
import { adjacentDocs, flattenTree, loadDocTree } from '@/lib/nav';
import type { QuestionDetail } from '@/lib/api';

export async function QuestionDocument({ question }: { question: QuestionDetail }) {
  const toc = extractToc(question.content);
  const stats = readingStats(question.content);
  const tree = await loadDocTree().catch(() => []);
  const { prev, next } = adjacentDocs(flattenTree(tree), `/questions/${question.slug}`);

  return (
    <div className="doc-article">
      <article className="doc-content">
        <p className="eyebrow">面试题</p>
        <h1>{question.title}</h1>
        <div className="doc-meta">
          <span className="badge">{question.difficulty}</span>
          <span className="badge">{question.frequency}</span>
          <span className="badge">{question.masteryLevel}</span>
          <span className="doc-meta-item">🕑 约 {stats.minutes} 分钟</span>
          <span className="doc-meta-item">📝 {stats.chars} 字</span>
        </div>
        <MarkdownBlock className="lead markdown-inline" value={question.summary} />

        <MarkdownBlock value={question.content} />

        <DocPrevNext prev={prev} next={next} />
      </article>
      <Toc items={toc} />
    </div>
  );
}
