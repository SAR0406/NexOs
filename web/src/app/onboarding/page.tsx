"use client";

import { FormEvent, useState } from "react";

interface OnboardingResult {
  businessName: string;
  niche: string;
  revenueModel: string;
}

export default function OnboardingPage() {
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [revenueModel, setRevenueModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, niche, revenueModel }),
      });

      const data = (await response.json()) as { error?: string; profile?: OnboardingResult };

      if (!response.ok) {
        setError(data.error ?? "Failed to save onboarding profile");
        setResult(null);
        return;
      }

      setResult(data.profile ?? null);
    } catch {
      setError("Network error while saving onboarding profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Business Onboarding Interview</h1>

      <div className="rounded-xl border border-black/10 bg-white p-6 text-sm text-black/70">
        <p>Answer the core onboarding prompts so NexOS can build your initial business memory model.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>What does your business do?</li>
          <li>How do you generate revenue?</li>
          <li>What is your biggest current bottleneck?</li>
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-black/10 bg-white p-6">
        <Field label="Business name" value={businessName} onChange={setBusinessName} required />
        <Field label="Niche" value={niche} onChange={setNiche} />
        <Field label="Revenue model" value={revenueModel} onChange={setRevenueModel} />

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save onboarding profile"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="rounded-xl border border-black/10 bg-white p-6 text-sm">
          <p className="font-medium">Onboarding profile saved</p>
          <p className="mt-2 text-black/70">Business: {result.businessName}</p>
          <p className="text-black/70">Niche: {result.niche}</p>
          <p className="text-black/70">Revenue model: {result.revenueModel}</p>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-md border border-black/20 bg-white px-3 py-2"
      />
    </label>
  );
}
