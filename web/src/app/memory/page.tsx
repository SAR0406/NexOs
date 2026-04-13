import { getMemoryContext } from "@/lib/mock-data";

export default function MemoryPage() {
  const memory = getMemoryContext();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Business Memory</h1>

      <article className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold">Context Summary</h2>
        <p className="mt-2 text-sm text-black/70">{memory.contextSummary}</p>
      </article>

      <article className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold">Recent Memory Chunks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {memory.chunks.map((chunk) => (
            <li key={chunk.id} className="rounded-md border border-black/10 p-3">
              <p className="text-xs uppercase tracking-wider text-black/50">{chunk.source}</p>
              <p className="mt-1 text-black/75">{chunk.content}</p>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
