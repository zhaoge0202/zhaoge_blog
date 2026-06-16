import { apiGet, QuestionDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const question = await apiGet<QuestionDetail>(`/api/public/questions/${slug}`);

  return (
    <>
      <p className="eyebrow">Question</p>
      <h1>{question.title}</h1>
      <p className="lead">{question.summary}</p>
      <div className="badge-row">
        <span className="badge">{question.difficulty}</span>
        <span className="badge">{question.frequency}</span>
        <span className="badge">{question.masteryLevel}</span>
      </div>
      <section className="detail-layout section">
        <article>
          <div className="content-block">
            <h2>30 秒回答</h2>
            <p className="answer">{question.shortAnswer}</p>
          </div>
          <div className="content-block">
            <h2>2 分钟回答</h2>
            <p>{question.longAnswer}</p>
          </div>
          <div className="content-block">
            <h2>深度解释</h2>
            <p>{question.deepDive}</p>
          </div>
          <div className="content-block">
            <h2>回答策略</h2>
            <p>{question.answerStrategy}</p>
          </div>
          {question.misconceptions.map((item) => (
            <div className="content-block warning" key={item.id}>
              <h3>常见误区：{item.wrongStatement}</h3>
              <p>{item.whyWrong}</p>
              <p>{item.correctStatement}</p>
            </div>
          ))}
          {question.projectMappings.map((item) => (
            <div className="content-block" key={item.id}>
              <h2>项目映射</h2>
              <p>{item.scenario}</p>
              <p>{item.projectTalkingPoint}</p>
              <p className="answer">{item.interviewAnswer}</p>
            </div>
          ))}
        </article>
        <aside className="stack">
          <div className="card">
            <h2>追问链路</h2>
            {question.followUps.map((item) => (
              <div className="content-block" key={item.id}>
                <h3>{item.questionText}</h3>
                <p>{item.answerHint}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>纠偏记录</h2>
            {question.corrections.map((item) => (
              <div className="content-block" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.problem}</p>
                <p>{item.correction}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>参考资料</h2>
            {question.references.map((item) => (
              <p key={item.id}>
                <a href={item.sourceUrl}>{item.sourceName}</a>
              </p>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
