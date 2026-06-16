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
            <h2>核心题目</h2>
            <div className="stack">
              {questions.records.map((question) => (
                <Link className="card" href={`/questions/${question.slug}`} key={question.id}>
                  <h3>{question.title}</h3>
                  <p>{question.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <aside className="card">
          <h2>面试焦点</h2>
          <p>{topic.interviewFocus}</p>
          <h3>前置知识</h3>
          <p>{topic.prerequisites}</p>
        </aside>
      </section>
    </>
  );
}
