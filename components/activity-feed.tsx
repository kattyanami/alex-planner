import {
  Activity,
  FileEdit,
  FilePlus,
  FileX,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
  WalletMinimal,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/db/schema";

const ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  account_added: { icon: Wallet, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  account_removed: { icon: WalletMinimal, tone: "text-red-600 dark:text-red-400 bg-red-500/10" },
  position_added: { icon: FilePlus, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  position_removed: { icon: FileX, tone: "text-red-600 dark:text-red-400 bg-red-500/10" },
  profile_saved: { icon: FileEdit, tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
  sample_loaded: { icon: Plus, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  portfolio_cleared: { icon: Trash2, tone: "text-red-600 dark:text-red-400 bg-red-500/10" },
  analysis_completed: { icon: Sparkles, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
};

function relativeTime(date: Date | null) {
  if (!date) return "—";
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(date).toLocaleDateString();
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8 italic">
        No activity yet — your moves will land here.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((e) => {
        const cfg = ICON[e.kind] ?? { icon: Activity, tone: "text-zinc-500 bg-zinc-500/10" };
        const Icon = cfg.icon;
        return (
          <li key={e.id} className="flex items-start gap-3">
            <span className={`mt-0.5 size-7 grid place-items-center rounded-full ${cfg.tone} shrink-0`}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-snug">{e.description}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {relativeTime(e.createdAt)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
