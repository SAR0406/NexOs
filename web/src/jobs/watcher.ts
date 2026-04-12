import { getBusinessSummary } from "@/lib/mock-data";

export interface WatcherResult {
  scannedAt: string;
  alertsEvaluated: number;
  firedAlerts: string[];
}

export async function runWatcher(): Promise<WatcherResult> {
  const summary = getBusinessSummary();
  const firedAlerts = summary.alerts.map((a) => a.id);

  return {
    scannedAt: new Date().toISOString(),
    alertsEvaluated: summary.alerts.length,
    firedAlerts,
  };
}
