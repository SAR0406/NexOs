import { BusinessSummary } from "@/lib/types";

const summary: BusinessSummary = {
  businessName: "Acorn Growth Studio",
  healthScore: 74,
  revenue: {
    mrr: 18400,
    arr: 220800,
    newMrr: 2800,
    churnedMrr: 1200,
    weekOverWeekDelta: -0.08,
  },
  clients: [
    { id: "c1", name: "Northstar Dental", status: "at_risk", daysSilent: 14, lastSignal: "No reply to proposal follow-up" },
    { id: "c2", name: "Beacon Legal", status: "good", daysSilent: 1, lastSignal: "Invoice paid yesterday" },
    { id: "c3", name: "Blueharbor Labs", status: "at_risk", daysSilent: 9, lastSignal: "Negative sentiment in latest thread" },
  ],
  alerts: [
    { id: "a1", type: "silent_client", severity: "medium", title: "Northstar Dental — 14 days since last contact", createdAt: new Date().toISOString(), actionLabel: "Draft follow-up" },
    { id: "a2", type: "mrr_drop", severity: "high", title: "MRR dropped 8.0% week-over-week", createdAt: new Date().toISOString(), actionLabel: "Review churn drivers" },
  ],
  pendingActions: [
    {
      id: "p1",
      type: "email_draft",
      target: "Northstar Dental",
      payload: {
        to: "ops@northstardental.com",
        subject: "Quick follow-up on implementation timeline",
      },
      status: "pending",
    },
  ],
};

export function getBusinessSummary(): BusinessSummary {
  return summary;
}

export function getBriefing() {
  const s = getBusinessSummary();
  return {
    revenue_summary: `MRR: $${s.revenue.mrr.toLocaleString()} (${(s.revenue.weekOverWeekDelta * 100).toFixed(1)}% vs last week). New: $${s.revenue.newMrr.toLocaleString()}. Churned: $${s.revenue.churnedMrr.toLocaleString()}.`,
    client_pulse: s.clients.map((c) => ({ name: c.name, status: c.status, reason: `${c.daysSilent} days silent`, action: c.status === "at_risk" ? "Follow up" : "Monitor" })),
    priorities: [
      "Follow up with Northstar Dental to recover at-risk account",
      "Investigate recent churn and propose retention offer",
      "Close next proposal batch before Friday",
    ],
    insight: "Accounts that went silent for 7+ days in the past month were 3x more likely to churn within 30 days.",
    alerts_count: s.alerts.length,
  };
}

export function proposeAction(input: { target: string; objective: string }) {
  return {
    type: "email_draft",
    target: input.target,
    payload: {
      subject: `Follow-up: ${input.objective}`,
      body: `Hi there,\\n\\nQuick follow-up on ${input.objective}. I wanted to make sure this doesn't stall and to share next best steps.\\n\\nBest,`,
    },
    urgency: "medium",
  };
}
