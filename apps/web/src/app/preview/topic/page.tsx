'use client';

import { useEffect, useMemo, useState } from 'react';
import { TopicDocument } from '@/components/TopicDocument';
import type { QuestionSummary, Topic } from '@/lib/api';

type PreviewMessage = {
  payload?: Topic;
  questions?: QuestionSummary[];
  type?: string;
};

const emptyTopic: Topic = {
  id: 0,
  slug: 'preview',
  title: '未命名专题',
  summary: '在后台左侧编辑 Markdown，这里会展示与前台一致的真实页面效果。',
  content: '在后台直接编写 Markdown 正文，这里展示与前台一致的真实渲染效果。',
  targetAudience: 'Java 后端开发者',
  whyImportant: '',
  prerequisites: '',
  knowledgeMap: '',
  interviewFocus: '',
  sortOrder: 0,
  status: 'DRAFT',
};
const previewStorageKey = 'admin-preview:topic-preview';

const allowedAdminOrigins = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

function parentOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

export default function TopicPreviewPage() {
  const [topic, setTopic] = useState<Topic>(emptyTopic);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);

  useEffect(() => {
    function applyCachedPreview() {
      try {
        const cached = window.localStorage.getItem(previewStorageKey);
        if (!cached) {
          return;
        }
        const parsed = JSON.parse(cached) as PreviewMessage;
        if (parsed.payload) {
          setTopic({ ...emptyTopic, ...parsed.payload });
          setQuestions(parsed.questions ?? []);
        }
      } catch {
        // Ignore broken preview cache and keep current state.
      }
    }

    function receive(event: MessageEvent<PreviewMessage>) {
      if (!allowedAdminOrigins.has(event.origin)) {
        return;
      }
      if (event.data?.type === 'topic-preview' && event.data.payload) {
        setTopic({ ...emptyTopic, ...event.data.payload });
        setQuestions(event.data.questions ?? []);
        window.parent.postMessage({ type: 'preview-applied', target: 'topic' }, event.origin);
      }
    }

    function receiveStorage(event: StorageEvent) {
      if (event.key === previewStorageKey) {
        applyCachedPreview();
      }
    }

    applyCachedPreview();
    window.addEventListener('message', receive);
    window.addEventListener('storage', receiveStorage);
    const origin = parentOrigin();
    if (origin && allowedAdminOrigins.has(origin)) {
      window.parent.postMessage({ type: 'preview-ready', target: 'topic' }, origin);
    }
    return () => {
      window.removeEventListener('message', receive);
      window.removeEventListener('storage', receiveStorage);
    };
  }, []);

  const hydratedTopic = useMemo(() => ({ ...emptyTopic, ...topic }), [topic]);

  return (
    <div className="preview-page">
      <TopicDocument questions={questions} topic={hydratedTopic} />
    </div>
  );
}
