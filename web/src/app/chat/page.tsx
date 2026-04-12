export default function ChatPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">NexOS Chat</h1>
      <div className="rounded-xl border border-black/10 bg-white p-6">
        <p className="text-sm text-black/70">
          Use <code className="rounded bg-black/5 px-1">POST /api/chat</code> to query NexOS with grounded business context.
        </p>
        <p className="mt-3 text-sm text-black/70">
          Example prompt: <span className="italic">&quot;What should I focus on this week?&quot;</span>
        </p>
      </div>
    </section>
  );
}
