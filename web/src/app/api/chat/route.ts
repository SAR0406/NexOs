import { NextResponse } from "next/server";
import { getBusinessSummary, proposeAction } from "@/lib/mock-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const summary = getBusinessSummary();
  const lower = message.toLowerCase();

  if (lower.includes("focus") || lower.includes("priority")) {
    return NextResponse.json({
      intent: "STRATEGY",
      response: [
        `1) Follow up with ${summary.clients[0].name} (${summary.clients[0].daysSilent} days silent).`,
        "2) Investigate churn drivers from this week and prepare retention offers.",
        "3) Push one pipeline conversion before Friday to offset MRR drop.",
      ],
    });
  }

  if (lower.includes("draft") || lower.includes("follow up")) {
    return NextResponse.json({
      intent: "ACTION_EMAIL",
      action: proposeAction({ target: summary.clients[0].name, objective: "this week's proposal timeline" }),
    });
  }

  return NextResponse.json({
    intent: "QUERY",
    response: `Business health score is ${summary.healthScore}/100 with ${summary.alerts.length} active alerts and MRR at $${summary.revenue.mrr.toLocaleString()}.`,
  });
}
