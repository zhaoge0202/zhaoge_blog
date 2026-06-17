'use client';

import { useEffect, useMemo, useState } from 'react';
import { QuestionDocument } from '@/components/QuestionDocument';
import type { QuestionDetail } from '@/lib/api';

type PreviewMessage = {
  payload?: QuestionDetail;
  type?: string;
};

const emptyQuestion: QuestionDetail = {
  id: 0,
  topicId: 0,
  slug: 'preview',
  title: '未命名题目',
  summary: '在后台左侧编辑 Markdown，这里会展示与前台一致的真实页面效果。',
  difficulty: 'DRAFT',
  frequency: 'PREVIEW',
  masteryLevel: 'MARKDOWN',
  sortOrder: 0,
  status: 'DRAFT',
  shortAnswer: '',
  longAnswer: '',
  deepDive: '',
  answerStrategy: '',
  sections: [],
  followUps: [],
  misconceptions: [],
  corrections: [],
  projectMappings: [],
  references: [],
};
const previewStorageKey = 'admin-preview:question-preview';

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

export default function QuestionPreviewPage() {
  const [question, setQuestion] = useState<QuestionDetail>(emptyQuestion);

  useEffect(() => {
    function applyCachedPreview() {
      try {
        const cached = window.localStorage.getItem(previewStorageKey);
        if (!cached) {
          return;
        }
        const parsed = JSON.parse(cached) as PreviewMessage;
        if (parsed.payload) {
          setQuestion({ ...emptyQuestion, ...parsed.payload });
        }
      } catch {
        // Ignore broken preview cache and keep current state.
      }
    }

    function receive(event: MessageEvent<PreviewMessage>) {
      if (!allowedAdminOrigins.has(event.origin)) {
        return;
      }
      if (event.data?.type === 'question-preview' && event.data.payload) {
        setQuestion({ ...emptyQuestion, ...event.data.payload });
        window.parent.postMessage({ type: 'preview-applied', target: 'question' }, event.origin);
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
      window.parent.postMessage({ type: 'preview-ready', target: 'question' }, origin);
    }
    return () => {
      window.removeEventListener('message', receive);
      window.removeEventListener('storage', receiveStorage);
    };
  }, []);

  const hydratedQuestion = useMemo(() => ({ ...emptyQuestion, ...question }), [question]);

  return (
    <div className="preview-page">
      <QuestionDocument question={hydratedQuestion} />
    </div>
  );
}
