import Link from 'next/link';
import type { Route } from 'next';
import { apiGet, PageResponse, PersonalNote, QuestionSummary, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

function topicHref(slug: string): Route {
  return `/topics/${slug}` as Route;
}

function questionHref(slug: string): Route {
  return `/questions/${slug}` as Route;
}

export default async function HomePage() {
  const [topics, questions, notes] = await Promise.all([
    apiGet<Topic[]>('/api/public/topics'),
    apiGet<PageResponse<QuestionSummary>>('/api/public/questions?size=8'),
    apiGet<PersonalNote[]>('/api/public/notes'),
  ]);

  return (
    <div className="doc-content">
      <p className="eyebrow">Backend Interview Docs</p>
      <h1>面向 Java 后端面试的文档式复习入口</h1>
      <p className="lead">
        按文档站的方式组织专题、题目和复盘：先建立知识地图，再沿着高频追问、易错表达和项目映射，把零散准备收敛成可复述的面试答案。
      </p>
      <div className="badge-row">
        <Link className="button-link" href="/topics">开始阅读路线</Link>
        <Link className="text-link" href="/questions">检索面试题 →</Link>
      </div>

      <section className="section">
        <h2>🔥 必看</h2>
        <ul className="markdown-body" style={{ paddingLeft: '1.4em', lineHeight: 1.9 }}>
          <li><Link className="text-link" href="/topics">学习路线与专题索引</Link>：先用专题建立知识地图，再进入题库训练表达。</li>
          <li><Link className="text-link" href="/questions">面试题检索与训练</Link>：按关键词、专题和状态快速定位需要强化的问题。</li>
          <li><Link className="text-link" href="/journey">备战复盘与表达修正</Link>：记录准备过程里的踩坑、修正和临场反馈。</li>
        </ul>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Main Content</p>
            <h2>主要内容入口</h2>
          </div>
          <Link className="text-link" href="/topics">查看完整路线</Link>
        </div>
        <div className="grid">
          {topics.slice(0, 6).map((topic) => (
            <Link className="card" href={topicHref(topic.slug)} key={topic.id}>
              <h3>{topic.title}</h3>
              <p>{topic.summary}</p>
              <span className="text-link">进入专题文档 →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Question Practice</p>
            <h2>高频题目入口</h2>
          </div>
          <Link className="text-link" href="/questions">进入题库</Link>
        </div>
        <div className="stack">
          {questions.records.map((question) => (
            <Link className="card question-card" href={questionHref(question.slug)} key={question.id}>
              <div>
                <h3>{question.title}</h3>
                <p>{question.summary}</p>
              </div>
              <div className="badge-row">
                <span className="badge">{question.difficulty}</span>
                <span className="badge">{question.frequency}</span>
                <span className="badge">{question.masteryLevel}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>最近复盘</h2>
        <div className="stack">
          {notes.slice(0, 3).map((note) => (
            <article className="card" key={note.id}>
              <p className="meta">{note.happenedOn} · {note.noteType}</p>
              <h3>{note.title}</h3>
              <p>{note.content}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
