"use client";

import { FormEvent, useState } from "react";

type ChatResult = {
  intent: string;
  response?: string | string[];
  action?: {
    type: string;
    target: string;
    payload: Record<string, string>;
    urgency?: string;
  };
};

const DEFAULT_PROMPT = "What should I focus on this week?";

export default function ChatPage() {
  const [message, setMessage] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = (await response.json()) as ChatResult & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Chat request failed");
        setResult(null);
        return;
      }

      setResult(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to send message. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">NexOS Chat</h1>

      <form onSubmit={onSubmit} className="rounded-xl border border-black/10 bg-white p-6">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-black/20 bg-white px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-3 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask NexOS"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {result ? (
        <article className="rounded-xl border border-black/10 bg-white p-6 text-sm">
          <p className="text-xs uppercase tracking-wider text-black/50">Intent: {result.intent}</p>

          {Array.isArray(result.response) ? (
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {result.response.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : result.response ? (
            <p className="mt-3 text-black/75">{result.response}</p>
          ) : null}

          {result.action ? (
            <div className="mt-4 rounded-md border border-black/10 bg-black/[0.02] p-4">
              <p className="font-medium">Proposed action: {result.action.type}</p>
              <p className="mt-1 text-black/70">Target: {result.action.target}</p>
              <p className="mt-1 text-black/70">Subject: {result.action.payload.subject ?? "-"}</p>
              <p className="mt-1 text-black/70">Urgency: {result.action.urgency ?? "medium"}</p>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
