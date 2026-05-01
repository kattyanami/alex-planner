"use client";

import { useState, useTransition } from "react";
import {
  addAccountAction,
  addPositionAction,
  clearPortfolioAction,
  removeAccountAction,
  removePositionAction,
  seedSamplePortfolioAction,
} from "@/lib/actions/portfolio";
import type { AccountWithPositions } from "@/lib/db/queries";

type InstrumentOption = { symbol: string; name: string; currentPrice: number | null };

export function PortfolioEditor({
  accounts,
  instruments,
}: {
  accounts: AccountWithPositions[];
  instruments: InstrumentOption[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;

  function runAction<T>(fn: () => Promise<T | { error: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r && typeof r === "object" && "error" in r && r.error) setMsg(`✗ ${r.error}`);
    });
  }

  const totalValue = accounts.reduce(
    (sum, a) =>
      sum +
      a.cashBalance +
      a.positions.reduce((s, p) => s + p.quantity * (p.currentPrice ?? 0), 0),
    0,
  );

  return (
    <section className="mt-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Your portfolio</h2>
        {!isEmpty && (
          <div className="text-xs text-zinc-500 font-mono">
            ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} total ·{" "}
            {accounts.length} accounts ·{" "}
            {accounts.reduce((s, a) => s + a.positions.length, 0)} positions
          </div>
        )}
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        The 4-agent analysis below runs against this data. Add accounts, then add holdings (pick from {instruments.length} seeded instruments).
      </p>

      {msg && (
        <div className="mb-4 p-2 rounded text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
          {msg}
        </div>
      )}

      {isEmpty ? (
        <div className="p-6 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-center">
          <p className="text-sm text-zinc-500 mb-4">
            No portfolio yet. Load a sample to see the multi-agent pipeline in action,
            or build your own from scratch.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => runAction(seedSamplePortfolioAction)}
              disabled={pending}
              className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50 text-sm"
            >
              {pending ? "Loading…" : "Load sample portfolio"}
            </button>
            <details className="inline-block">
              <summary className="cursor-pointer h-9 px-4 inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition text-sm select-none">
                Add empty account
              </summary>
              <div className="mt-3">
                <AccountForm pending={pending} onSubmit={runAction} />
              </div>
            </details>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              instruments={instruments}
              pending={pending}
              onAction={runAction}
            />
          ))}

          <details>
            <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 select-none">
              + Add another account
            </summary>
            <div className="mt-3 max-w-md">
              <AccountForm pending={pending} onSubmit={runAction} />
            </div>
          </details>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => {
                if (confirm("Delete all accounts and positions? This can't be undone.")) {
                  runAction(clearPortfolioAction);
                }
              }}
              disabled={pending}
              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Clear entire portfolio
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountCard({
  account,
  instruments,
  pending,
  onAction,
}: {
  account: AccountWithPositions;
  instruments: InstrumentOption[];
  pending: boolean;
  onAction: <T>(fn: () => Promise<T | { error: string }>) => void;
}) {
  const positionsValue = account.positions.reduce(
    (s, p) => s + p.quantity * (p.currentPrice ?? 0),
    0,
  );
  const total = account.cashBalance + positionsValue;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <div>
          <div className="font-semibold">{account.name}</div>
          <div className="text-xs text-zinc-500">
            ${account.cashBalance.toLocaleString()} cash + ${positionsValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} holdings ={" "}
            <strong>${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete ${account.name}? Positions inside will also be removed.`)) {
              onAction(() => removeAccountAction(account.id));
            }
          }}
          disabled={pending}
          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
        >
          Remove account
        </button>
      </div>

      {account.positions.length === 0 ? (
        <div className="text-xs text-zinc-500 italic mb-3">No positions yet.</div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {account.positions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 text-xs bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5 rounded font-mono"
            >
              <div className="flex-1 truncate">
                <span className="font-semibold">{p.symbol}</span>{" "}
                <span className="text-zinc-500">· {p.quantity} shares</span>
                {p.currentPrice && (
                  <span className="text-zinc-500">
                    {" "}
                    · ${(p.quantity * p.currentPrice).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                )}
                <span className="text-zinc-400 ml-2 font-sans">{p.instrumentName}</span>
              </div>
              <button
                onClick={() => onAction(() => removePositionAction(p.id))}
                disabled={pending}
                className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                aria-label={`Remove ${p.symbol}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <PositionForm accountId={account.id} instruments={instruments} pending={pending} onSubmit={onAction} />
    </div>
  );
}

function AccountForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: <T>(fn: () => Promise<T | { error: string }>) => void;
}) {
  return (
    <form
      action={(fd) => onSubmit(() => addAccountAction(fd))}
      className="flex gap-2 items-end flex-wrap"
    >
      <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
        <span className="text-xs text-zinc-500">Account name</span>
        <input
          name="name"
          required
          placeholder="Brokerage / 401(k) / IRA"
          className="h-9 px-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1 w-32">
        <span className="text-xs text-zinc-500">Cash balance</span>
        <input
          name="cash"
          type="number"
          step="100"
          min="0"
          defaultValue={0}
          className="h-9 px-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50 text-sm"
      >
        Add
      </button>
    </form>
  );
}

function PositionForm({
  accountId,
  instruments,
  pending,
  onSubmit,
}: {
  accountId: string;
  instruments: InstrumentOption[];
  pending: boolean;
  onSubmit: <T>(fn: () => Promise<T | { error: string }>) => void;
}) {
  return (
    <form
      action={(fd) => {
        fd.set("accountId", accountId);
        onSubmit(() => addPositionAction(fd));
      }}
      className="flex gap-2 items-end flex-wrap pt-3 border-t border-zinc-200 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <span className="text-xs text-zinc-500">Instrument</span>
        <select
          name="symbol"
          required
          className="h-9 px-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
          defaultValue=""
        >
          <option value="" disabled>
            Pick…
          </option>
          {instruments.map((i) => (
            <option key={i.symbol} value={i.symbol}>
              {i.symbol} — {i.name}
              {i.currentPrice ? ` ($${i.currentPrice})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 w-28">
        <span className="text-xs text-zinc-500">Quantity</span>
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          placeholder="100"
          className="h-9 px-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50 text-sm"
      >
        Add holding
      </button>
    </form>
  );
}
