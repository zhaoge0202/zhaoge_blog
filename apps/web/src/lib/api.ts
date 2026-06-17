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
  content: string;
  targetAudience: string;
  whyImportant: string;
  prerequisites: string;
  knowledgeMap: string;
  interviewFocus: string;
  sortOrder: number;
  status: string;
  updatedAt?: string;
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
  content: string;
  updatedAt?: string;
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

async function readApiResponse<T>(response: Response, endpoint: string): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(`API GET ${endpoint} returned invalid JSON: ${detail}`);
  }
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const endpoint = joinPathAndQuery(path, params);
  const response = await fetch(`${API_BASE}${endpoint}`, { cache: 'no-store' });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`API GET ${endpoint} failed: ${response.status} ${response.statusText}${message}`);
  }
  const body = await readApiResponse<T>(response, endpoint);
  if (!body.success) {
    throw new Error(`API GET ${endpoint} failed: ${body.message ?? 'unknown API error'}`);
  }
  return body.data;
}
