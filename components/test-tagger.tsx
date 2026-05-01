"use client";

import { useState, useTransition } from "react";
import { runTagger } from "@/lib/actions/tagger";

type TaggerResult = Awaited<ReturnType<typeof runTagger>>;

function nonZero(record: Record<string, number>) {
  return Object.entries(record).filter(([, v]) => v > 0);
}

export function TestTagger() {
  const [result, setResult] = useState<TaggerResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const r = await runTagger(formData);
      setResult(r);
    });
  }

  return (
    <section className="mt-10 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-1">Test the Tagger agent</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Classifies an instrument via GPT-5-mini (cheap fleet) — structured
        output: asset class, regions, sectors.
      </p>

      <form action={onSubmit} className="grid grid-cols-3 gap-3">
        <input
          name="symbol"
          placeholder="VOO"
          defaultValue="VOO"
          required
          className="px-3 h-10 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm font-mono uppercase"
        />
        <input
          name="name"
          placeholder="Vanguard S&P 500 ETF"
          defaultValue="Vanguard S&P 500 ETF"
          required
          className="px-3 h-10 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
        />
        <select
          name="instrument_type"
          defaultValue="etf"
          className="px-3 h-10 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
        >
          <option value="etf">ETF</option>
          <option value="stock">Stock</option>
          <option value="bond_fund">Bond fund</option>
          <option value="mutual_fund">Mutual fund</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="col-span-3 mt-2 h-10 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50"
        >
          {pending ? "Classifying with GPT-5-mini..." : "Tag instrument"}
        </button>
      </form>

      {result && "error" in result && result.error && (
        <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          {result.error}
        </div>
      )}

      {result && "ok" in result && result.ok && (
        <div className="mt-6 space-y-4">
          <div className="text-xs text-zinc-500 font-mono">
            {result.classification.symbol} · {result.tokensIn} in / {result.tokensOut} out
            tokens · {result.ms} ms
          </div>

          <div>
            <div className="font-semibold mb-1">{result.classification.symbol} — {result.classification.name}</div>
            <div className="text-sm text-zinc-500">
              Type: {result.classification.instrument_type} · Price: $
              {result.classification.current_price.toFixed(2)}
            </div>
          </div>

          <Allocation title="Asset class" data={result.classification.allocation_asset_class} />
          <Allocation title="Regions" data={result.classification.allocation_regions} />
          <Allocation title="Sectors" data={result.classification.allocation_sectors} />
        </div>
      )}
    </section>
  );
}

function Allocation({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = nonZero(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 font-mono"
          >
            {k}: {v.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
