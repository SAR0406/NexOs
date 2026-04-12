import { getBusinessSummary } from "@/lib/mock-data";

export default function DashboardPage() {
  const summary = getBusinessSummary();

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-black/10 bg-white p-6">
        <h1 className="text-2xl font-semibold">{summary.businessName}</h1>
        <p className="mt-1 text-sm text-black/65">Business Health Score: {summary.healthScore}/100</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="MRR" value={`$${summary.revenue.mrr.toLocaleString()}`} />
        <Metric title="New MRR" value={`$${summary.revenue.newMrr.toLocaleString()}`} />
        <Metric title="Churned MRR" value={`$${summary.revenue.churnedMrr.toLocaleString()}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-6">
          <h2 className="font-semibold">Active Alerts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.alerts.map((alert) => (
              <li key={alert.id} className="rounded-md border border-black/10 p-3">
                <p className="font-medium">{alert.title}</p>
                <p className="mt-1 text-black/60">Action: {alert.actionLabel}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-6">
          <h2 className="font-semibold">Pending Actions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.pendingActions.map((action) => (
              <li key={action.id} className="rounded-md border border-black/10 p-3">
                <p className="font-medium">{action.type} for {action.target}</p>
                <p className="mt-1 text-black/60">Status: {action.status}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-6">
      <p className="text-xs uppercase tracking-wider text-black/50">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
