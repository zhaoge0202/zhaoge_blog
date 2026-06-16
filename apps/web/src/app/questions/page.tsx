import Link from 'next/link';
import { apiGet, PageResponse, QuestionSummary } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function QuestionsPage() {
  const questions = await apiGet<PageResponse<QuestionSummary>>('/api/public/questions?size=50');

  return (
    <>
      <p className="eyebrow">Questions</p>
      <h1>独立题目页</h1>
      <p className="lead">每道题都有短回答、深度解释、追问、误区、纠偏和项目映射。</p>
      <section className="section stack">
        {questions.records.map((question) => (
          <Link className="card" href={`/questions/${question.slug}`} key={question.id}>
            <h2>{question.title}</h2>
            <p>{question.summary}</p>
            <div className="badge-row">
              <span className="badge">{question.difficulty}</span>
              <span className="badge">{question.frequency}</span>
              <span className="badge">{question.masteryLevel}</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
