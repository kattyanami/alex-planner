"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen grid place-items-center bg-black text-white px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something broke at a deep level.
          </h1>
          <p className="text-sm text-zinc-400">
            The app caught an error that escaped page-level recovery. Reloading
            usually fixes it.
          </p>
          {error.digest && (
            <code className="block text-[11px] font-mono text-zinc-500 break-all">
              digest: {error.digest}
            </code>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="h-9 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
