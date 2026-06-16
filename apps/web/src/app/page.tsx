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
          <p className="meta">阅读顺序：先从专题建立判断框架，再进入题库逐题训练表达。</p>
          <div className="badge-row">
            <span className="badge">追问链路</span>
            <span className="badge">错误答案</span>
            <span className="badge">项目映射</span>
            <span className="badge">纠偏记录</span>
          </div>
          <Link className="button-link" href="/questions">进入完整题库</Link>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reading Path</p>
            <h2>专题入口</h2>
          </div>
          <Link className="text-link" href="/topics">浏览全部专题</Link>
        </div>
        <div className="grid">
          {topics.map((topic) => (
            <Link className="card" href={`/topics/${topic.slug}`} key={topic.id}>
              <h3>{topic.title}</h3>
              <p>{topic.summary}</p>
              <p className="meta">{topic.interviewFocus}</p>
              <span className="inline-cta">阅读专题后筛题 →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Question Units</p>
            <h2>精选进阶题</h2>
          </div>
          <Link className="text-link" href="/questions">按关键词检索</Link>
        </div>
        <div className="stack">
          {questions.records.map((question) => (
            <Link className="card question-card" href={`/questions/${question.slug}`} key={question.id}>
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

      <section className="section reading-map">
        <div className="card">
          <p className="eyebrow">Structure</p>
          <h2>每题都按面试追问重组</h2>
          <div className="feature-grid">
            <div>
              <span className="step-number">01</span>
              <h3>追问链路</h3>
              <p>从主问题延伸到边界条件、性能取舍和工程判断。</p>
            </div>
            <div>
              <span className="step-number">02</span>
              <h3>误区纠偏</h3>
              <p>把常见错误答案拆开，记录为什么错、应该怎么改。</p>
            </div>
            <div>
              <span className="step-number">03</span>
              <h3>项目映射</h3>
              <p>把知识点落到项目场景，形成可复述的面试表达。</p>
            </div>
          </div>
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
