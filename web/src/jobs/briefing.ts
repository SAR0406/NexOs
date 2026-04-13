import { getBriefing } from "@/lib/mock-data";

export interface BriefingJobResult {
  generatedAt: string;
  alertsCount: number;
}

export async function runDailyBriefing() {
  const briefing = getBriefing();

  const result: BriefingJobResult = {
    generatedAt: new Date().toISOString(),
    alertsCount: briefing.alerts_count,
  };

  return { briefing, result };
}
