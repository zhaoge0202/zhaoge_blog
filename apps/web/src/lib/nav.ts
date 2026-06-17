import { cache } from 'react';
import { apiGet, type PageResponse, type QuestionSummary, type Topic } from './api';

export type DocLeaf = { title: string; href: string };
export type DocGroup = {
  id: number;
  title: string;
  href: string;
  questions: DocLeaf[];
};

/**
 * 拉取已发布专题 + 题目，组装成「专题 → 题目」文档树。
 * 用 React cache 在同一次请求内去重（layout 与页面会各调用一次）。
 */
export const loadDocTree = cache(async (): Promise<DocGroup[]> => {
  const [topics, questionsPage] = await Promise.all([
    apiGet<Topic[]>('/api/public/topics'),
    apiGet<PageResponse<QuestionSummary>>('/api/public/questions', { size: 200 }),
  ]);

  const byTopic = new Map<number, QuestionSummary[]>();
  for (const question of questionsPage.records) {
    const list = byTopic.get(question.topicId) ?? [];
    list.push(question);
    byTopic.set(question.topicId, list);
  }

  return topics
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      href: `/topics/${topic.slug}`,
      questions: (byTopic.get(topic.id) ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((question) => ({ title: question.title, href: `/questions/${question.slug}` })),
    }));
});

/** 扁平化文档树（专题，然后其题目），用于「上一篇 / 下一篇」。 */
export function flattenTree(groups: DocGroup[]): DocLeaf[] {
  const flat: DocLeaf[] = [];
  for (const group of groups) {
    flat.push({ title: group.title, href: group.href });
    flat.push(...group.questions);
  }
  return flat;
}

export function adjacentDocs(flat: DocLeaf[], currentHref: string) {
  const index = flat.findIndex((entry) => entry.href === currentHref);
  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}
