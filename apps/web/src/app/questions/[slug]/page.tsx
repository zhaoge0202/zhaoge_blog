import { QuestionDocument } from '@/components/QuestionDocument';
import { apiGet, QuestionDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function QuestionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const question = await apiGet<QuestionDetail>(`/api/public/questions/${slug}`);

  return <QuestionDocument question={question} />;
}
