import { IconEdit, IconUpdate } from './icons';

function formatUpdated(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DocFooter({ editHref, updatedAt }: { editHref?: string; updatedAt?: string }) {
  const updated = formatUpdated(updatedAt);
  return (
    <div className="doc-footer-meta">
      {editHref ? (
        <a className="doc-edit-link" href={editHref} target="_blank" rel="noreferrer">
          <IconEdit /> 编辑此页
        </a>
      ) : (
        <span />
      )}
      {updated ? (
        <span className="doc-updated">
          <IconUpdate /> 最近更新：{updated}
        </span>
      ) : null}
    </div>
  );
}
