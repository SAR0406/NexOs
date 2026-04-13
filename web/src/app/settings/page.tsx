export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="rounded-xl border border-black/10 bg-white p-6 text-sm text-black/70">
        <p>Configure alert thresholds, integrations, billing, and execution approval settings.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Silent client threshold (default 7 days)</li>
          <li>MRR drop threshold (default 10%)</li>
          <li>Execution mode (manual approval required)</li>
        </ul>
      </div>
    </section>
  );
}
