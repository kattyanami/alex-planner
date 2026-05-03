"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <div className="max-w-md w-full rounded-xl border border-red-300/40 bg-red-50/40 dark:bg-red-500/5 p-6 text-center space-y-4">
        <div className="size-12 mx-auto grid place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong on the dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          An unexpected error occurred. The team has been logged. You can try
          again, or jump back to the overview.
        </p>
        {error.digest && (
          <code className="block text-[11px] font-mono text-zinc-500 break-all">
            digest: {error.digest}
          </code>
        )}
        <div className="flex justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center h-9 px-4 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-sm font-medium transition"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
