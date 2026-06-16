const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080';

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

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

export function buildQueryString(params?: QueryParams): string {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];

    values.forEach((item) => {
      if (item === null || item === undefined) {
        return;
      }

      const normalized = typeof item === 'string' ? item.trim() : String(item);
      if (normalized) {
        searchParams.append(key, normalized);
      }
    });
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

function joinPathAndQuery(path: string, params?: QueryParams): string {
  const queryString = buildQueryString(params);

  if (!queryString) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}${queryString.slice(1)}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiResponse<unknown>>;
    return body.message ? `: ${body.message}` : '';
  } catch {
    return '';
  }
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const endpoint = joinPathAndQuery(path, params);
  const response = await fetch(`${API_BASE}${endpoint}`, { next: { revalidate: 60 } });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`API GET ${endpoint} failed: ${response.status} ${response.statusText}${message}`);
  }
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(`API GET ${endpoint} failed: ${body.message ?? 'unknown API error'}`);
  }
  return body.data;
}
