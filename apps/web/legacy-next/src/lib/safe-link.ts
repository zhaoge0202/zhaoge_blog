const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeHref(href?: string | null): string | null {
  const value = href?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('/') || value.startsWith('#')) {
    return value;
  }

  try {
    const url = new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function externalLinkProps(href?: string | null) {
  const safe = safeHref(href);
  return {
    href: safe ?? '#',
    rel: safe?.startsWith('http') ? 'noreferrer' : undefined,
    target: safe?.startsWith('http') ? '_blank' : undefined,
  };
}
