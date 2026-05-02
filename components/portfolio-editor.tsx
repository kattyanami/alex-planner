"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, Trash2, Wallet, X } from "lucide-react";
import {
  addAccountAction,
  addPositionAction,
  clearPortfolioAction,
  removeAccountAction,
  removePositionAction,
  seedSamplePortfolioAction,
} from "@/lib/actions/portfolio";
import type { AccountWithPositions } from "@/lib/db/queries";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
} from "@/components/ui/primitives";
import { InstrumentCombobox, type InstrumentOption } from "@/components/instrument-combobox";
import { fmtUsd } from "@/lib/format";

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
      if (r && typeof r === "object" && "error" in r && r.error) setMsg(r.error);
    });
  }

  return (
    <Card>
      <CardHeader
        icon={<Wallet className="size-4" />}
        title="Holdings"
        description={`The 4-agent analysis runs against this data — pick from ${instruments.length} seeded instruments.`}
        action={
          !isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Delete all accounts and positions? This can't be undone.")) {
                  runAction(clearPortfolioAction);
                }
              }}
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
              Clear all
            </Button>
          )
        }
      />
      <CardBody>
        {msg && (
          <div className="mb-4 rounded-lg p-3 text-sm bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-200/50 dark:ring-red-500/20">
            {msg}
          </div>
        )}

        {isEmpty ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No portfolio yet"
            description="Load a sample to see the multi-agent pipeline in action, or build your own from scratch."
            action={
              <>
                <Button onClick={() => runAction(seedSamplePortfolioAction)} disabled={pending}>
                  <Sparkles className="size-4" />
                  {pending ? "Loading…" : "Load sample portfolio"}
                </Button>
                <details className="inline-block">
                  <summary className="list-none cursor-pointer h-9 px-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-sm font-medium select-none">
                    <Plus className="size-4" />
                    Add empty account
                  </summary>
                  <div className="mt-3 max-w-md mx-auto text-left">
                    <AccountForm pending={pending} onSubmit={runAction} />
                  </div>
                </details>
              </>
            }
          />
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

            <details className="group">
              <summary className="list-none cursor-pointer text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 select-none flex items-center gap-1.5">
                <Plus className="size-4" />
                Add another account
              </summary>
              <div className="mt-3 max-w-md">
                <AccountForm pending={pending} onSubmit={runAction} />
              </div>
            </details>
          </div>
        )}
      </CardBody>
    </Card>
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
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2">
            {account.name}
            <Badge tone="neutral">{account.positions.length} holdings</Badge>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {fmtUsd(account.cashBalance)} cash + {fmtUsd(positionsValue)} holdings ={" "}
            <span className="font-semibold">{fmtUsd(total)}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Delete ${account.name}?`)) onAction(() => removeAccountAction(account.id));
          }}
          disabled={pending}
          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {account.positions.length === 0 ? (
          <div className="text-xs text-zinc-500 italic text-center py-2">No positions yet — add one below.</div>
        ) : (
          <div className="space-y-1.5">
            {account.positions.map((p) => {
              const value = p.quantity * (p.currentPrice ?? 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60"
                >
                  <Badge tone="accent" className="font-mono">{p.symbol}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{p.instrumentName}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">
                      {p.quantity} shares
                      {p.currentPrice ? ` × ${fmtUsd(p.currentPrice)}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums shrink-0">
                    {fmtUsd(value)}
                  </div>
                  <button
                    onClick={() => onAction(() => removePositionAction(p.id))}
                    disabled={pending}
                    className="size-7 grid place-items-center rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                    aria-label={`Remove ${p.symbol}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <PositionForm
          accountId={account.id}
          instruments={instruments}
          pending={pending}
          onSubmit={onAction}
        />
      </div>
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
      className="grid grid-cols-[1fr_auto_auto] gap-2 items-end"
    >
      <Field label="Account name">
        <Input name="name" required placeholder="Brokerage / 401(k) / IRA" />
      </Field>
      <Field label="Cash">
        <Input name="cash" type="number" step="100" min="0" defaultValue={0} prefix="$" className="w-28" />
      </Field>
      <Button type="submit" disabled={pending}>
        <Plus className="size-4" />
        Add
      </Button>
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
      className="grid grid-cols-[1fr_auto_auto] gap-2 items-end pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60"
    >
      <Field label="Add holding">
        <InstrumentCombobox options={instruments} required />
      </Field>
      <Field label="Quantity">
        <Input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          placeholder="100"
          className="w-24"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        <Plus className="size-4" />
      </Button>
    </form>
  );
}
