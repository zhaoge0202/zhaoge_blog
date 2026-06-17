import { MarkdownBlock } from './MarkdownBlock';
import { Toc } from './Toc';
import { DocPrevNext } from './DocPrevNext';
import { Breadcrumb, type Crumb } from './Breadcrumb';
import { DocFooter } from './DocFooter';
import { IconClock, IconWords } from './icons';
import { extractToc, readingStats } from '@/lib/toc';
import { adjacentDocs, flattenTree, loadDocTree } from '@/lib/nav';
import type { QuestionDetail } from '@/lib/api';

const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_BASE ?? 'http://localhost:5173';

export async function QuestionDocument({ question }: { question: QuestionDetail }) {
  const toc = extractToc(question.content);
  const stats = readingStats(question.content);
  const tree = await loadDocTree().catch(() => []);
  const { prev, next } = adjacentDocs(flattenTree(tree), `/questions/${question.slug}`);

  const ownerTopic = tree.find((group) => group.questions.some((q) => q.href === `/questions/${question.slug}`));
  const crumbs: Crumb[] = [{ label: '面试题库', href: '/questions' }];
  if (ownerTopic) {
    crumbs.push({ label: ownerTopic.title, href: ownerTopic.href });
  }
  crumbs.push({ label: question.title });

  return (
    <div className="doc-article">
      <article className="doc-content">
        <Breadcrumb items={crumbs} />
        <h1>{question.title}</h1>
        <div className="doc-meta">
          <span className="badge">{question.difficulty}</span>
          <span className="badge">{question.frequency}</span>
          <span className="badge">{question.masteryLevel}</span>
          <span className="doc-meta-item"><IconWords /> 约 {stats.chars} 字</span>
          <span className="doc-meta-item"><IconClock /> 大约 {stats.minutes} 分钟</span>
        </div>
        <MarkdownBlock className="lead markdown-inline" value={question.summary} />

        <MarkdownBlock value={question.content} />

        <DocFooter editHref={`${ADMIN_BASE}/questions`} updatedAt={question.updatedAt} />
        <DocPrevNext prev={prev} next={next} />
      </article>
      <Toc items={toc} />
    </div>
  );
}
