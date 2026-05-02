import type React from "react";

/**
 * Surface / Card — the base container. Subtle background, soft border,
 * consistent radius. All section panels build on this.
 */
export function Card({
  className = "",
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/50 shadow-sm transition ${
        interactive
          ? "hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-px"
          : ""
      } ${className}`}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className = "",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/60 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="mt-0.5 size-9 grid place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`p-5 ${className}`} />;
}

/**
 * KPI tile — large number with label and optional trend / sub-text.
 */
export function KPITile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/30"
      : tone === "warning"
        ? "from-amber-500/20 via-amber-500/8 to-transparent border-amber-500/40 dark:border-amber-500/40"
        : tone === "danger"
          ? "from-red-500/20 via-red-500/8 to-transparent border-red-500/40 dark:border-red-500/40"
          : "from-zinc-500/5 to-transparent border-zinc-200/80 dark:border-zinc-800/80";
  return (
    <div
      className={`relative rounded-xl border bg-gradient-to-br p-4 transition hover:-translate-y-px hover:shadow-md ${toneCls}`}
    >
      {icon && (
        <div className="absolute top-3 right-3 text-zinc-400 dark:text-zinc-600">
          {icon}
        </div>
      )}
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * Status badge — colored pill for agent status / labels.
 */
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const cls = {
    neutral:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-700",
    success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-500/20",
    warning:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 ring-amber-200/50 dark:ring-amber-500/20",
    danger:
      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 ring-red-200/50 dark:ring-red-500/20",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 ring-sky-200/50 dark:ring-sky-500/20",
    accent:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-emerald-200/50 dark:ring-emerald-500/20",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${cls} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Buttons — primary (emerald), secondary (zinc outline), danger (red text).
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeCls =
    size === "sm"
      ? "h-8 px-3 text-xs"
      : size === "lg"
        ? "h-11 px-6 text-base"
        : "h-9 px-4 text-sm";
  const variantCls =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/20"
      : variant === "secondary"
        ? "border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        : variant === "ghost"
          ? "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
          : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10";
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variantCls} ${className}`}
    />
  );
}

/**
 * Empty state — used when there's no data yet.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      {icon && (
        <div className="mx-auto size-12 grid place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Skeleton — shimmer block for loading states.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60 ${className}`}
    />
  );
}

/**
 * Form input.
 */
export function Input({
  className = "",
  prefix,
  ...props
}: { prefix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500">
          {prefix}
        </span>
      )}
      <input
        {...props}
        className={`h-9 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 px-3 ${prefix ? "pl-7" : ""} text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition ${className}`}
      />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Section divider (for cards that don't need full sub-cards).
 */
export function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-px bg-zinc-200/60 dark:bg-zinc-800/60 ${className}`}
    />
  );
}
