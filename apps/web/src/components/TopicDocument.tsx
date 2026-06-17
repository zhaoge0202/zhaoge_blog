import Link from 'next/link';
import type { Route } from 'next';
import { MarkdownBlock } from './MarkdownBlock';
import { Toc } from './Toc';
import { DocPrevNext } from './DocPrevNext';
import { extractToc, readingStats } from '@/lib/toc';
import { adjacentDocs, flattenTree, loadDocTree } from '@/lib/nav';
import type { QuestionSummary, Topic } from '@/lib/api';

export async function TopicDocument({
  questions = [],
  topic,
}: {
  questions?: QuestionSummary[];
  topic: Topic;
}) {
  const toc = extractToc(topic.content);
  const stats = readingStats(topic.content);
  const tree = await loadDocTree().catch(() => []);
  const { prev, next } = adjacentDocs(flattenTree(tree), `/topics/${topic.slug}`);

  return (
    <div className="doc-article">
      <article className="doc-content">
        <p className="eyebrow">专题</p>
        <h1>{topic.title}</h1>
        <div className="doc-meta">
          <span className="doc-meta-item">📚 {topic.targetAudience}</span>
          <span className="doc-meta-item">🕑 约 {stats.minutes} 分钟</span>
          <span className="doc-meta-item">📝 {stats.chars} 字</span>
        </div>
        <MarkdownBlock className="lead markdown-inline" value={topic.summary} />

        <MarkdownBlock value={topic.content} />

        {questions.length > 0 ? (
          <section className="content-block">
            <h2>本专题题目</h2>
            <div className="stack">
              {questions.map((question) => (
                <Link className="card question-card" href={`/questions/${question.slug}` as Route} key={question.id}>
                  <div>
                    <p className="meta">题库训练单元</p>
                    <h3>{question.title}</h3>
                    <MarkdownBlock className="markdown-inline" value={question.summary} />
                  </div>
                  <div className="badge-row">
                    <span className="badge">{question.difficulty}</span>
                    <span className="badge">{question.frequency}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <DocPrevNext prev={prev} next={next} />
      </article>
      <Toc items={toc} />
    </div>
  );
}
