const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080';

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export type PageResponse<T> = {
  records: T[];
  total: number;
  page: number;
  size: number;
};

export type Topic = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  targetAudience: string;
  whyImportant: string;
  prerequisites: string;
  knowledgeMap: string;
  interviewFocus: string;
  sortOrder: number;
  status: string;
};

export type QuestionSummary = {
  id: number;
  topicId: number;
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  frequency: string;
  masteryLevel: string;
  sortOrder: number;
  status: string;
};

export type QuestionDetail = QuestionSummary & {
  shortAnswer: string;
  longAnswer: string;
  deepDive: string;
  answerStrategy: string;
  sections: Array<{ id: number; title: string; content: string; sectionType: string }>;
  followUps: Array<{ id: number; questionText: string; answerHint: string }>;
  misconceptions: Array<{ id: number; wrongStatement: string; whyWrong: string; correctStatement: string }>;
  corrections: Array<{ id: number; title: string; problem: string; correction: string; evidence: string; sourceType: string }>;
  projectMappings: Array<{ id: number; scenario: string; projectTalkingPoint: string; riskPoint: string; interviewAnswer: string }>;
  references: Array<{ id: number; sourceName: string; sourceUrl: string; sourceType: string; usageNote: string }>;
};

export type PersonalNote = {
  id: number;
  title: string;
  content: string;
  noteType: string;
  happenedOn: string;
  status: string;
};

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.message ?? 'API request failed');
  }
  return body.data;
}
