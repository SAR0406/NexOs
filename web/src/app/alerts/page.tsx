import { getBusinessSummary } from "@/lib/mock-data";

export default function AlertsPage() {
  const alerts = getBusinessSummary().alerts;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-black/50">{alert.severity}</p>
            <h2 className="mt-1 font-semibold">{alert.title}</h2>
            <p className="mt-2 text-sm text-black/65">Suggested action: {alert.actionLabel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
