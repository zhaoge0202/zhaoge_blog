import { TopicDocument } from '@/components/TopicDocument';
import { apiGet, PageResponse, QuestionSummary, Topic } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await apiGet<Topic>(`/api/public/topics/${slug}`);
  const questions = await apiGet<PageResponse<QuestionSummary>>(`/api/public/questions?topicId=${topic.id}&size=50`);

  return <TopicDocument questions={questions.records} topic={topic} />;
}
