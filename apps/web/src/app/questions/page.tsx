import Link from 'next/link';
import type { Route } from 'next';
import { apiGet, buildQueryString, PageResponse, QuestionSummary, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

type QuestionsSearchParams = Promise<{
  q?: string;
  topic?: string;
  status?: string;
}>;

function getParam(value?: string): string {
  return value?.trim() ?? '';
}

function findTopic(topics: Topic[], topicParam: string): Topic | undefined {
  if (!topicParam) {
    return undefined;
  }

  const normalized = topicParam.toLowerCase();
  return topics.find(
    (topic) =>
      topic.slug.toLowerCase() === normalized ||
      topic.title.toLowerCase() === normalized ||
      String(topic.id) === topicParam,
  );
}

function questionsHref(params: { q?: string; topic?: string; status?: string }): Route {
  return `/questions${buildQueryString(params)}` as Route;
}

export default async function QuestionsPage({ searchParams }: { searchParams: QuestionsSearchParams }) {
  const params = await searchParams;
  const keyword = getParam(params.q);
  const topicParam = getParam(params.topic);
  const status = getParam(params.status);
  const topics = await apiGet<Topic[]>('/api/public/topics');
  const selectedTopic = findTopic(topics, topicParam);
  const questions = await apiGet<PageResponse<QuestionSummary>>('/api/public/questions', {
    keyword,
    topicId: selectedTopic?.id,
    size: 50,
  });
  const statusOptions = Array.from(new Set(questions.records.map((question) => question.status).filter(Boolean)));
  const filteredQuestions = status
    ? questions.records.filter((question) => question.status === status)
    : questions.records;

  return (
    <>
      <p className="eyebrow">Questions</p>
      <h1>按专题和关键词进入题库。</h1>
      <p className="lead">每道题是一篇完整的 Markdown 正文，自由组织结论、机制与项目映射。URL 参数支持 q/topic/status，适合收藏一组临考筛选。</p>

      <section className="section filter-panel">
        <div>
          <p className="meta">当前筛选</p>
          <div className="badge-row">
            <span className="badge">关键词：{keyword || '全部'}</span>
            <span className="badge">专题：{selectedTopic?.title || topicParam || '全部'}</span>
            <span className="badge">状态：{status || '全部'}</span>
          </div>
          {topicParam && !selectedTopic ? <p className="hint">未找到专题 “{topicParam}”，当前只按关键词和状态筛选。</p> : null}
        </div>
        <Link className="button-link" href="/questions">清空筛选</Link>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Topic Entry</p>
            <h2>按专题进入题库</h2>
          </div>
          <Link className="text-link" href={questionsHref({ q: keyword, status })}>查看全部题目</Link>
        </div>
        <div className="topic-strip">
          {topics.map((topic) => (
            <Link
              className={`topic-chip ${selectedTopic?.id === topic.id ? 'active' : ''}`}
              href={questionsHref({ q: keyword, topic: topic.slug, status })}
              key={topic.id}
            >
              <span>{topic.title}</span>
              <small>{topic.summary}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Result</p>
            <h2>{filteredQuestions.length} 道匹配题目</h2>
          </div>
          <div className="badge-row">
            {statusOptions.map((item) => (
              <Link
                className={`badge link-badge ${status === item ? 'active' : ''}`}
                href={questionsHref({ q: keyword, topic: selectedTopic?.slug, status: item })}
                key={item}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
        <div className="stack">
          {filteredQuestions.map((question) => {
            const topic = topics.find((item) => item.id === question.topicId);

            return (
              <Link className="card question-card" href={`/questions/${question.slug}`} key={question.id}>
                <div>
                  <p className="meta">{topic?.title ?? `专题 #${question.topicId}`}</p>
                  <h2>{question.title}</h2>
                  <p>{question.summary}</p>
                </div>
                <div className="badge-row">
                  <span className="badge">{question.difficulty}</span>
                  <span className="badge">{question.frequency}</span>
                  <span className="badge">{question.masteryLevel}</span>
                  <span className="badge">{question.status}</span>
                </div>
              </Link>
            );
          })}
          {filteredQuestions.length === 0 ? (
            <div className="card">
              <h2>没有匹配题目</h2>
              <p>换一个关键词，或从上方专题入口重新进入题库。</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
