import { apiGet, PersonalNote } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function JourneyPage() {
  const notes = await apiGet<PersonalNote[]>('/api/public/notes');

  return (
    <>
      <p className="eyebrow">Journey</p>
      <h1>心路历程</h1>
      <p className="lead">记录从资料收集到内容纠偏、从背题到形成个人判断的过程。</p>
      <section className="section stack">
        {notes.map((note) => (
          <article className="card" key={note.id}>
            <p className="meta">{note.happenedOn} · {note.noteType}</p>
            <h2>{note.title}</h2>
            <p>{note.content}</p>
          </article>
        ))}
      </section>
    </>
  );
}
