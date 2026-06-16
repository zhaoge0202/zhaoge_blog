import Link from 'next/link';
import { apiGet, PageResponse, QuestionSummary, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await apiGet<Topic>(`/api/public/topics/${slug}`);
  const questions = await apiGet<PageResponse<QuestionSummary>>(`/api/public/questions?topicId=${topic.id}&size=50`);

  return (
    <>
      <p className="eyebrow">Topic</p>
      <h1>{topic.title}</h1>
      <p className="lead">{topic.summary}</p>
      <div className="badge-row">
        <Link className="button-link" href={`/questions?topic=${topic.slug}`}>进入该专题题库</Link>
        <Link className="text-link" href="/questions">检索全部题目</Link>
      </div>
      <section className="detail-layout section">
        <div>
          <div className="content-block">
            <h2>为什么重要</h2>
            <p>{topic.whyImportant}</p>
          </div>
          <div className="content-block">
            <h2>知识主线</h2>
            <p>{topic.knowledgeMap}</p>
          </div>
          <div className="content-block">
            <h2>阅读结构</h2>
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
              {questions.records.map((question) => (
                <Link className="card question-card" href={`/questions/${question.slug}`} key={question.id}>
                  <div>
                    <p className="meta">题库训练单元</p>
                    <h3>{question.title}</h3>
                    <p>{question.summary}</p>
                  </div>
                  <div className="badge-row">
                    <span className="badge">{question.difficulty}</span>
                    <span className="badge">{question.frequency}</span>
                    <span className="badge">追问 / 误区 / 项目映射</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <aside className="stack sticky-side">
          <div className="card">
            <h2>面试焦点</h2>
            <p>{topic.interviewFocus}</p>
          </div>
          <div className="card">
            <h2>前置知识</h2>
            <p>{topic.prerequisites}</p>
          </div>
          <div className="card">
            <h2>题库入口</h2>
            <p>带着专题上下文进入题库，只看当前专题下的高频问题。</p>
            <Link className="button-link" href={`/questions?topic=${topic.slug}`}>筛选 {topic.title}</Link>
          </div>
        </aside>
      </section>
    </>
  );
}
