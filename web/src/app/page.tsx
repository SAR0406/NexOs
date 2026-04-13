import Link from "next/link";

export default function Home() {
  return (
    <section className="space-y-8">
      <div className="rounded-xl border border-black/10 bg-white p-8">
        <p className="text-xs tracking-[0.2em] text-black/50">NEXOS · APRIL 2026</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">AI Chief of Staff for Solopreneurs</h1>
        <p className="mt-4 max-w-3xl text-black/70">
          NexOS helps founders run their business with persistent memory, proactive alerts, strategic planning, and one-tap task execution.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-md bg-black px-4 py-2 text-sm text-white">
            Open Dashboard
          </Link>
          <Link href="/onboarding" className="rounded-md border border-black/20 px-4 py-2 text-sm">
            Start Onboarding
          </Link>
          <Link href="/chat" className="rounded-md border border-black/20 px-4 py-2 text-sm">
            Ask NexOS
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Know", "Persistent business memory"],
          ["Watch", "24/7 signal monitoring"],
          ["Plan", "Data-grounded priorities"],
          ["Act", "Approval-based autonomous execution"],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-black/65">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
