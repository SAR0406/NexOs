import { NextResponse } from "next/server";
import { getBusinessSummary } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ actions: getBusinessSummary().pendingActions });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { actionId?: string; decision?: "approve" | "reject" };

  if (!body.actionId || !body.decision) {
    return NextResponse.json({ error: "actionId and decision are required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, actionId: body.actionId, decision: body.decision });
}
