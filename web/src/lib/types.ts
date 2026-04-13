export type AlertSeverity = "low" | "medium" | "high";

export interface RevenueSnapshot {
  mrr: number;
  arr: number;
  newMrr: number;
  churnedMrr: number;
  weekOverWeekDelta: number;
}

export interface ClientHealth {
  id: string;
  name: string;
  status: "good" | "at_risk";
  daysSilent: number;
  lastSignal: string;
}

export interface AlertItem {
  id: string;
  type: "silent_client" | "mrr_drop" | "payment_failed" | "cancellation";
  severity: AlertSeverity;
  title: string;
  createdAt: string;
  actionLabel: string;
}

export interface ActionProposal {
  id: string;
  type: "email_draft" | "notion_update" | "calendar_event";
  target: string;
  payload: Record<string, string>;
  status: "pending" | "approved" | "rejected";
}

export interface BusinessSummary {
  businessName: string;
  healthScore: number;
  revenue: RevenueSnapshot;
  clients: ClientHealth[];
  alerts: AlertItem[];
  pendingActions: ActionProposal[];
}

export interface MemoryChunk {
  id: string;
  source: "gmail" | "stripe" | "notion" | "onboarding";
  content: string;
}

export interface MemoryContext {
  contextSummary: string;
  chunks: MemoryChunk[];
}
