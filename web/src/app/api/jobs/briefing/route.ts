import { NextResponse } from "next/server";
import { runDailyBriefing } from "@/jobs/briefing";

export async function POST() {
  const data = await runDailyBriefing();
  return NextResponse.json({ ok: true, ...data });
}
