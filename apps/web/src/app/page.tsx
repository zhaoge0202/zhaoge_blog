import Link from 'next/link';
import { apiGet, PageResponse, PersonalNote, QuestionSummary, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [topics, questions, notes] = await Promise.all([
    apiGet<Topic[]>('/api/public/topics'),
    apiGet<PageResponse<QuestionSummary>>('/api/public/questions?size=8'),
    apiGet<PersonalNote[]>('/api/public/notes'),
  ]);

  return (
    <>
      <section className="hero-grid">
        <div>
          <p className="eyebrow">3-5 年 Java 后端进阶面试</p>
          <h1>把高频八股讲成有判断的工程经验。</h1>
          <p className="lead">
            专题是入口，题目是独立知识单元。每道题围绕原理、追问、误区、纠偏和项目映射组织，记录一条从资料汇总走向个人判断的备战路径。
          </p>
        </div>
        <div className="card">
          <h2>V1 聚焦</h2>
          <p>并发、JVM、MySQL、Redis。先把最容易被深挖的四个模块做透。</p>
          <div className="badge-row">
            <span className="badge">追问链路</span>
            <span className="badge">错误答案</span>
            <span className="badge">项目映射</span>
            <span className="badge">纠偏记录</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>专题入口</h2>
        <div className="grid">
          {topics.map((topic) => (
            <Link className="card" href={`/topics/${topic.slug}`} key={topic.id}>
              <h3>{topic.title}</h3>
              <p>{topic.summary}</p>
              <p className="meta">{topic.interviewFocus}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>精选进阶题</h2>
        <div className="stack">
          {questions.records.map((question) => (
            <Link className="card" href={`/questions/${question.slug}`} key={question.id}>
              <h3>{question.title}</h3>
              <p>{question.summary}</p>
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
        <h2>最近心路</h2>
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
    </>
  );
}
