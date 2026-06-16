import Link from 'next/link';
import { apiGet, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  const topics = await apiGet<Topic[]>('/api/public/topics');

  return (
    <>
      <p className="eyebrow">Topics</p>
      <h1>专题主线</h1>
      <p className="lead">每个专题都围绕重要性、知识主线、追问地图和作者修正过程组织。</p>
      <section className="section grid">
        {topics.map((topic) => (
          <Link className="card" href={`/topics/${topic.slug}`} key={topic.id}>
            <h2>{topic.title}</h2>
            <p>{topic.summary}</p>
            <p className="meta">{topic.targetAudience}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
