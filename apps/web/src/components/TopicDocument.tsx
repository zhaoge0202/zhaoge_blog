import Link from 'next/link';
import type { Route } from 'next';
import { MarkdownBlock } from './MarkdownBlock';
import type { QuestionSummary, Topic } from '@/lib/api';

export function TopicDocument({ questions = [], topic }: { questions?: QuestionSummary[]; topic: Topic }) {
  return (
    <>
      <p className="eyebrow">Topic</p>
      <h1>{topic.title}</h1>
      <MarkdownBlock className="lead markdown-inline" value={topic.summary} />
      <div className="badge-row">
        <Link className="button-link" href={`/questions?topic=${topic.slug}` as Route}>进入该专题题库</Link>
        <Link className="text-link" href="/questions">检索全部题目</Link>
      </div>
      <section className="detail-layout section">
        <article>
          <div className="content-block">
            <MarkdownBlock value={topic.content} />
          </div>
          <div className="content-block">
            <h2>阅读方式</h2>
            <div className="feature-grid compact">
              <div>
                <span className="step-number">Q</span>
                <h3>追问</h3>
                <p>先看问题如何被继续深挖，避免只背结论。</p>
              </div>
              <div>
                <span className="step-number">!</span>
                <h3>误区</h3>
                <p>对照错误说法和纠偏记录，训练边界表达。</p>
              </div>
              <div>
                <span className="step-number">P</span>
                <h3>项目映射</h3>
                <p>把专题知识迁移到自己的项目案例里。</p>
              </div>
            </div>
          </div>
          <div className="content-block">
            <h2>核心题目</h2>
            <div className="stack">
              {questions.map((question) => (
                <Link className="card question-card" href={`/questions/${question.slug}` as Route} key={question.id}>
                  <div>
                    <p className="meta">题库训练单元</p>
                    <h3>{question.title}</h3>
                    <MarkdownBlock value={question.summary} />
                  </div>
                  <div className="badge-row">
                    <span className="badge">{question.difficulty}</span>
                    <span className="badge">{question.frequency}</span>
                    <span className="badge">追问 / 误区 / 项目映射</span>
                  </div>
                </Link>
              ))}
              {questions.length === 0 ? <p className="empty-preview">暂无核心题目。</p> : null}
            </div>
          </div>
        </article>
        <aside className="stack sticky-side">
          <div className="card">
            <h2>摘要</h2>
            <MarkdownBlock value={topic.summary} />
          </div>
          <div className="card">
            <h2>专题定位</h2>
            <p>{topic.targetAudience}</p>
          </div>
          <div className="card">
            <h2>题库入口</h2>
            <p>带着专题上下文进入题库，只看当前专题下的高频问题。</p>
            <Link className="button-link" href={`/questions?topic=${topic.slug}` as Route}>筛选 {topic.title}</Link>
          </div>
        </aside>
      </section>
    </>
  );
}
