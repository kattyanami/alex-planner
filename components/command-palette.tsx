"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { refreshPricesAction } from "@/lib/actions/instruments";
import { seedSamplePortfolioAction } from "@/lib/actions/portfolio";
import { runResearcherForUserAction } from "@/lib/actions/research";

type CommandKind = "page" | "action" | "instrument" | "holding";

type Command = {
  id: string;
  kind: CommandKind;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => Promise<void> | void;
};

export type PaletteInstrument = {
  symbol: string;
  name: string;
  currentPrice: number | null;
};

export type PaletteAccount = {
  id: string;
  name: string;
  positionCount: number;
};

export function CommandPalette({
  open,
  onClose,
  instruments,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  instruments: PaletteInstrument[];
  accounts: PaletteAccount[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [actionPending, startAction] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setActionMsg(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build the full command list
  const commands = useMemo<Command[]>(() => {
    const navigate = (path: string) => () => {
      router.push(path);
      onClose();
    };

    const action =
      (label: string, fn: () => Promise<{ error?: string } | { ok: true } | unknown>) =>
      () => {
        startAction(async () => {
          setActionMsg(`Running: ${label}…`);
          const r = (await fn()) as { error?: string } | { ok?: true };
          if (r && "error" in r && r.error) {
            setActionMsg(`✗ ${r.error}`);
          } else {
            setActionMsg(`✓ ${label}`);
            setTimeout(() => onClose(), 800);
          }
        });
      };

    const list: Command[] = [
      // Pages
      { id: "p-overview", kind: "page", label: "Go to Overview", icon: LayoutDashboard, run: navigate("/dashboard") },
      { id: "p-holdings", kind: "page", label: "Go to Holdings", icon: Wallet, run: navigate("/dashboard/holdings") },
      { id: "p-analysis", kind: "page", label: "Go to Analysis", icon: Sparkles, run: navigate("/dashboard/analysis") },
      { id: "p-research", kind: "page", label: "Go to Research", icon: Newspaper, run: navigate("/dashboard/research") },
      { id: "p-settings", kind: "page", label: "Go to Settings", icon: Settings, run: navigate("/dashboard/settings") },

      // Actions (real execution)
      {
        id: "a-refresh-prices",
        kind: "action",
        label: "Refresh prices",
        hint: "Polygon + Yahoo (≈1s)",
        icon: RefreshCw,
        run: action("Refresh prices", refreshPricesAction),
      },
      {
        id: "a-run-research",
        kind: "action",
        label: "Run Researcher",
        hint: "Fetch news per holding (≈3s)",
        icon: Newspaper,
        run: action("Run Researcher", runResearcherForUserAction),
      },
      {
        id: "a-seed",
        kind: "action",
        label: "Load sample portfolio",
        hint: "Idempotent — does nothing if you already have one",
        icon: Sparkles,
        run: action("Load sample portfolio", seedSamplePortfolioAction),
      },
      {
        id: "a-run-analysis",
        kind: "action",
        label: "Open Analysis to run multi-agent",
        hint: "Goes to Analysis page",
        icon: Target,
        run: navigate("/dashboard/analysis"),
      },
    ];

    // Instruments (top 10 matches)
    for (const i of instruments) {
      list.push({
        id: `i-${i.symbol}`,
        kind: "instrument",
        label: `${i.symbol} — ${i.name}`,
        hint: i.currentPrice ? `$${i.currentPrice.toFixed(2)}` : undefined,
        icon: Wallet,
        run: navigate("/dashboard/holdings"),
      });
    }

    // Holdings / accounts
    for (const a of accounts) {
      list.push({
        id: `h-${a.id}`,
        kind: "holding",
        label: a.name,
        hint: `${a.positionCount} ${a.positionCount === 1 ? "holding" : "holdings"}`,
        icon: Wallet,
        run: navigate("/dashboard/holdings"),
      });
    }

    return list;
  }, [router, onClose, instruments, accounts, startAction]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query — show pages + actions only (no flooding with all instruments)
      return commands.filter((c) => c.kind === "page" || c.kind === "action");
    }
    return commands
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [commands, query]);

  // Group by kind for rendering
  const grouped = useMemo(() => {
    const groups: Record<CommandKind, Command[]> = {
      page: [],
      action: [],
      instrument: [],
      holding: [],
    };
    for (const c of filtered) groups[c.kind].push(c);
    return groups;
  }, [filtered]);

  // Flat ordered list for keyboard nav (matches render order)
  const flat = useMemo(
    () => [
      ...grouped.page,
      ...grouped.action,
      ...grouped.instrument,
      ...grouped.holding,
    ],
    [grouped],
  );

  useEffect(() => {
    if (selectedIdx >= flat.length) setSelectedIdx(Math.max(0, flat.length - 1));
  }, [flat.length, selectedIdx]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flat[selectedIdx];
        if (cmd && !actionPending) cmd.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, selectedIdx, onClose, actionPending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-20 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden"
      >
        <div className="relative border-b border-zinc-200/60 dark:border-zinc-800/60">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Search pages, actions, instruments, accounts…"
            className="w-full h-14 pl-11 pr-4 bg-transparent text-base placeholder:text-zinc-400 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No matches.
            </div>
          ) : (
            <>
              {(
                [
                  ["Pages", grouped.page],
                  ["Actions", grouped.action],
                  ["Instruments", grouped.instrument],
                  ["Accounts", grouped.holding],
                ] as const
              )
                .filter(([, list]) => list.length > 0)
                .map(([title, list]) => (
                  <Section key={title} title={title}>
                    {list.map((c) => {
                      const idx = flat.indexOf(c);
                      const Icon = c.icon;
                      const active = idx === selectedIdx;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => !actionPending && c.run()}
                          disabled={actionPending}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition disabled:opacity-50 ${
                            active
                              ? "bg-emerald-500/10"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                          }`}
                        >
                          <Icon
                            className={`size-4 shrink-0 ${
                              active
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-zinc-500"
                            }`}
                          />
                          <span className="flex-1 truncate text-sm">
                            {c.label}
                          </span>
                          {c.hint && (
                            <span className="text-xs text-zinc-500 shrink-0">
                              {c.hint}
                            </span>
                          )}
                          {active && (
                            <CornerDownLeft className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </Section>
                ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/40 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono">
                ⏎
              </kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono">
                esc
              </kbd>
              close
            </span>
          </div>
          {actionPending && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Loader2 className="size-3 animate-spin" />
              {actionMsg ?? "Running…"}
            </span>
          )}
          {!actionPending && actionMsg && (
            <span
              className={
                actionMsg.startsWith("✓")
                  ? "text-emerald-600 dark:text-emerald-400"
                  : actionMsg.startsWith("✗")
                    ? "text-red-600 dark:text-red-400"
                    : ""
              }
            >
              {actionMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
        {title}
      </div>
      {children}
    </div>
  );
}

// Decorate the floating helper with a use to silence unused-import warnings
void ArrowRight;
