import { NextResponse } from "next/server";
import { runWatcher } from "@/jobs/watcher";

export async function POST() {
  const result = await runWatcher();
  return NextResponse.json({ ok: true, ...result });
}
