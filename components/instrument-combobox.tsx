"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { addInstrumentAction } from "@/lib/actions/instruments";

export type InstrumentOption = {
  symbol: string;
  name: string;
  currentPrice: number | null;
};

/**
 * Searchable instrument picker with on-demand catalog expansion via Tagger.
 *
 * - Type to filter the seeded catalog
 * - If the typed symbol doesn't exist, an "Add to catalog" row appears
 *   that calls the Tagger agent and inserts a new instrument row
 * - Renders a hidden <input name="symbol"> so it composes with <form action>
 */
export function InstrumentCombobox({
  options,
  name = "symbol",
  required,
  onAdded,
}: {
  options: InstrumentOption[];
  name?: string;
  required?: boolean;
  onAdded?: (option: InstrumentOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<InstrumentOption | null>(null);
  const [adding, startAdd] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localOptions, setLocalOptions] = useState(options);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const upper = query.trim().toUpperCase();

  const matches = useMemo(() => {
    if (!upper) return localOptions.slice(0, 8);
    return localOptions
      .filter(
        (o) =>
          o.symbol.includes(upper) ||
          o.name.toUpperCase().includes(upper),
      )
      .slice(0, 8);
  }, [upper, localOptions]);

  const exactMatch = upper && localOptions.find((o) => o.symbol === upper);
  const showAddRow = upper.length >= 1 && !exactMatch && !adding;

  function selectOption(o: InstrumentOption) {
    setSelected(o);
    setQuery("");
    setOpen(false);
    setError(null);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setError(null);
    setOpen(true);
  }

  function handleAdd() {
    setError(null);
    startAdd(async () => {
      const r = await addInstrumentAction(upper);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      const newOpt: InstrumentOption = {
        symbol: r.instrument.symbol,
        name: r.instrument.name,
        currentPrice: r.instrument.currentPrice,
      };
      if (r.created) {
        setLocalOptions((prev) =>
          [newOpt, ...prev.filter((p) => p.symbol !== newOpt.symbol)].sort((a, b) =>
            a.symbol.localeCompare(b.symbol),
          ),
        );
        onAdded?.(newOpt);
      }
      selectOption(newOpt);
    });
  }

  return (
    <div ref={wrapperRef} className="relative">
      {selected ? (
        <div className="h-9 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 flex items-center gap-2 text-sm">
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
            {selected.symbol}
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1 text-xs">
            {selected.name}
          </span>
          {selected.currentPrice && (
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">
              ${selected.currentPrice.toFixed(2)}
            </span>
          )}
          <button
            type="button"
            onClick={clear}
            className="size-5 grid place-items-center rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
            aria-label="Clear selection"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setError(null);
            }}
            placeholder="Search or add (AAPL, BTC, ARKK…)"
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
          />
        </div>
      )}

      {/* Hidden input so this composes inside a <form action={...}> */}
      <input
        type="hidden"
        name={name}
        value={selected?.symbol ?? ""}
        required={required}
      />

      {open && !selected && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[280px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {matches.length > 0 ? (
            <ul className="py-1">
              {matches.map((o) => (
                <li key={o.symbol}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(o)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-emerald-500/5 transition text-left"
                  >
                    <span className="font-mono font-semibold text-sm shrink-0 w-14">
                      {o.symbol}
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                      {o.name}
                    </span>
                    {o.currentPrice && (
                      <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                        ${o.currentPrice.toFixed(2)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !showAddRow && (
              <div className="px-3 py-3 text-sm text-zinc-500">No matches.</div>
            )
          )}

          {showAddRow && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAdd}
              disabled={adding}
              className="w-full flex items-center gap-3 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-emerald-500/5 hover:bg-emerald-500/10 transition text-left disabled:opacity-60"
            >
              <span className="size-7 grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                {adding ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {adding ? "Tagger classifying…" : (
                    <>
                      Add <span className="font-mono">&quot;{upper}&quot;</span> to catalog
                    </>
                  )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {adding
                    ? "Calling gpt-5-mini for asset class, sectors, regions, price"
                    : "Tagger will classify this instrument and add it for everyone"}
                </div>
              </div>
              {!adding && <Plus className="size-4 text-emerald-600 dark:text-emerald-400" />}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
