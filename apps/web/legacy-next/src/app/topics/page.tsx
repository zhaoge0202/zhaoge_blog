import Link from 'next/link';
import { apiGet, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  const topics = await apiGet<Topic[]>('/api/public/topics');

  return (
    <div className="doc-content">
      <p className="eyebrow">Topics</p>
      <h1>专题主线</h1>
      <p className="lead">每个专题用一篇完整 Markdown 正文组织知识主线、排查路径、易错点和项目映射。</p>
      <section className="section grid">
        {topics.map((topic) => (
          <Link className="card" href={`/topics/${topic.slug}`} key={topic.id}>
            <h2>{topic.title}</h2>
            <p>{topic.summary}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
