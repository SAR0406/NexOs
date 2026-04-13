"use client";

import { useEffect, useState } from "react";
import { ActionProposal } from "@/lib/types";

interface ApiState {
  loading: boolean;
  error: string | null;
}

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const [state, setState] = useState<ApiState>({ loading: true, error: null });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadActions() {
      try {
        const response = await fetch("/api/actions", { cache: "no-store" });
        const data = (await response.json()) as { actions?: ActionProposal[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load actions");
        }

        if (active) {
          setActions(data.actions ?? []);
          setState({ loading: false, error: null });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while loading actions. Please refresh the page.",
          });
        }
      }
    }

    void loadActions();

    return () => {
      active = false;
    };
  }, []);

  async function decide(actionId: string, decision: "approve" | "reject") {
    setNotice(null);

    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, decision }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !data.ok) {
      setNotice(data.error ?? "Unable to update action. Please try again.");
      return;
    }

    setActions((prev) =>
      prev.map((action) => {
        if (action.id !== actionId) {
          return action;
        }

        return {
          ...action,
          status: decision === "approve" ? "approved" : "rejected",
        };
      }),
    );
    setNotice(`Action ${actionId} ${decision === "approve" ? "approved" : "rejected"}.`);
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Action Approval Center</h1>

      {state.loading ? <p className="text-sm text-black/60">Loading actions...</p> : null}
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {notice ? <p className="text-sm text-black/70">{notice}</p> : null}

      <div className="space-y-3">
        {actions.map((action) => (
          <article key={action.id} className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-black/50">{action.type}</p>
            <h2 className="mt-1 font-semibold">{action.target}</h2>
            <p className="mt-2 text-sm text-black/65">Status: {action.status}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white"
                onClick={() => decide(action.id, "approve")}
                disabled={action.status !== "pending"}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded-md border border-black/20 px-3 py-1.5 text-sm"
                onClick={() => decide(action.id, "reject")}
                disabled={action.status !== "pending"}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
