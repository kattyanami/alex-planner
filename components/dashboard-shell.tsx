"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  LayoutDashboard,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";
import { fmtUsd } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/holdings", label: "Holdings", icon: Wallet },
  { href: "/dashboard/analysis", label: "Analysis", icon: Sparkles },
  { href: "/dashboard/research", label: "Research", icon: Newspaper, badge: "Soon" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardShell({
  children,
  displayName,
  portfolioValue,
}: {
  children: React.ReactNode;
  displayName?: string | null;
  portfolioValue?: number | null;
}) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      {/* Aurora gradient — fixed, behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px circle at 8% -10%, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 55%), radial-gradient(700px circle at 95% 0%, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0) 55%), radial-gradient(800px circle at 50% 110%, rgba(56,189,248,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Topbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-black/50 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 font-semibold tracking-tight shrink-0"
            >
              <span className="grid place-items-center size-7 rounded-lg bg-emerald-500 text-white shadow-sm shadow-emerald-900/30">
                <Activity className="size-4" />
              </span>
              <span>Alex</span>
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                Planner
              </span>
            </Link>

            {portfolioValue != null && portfolioValue > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Portfolio</span>
                <span className="text-sm font-semibold tabular-nums">
                  {fmtUsd(portfolioValue, { compact: portfolioValue >= 100_000 })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="hidden sm:flex items-center gap-2 px-3 h-8 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-500 text-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-not-allowed"
            >
              <Search className="size-3.5" />
              <span>Search</span>
              <span className="ml-2 px-1.5 py-0.5 rounded font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                ⌘K
              </span>
            </button>
            {displayName && (
              <span className="hidden sm:block text-sm text-zinc-600 dark:text-zinc-400">
                {displayName}
              </span>
            )}
            <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    active
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`size-4 ${
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
