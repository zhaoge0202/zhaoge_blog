import Link from 'next/link';
import type { Route } from 'next';
import { MarkdownBlock } from './MarkdownBlock';
import type { QuestionDetail } from '@/lib/api';

export function QuestionDocument({ question }: { question: QuestionDetail }) {
  return (
    <>
      <p className="eyebrow">Question</p>
      <h1>{question.title}</h1>
      <MarkdownBlock className="lead markdown-inline" value={question.summary} />
      <div className="badge-row">
        <span className="badge">{question.difficulty}</span>
        <span className="badge">{question.frequency}</span>
        <span className="badge">{question.masteryLevel}</span>
      </div>
      <div className="badge-row">
        <Link className="text-link" href="/questions">返回题库</Link>
      </div>
      <section className="section">
        <article>
          <div className="content-block">
            <MarkdownBlock value={question.content} />
          </div>
        </article>
      </section>
    </>
  );
}
