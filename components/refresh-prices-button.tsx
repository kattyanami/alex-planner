"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { refreshPricesAction } from "@/lib/actions/instruments";
import { Button } from "@/components/ui/primitives";

export function RefreshPricesButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function onClick() {
    setMsg(null);
    start(async () => {
      const r = await refreshPricesAction();
      if ("error" in r) {
        setMsg({ kind: "err", text: r.error });
        return;
      }
      const breakdown = r.byProvider
        ? Object.entries(r.byProvider)
            .map(([p, n]) => `${n} via ${p}`)
            .join(", ")
        : "";
      const detail =
        r.missed > 0
          ? `Updated ${r.updated} of ${r.total}${breakdown ? ` (${breakdown})` : ""}. ${r.missed} unavailable.`
          : `Updated all ${r.updated}${breakdown ? ` (${breakdown})` : ""}.`;
      setMsg({ kind: "ok", text: `${detail} (${(r.ms / 1000).toFixed(1)}s)` });
      // auto-clear in 8s
      setTimeout(() => setMsg(null), 8000);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span
          className={`text-xs ${
            msg.kind === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {msg.kind === "ok" ? "✓" : "✗"} {msg.text}
        </span>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {pending ? "Refreshing…" : "Refresh prices"}
      </Button>
    </div>
  );
}
