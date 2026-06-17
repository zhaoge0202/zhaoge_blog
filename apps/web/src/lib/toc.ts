import GithubSlugger from 'github-slugger';

export type TocItem = { depth: number; text: string; id: string };

/**
 * 从 Markdown 源文本解析 H2/H3 标题，生成目录条目。
 * id 用 github-slugger 生成，与 MarkdownBlock 里 rehype-slug 的结果一致。
 */
export function extractToc(markdown: string | null | undefined): TocItem[] {
  if (!markdown) {
    return [];
  }
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) {
      continue;
    }
    const depth = match[1].length;
    const text = match[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .trim();
    if (!text) {
      continue;
    }
    items.push({ depth, text, id: slugger.slug(text) });
  }

  return items;
}

/** 粗略估算中文为主文本的字数与阅读时长（分钟）。 */
export function readingStats(markdown: string | null | undefined) {
  const text = (markdown ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`_~\-]/g, ' ');
  const chars = text.replace(/\s+/g, '').length;
  const minutes = Math.max(1, Math.round(chars / 400));
  return { chars, minutes };
}
