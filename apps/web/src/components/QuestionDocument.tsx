import { MarkdownBlock } from './MarkdownBlock';
import { externalLinkProps } from '@/lib/safe-link';
import type { QuestionDetail } from '@/lib/api';

export function QuestionDocument({ question }: { question: QuestionDetail }) {
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
      <MarkdownBlock className="lead markdown-inline" value={question.summary} />
      <div className="badge-row">
        <span className="badge">{question.difficulty}</span>
        <span className="badge">{question.frequency}</span>
        <span className="badge">{question.masteryLevel}</span>
      </div>
      <section className="detail-layout section">
        <article>
          <div className="content-block" id="quick-answer">
            <h2>30 秒回答</h2>
            <MarkdownBlock className="answer markdown-body" value={question.shortAnswer} />
          </div>
          <div className="content-block" id="long-answer">
            <h2>2 分钟回答</h2>
            <MarkdownBlock value={question.longAnswer} />
          </div>
          <div className="content-block" id="deep-dive">
            <h2>深度解释</h2>
            <MarkdownBlock value={question.deepDive} />
          </div>
          {question.sections.map((section) => (
            <div className="content-block note-block" key={section.id ?? `${section.sectionType}-${section.title}`}>
              <p className="meta">{section.sectionType}</p>
              <h3>{section.title}</h3>
              <MarkdownBlock value={section.content} />
            </div>
          ))}
          <div className="content-block" id="strategy">
            <h2>回答策略</h2>
            <MarkdownBlock value={question.answerStrategy} />
          </div>
          <div className="content-block" id="follow-ups">
            <h2>追问链路</h2>
            <div className="timeline-list">
              {question.followUps.map((item, index) => (
                <div className="timeline-item" key={item.id ?? `${item.questionText}-${index}`}>
                  <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{item.questionText}</h3>
                    <MarkdownBlock value={item.answerHint} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="misconceptions">
            <h2>误区纠偏</h2>
            {question.misconceptions.map((item, index) => (
              <div className="warning" key={item.id ?? `${item.wrongStatement}-${index}`}>
                <h3>常见误区：{item.wrongStatement}</h3>
                <MarkdownBlock value={item.whyWrong} />
                <MarkdownBlock className="answer markdown-body" value={item.correctStatement} />
              </div>
            ))}
          </div>
          <div className="content-block" id="corrections">
            <h2>纠偏记录</h2>
            <div className="stack">
              {question.corrections.map((item, index) => (
                <div className="card soft-card" key={item.id ?? `${item.title}-${index}`}>
                  <p className="meta">{item.sourceType}</p>
                  <h3>{item.title}</h3>
                  <MarkdownBlock value={item.problem} />
                  <MarkdownBlock className="answer markdown-body" value={item.correction} />
                  {item.evidence ? <p className="quote-note">依据：{item.evidence}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="projects">
            <h2>项目映射</h2>
            <div className="stack">
              {question.projectMappings.map((item, index) => (
                <div className="card" key={item.id ?? `${item.scenario}-${index}`}>
                  <p className="meta">{item.scenario}</p>
                  <h3>{item.projectTalkingPoint}</h3>
                  {item.riskPoint ? <p className="warning compact-warning">风险点：{item.riskPoint}</p> : null}
                  <MarkdownBlock className="answer markdown-body" value={item.interviewAnswer} />
                </div>
              ))}
            </div>
          </div>
          <div className="content-block" id="references">
            <h2>参考资料</h2>
            <div className="stack">
              {question.references.map((item, index) => (
                <a className="card reference-card" {...externalLinkProps(item.sourceUrl)} key={item.id ?? `${item.sourceName}-${index}`}>
                  <div className="stack">
                    <span className="badge">{item.sourceType}</span>
                    <h3>{item.sourceName}</h3>
                    {item.usageNote ? <MarkdownBlock value={item.usageNote} /> : <p>用于核对原始资料和补充上下文。</p>}
                  </div>
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
              <div className="mini-row" key={item.id ?? `${item.questionText}-${index}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item.questionText}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>纠偏记录</h2>
            {question.corrections.slice(0, 2).map((item, index) => (
              <div className="mini-row" key={item.id ?? `${item.title}-${index}`}>
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
