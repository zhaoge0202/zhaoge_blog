import { apiGet, QuestionDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const question = await apiGet<QuestionDetail>(`/api/public/questions/${slug}`);
  const tableOfContents = [
    { id: 'quick-answer', title: '30 秒回答' },
    { id: 'long-answer', title: '2 分钟回答' },
    { id: 'deep-dive', title: '深度解释' },
    { id: 'strategy', title: '回答策略' },
    { id: 'follow-ups', title: '追问链路' },
    { id: 'misconceptions', title: '误区纠偏' },
    { id: 'corrections', title: '纠偏记录' },
    { id: 'projects', title: '项目映射' },
    { id: 'references', title: '参考资料' },
  ];

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
          <div className="content-block" id="quick-answer">
            <h2>30 秒回答</h2>
            <p className="answer">{question.shortAnswer}</p>
          </div>
          <div className="content-block" id="long-answer">
            <h2>2 分钟回答</h2>
            <p>{question.longAnswer}</p>
          </div>
          <div className="content-block" id="deep-dive">
            <h2>深度解释</h2>
            <p>{question.deepDive}</p>
          </div>
          {question.sections.map((section) => (
            <div className="content-block note-block" key={section.id}>
              <p className="meta">{section.sectionType}</p>
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </div>
          ))}
          <div className="content-block" id="strategy">
            <h2>回答策略</h2>
            <p>{question.answerStrategy}</p>
          </div>
          <div className="content-block" id="follow-ups">
            <h2>追问链路</h2>
            <div className="timeline-list">
              {question.followUps.map((item, index) => (
                <div className="timeline-item" key={item.id}>
                  <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{item.questionText}</h3>
                    <p>{item.answerHint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="misconceptions">
            <h2>误区纠偏</h2>
            {question.misconceptions.map((item) => (
              <div className="warning" key={item.id}>
                <h3>常见误区：{item.wrongStatement}</h3>
                <p>{item.whyWrong}</p>
                <p className="answer">{item.correctStatement}</p>
              </div>
            ))}
          </div>
          <div className="content-block" id="corrections">
            <h2>纠偏记录</h2>
            <div className="stack">
              {question.corrections.map((item) => (
                <div className="card soft-card" key={item.id}>
                  <p className="meta">{item.sourceType}</p>
                  <h3>{item.title}</h3>
                  <p>{item.problem}</p>
                  <p className="answer">{item.correction}</p>
                  {item.evidence ? <p className="quote-note">依据：{item.evidence}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="projects">
            <h2>项目映射</h2>
            <div className="stack">
              {question.projectMappings.map((item) => (
                <div className="card" key={item.id}>
                  <p className="meta">{item.scenario}</p>
                  <h3>{item.projectTalkingPoint}</h3>
                  {item.riskPoint ? <p className="warning compact-warning">风险点：{item.riskPoint}</p> : null}
                  <p className="answer">{item.interviewAnswer}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="references">
            <h2>参考资料</h2>
            <div className="stack">
              {question.references.map((item) => (
                <a className="card reference-card" href={item.sourceUrl} key={item.id}>
                  <span className="badge">{item.sourceType}</span>
                  <h3>{item.sourceName}</h3>
                  {item.usageNote ? <p>{item.usageNote}</p> : <p>用于核对原始资料和补充上下文。</p>}
                </a>
              ))}
            </div>
          </div>
        </article>
        <aside className="stack sticky-side">
          <div className="card">
            <p className="eyebrow">On this page</p>
            <h2>目录</h2>
            <nav className="toc-list" aria-label="题目详情目录">
              {tableOfContents.map((item) => (
                <a href={`#${item.id}`} key={item.id}>{item.title}</a>
              ))}
            </nav>
          </div>
          <div className="card">
            <h2>追问链路</h2>
            {question.followUps.slice(0, 3).map((item, index) => (
              <div className="mini-row" key={item.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item.questionText}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>纠偏记录</h2>
            {question.corrections.slice(0, 2).map((item) => (
              <div className="mini-row" key={item.id}>
                <span>{item.sourceType}</span>
                <p>{item.title}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
