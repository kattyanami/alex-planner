import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Coins,
  PiggyBank,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import {
  getUserAccountsDetailed,
  getUserProfile,
} from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, KPITile } from "@/components/ui/primitives";
import { fmtUsd } from "@/lib/format";
import { LIFE_DEFAULTS } from "@/lib/finance/assumptions";

export default async function OverviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [profile, accounts] = await Promise.all([
    getUserProfile(userId),
    getUserAccountsDetailed(userId),
  ]);

  const positionsValue = accounts.reduce(
    (s, a) =>
      s + a.positions.reduce((ps, p) => ps + p.quantity * (p.currentPrice ?? 0), 0),
    0,
  );
  const cashValue = accounts.reduce((s, a) => s + a.cashBalance, 0);
  const totalValue = positionsValue + cashValue;
  const positionsCount = accounts.reduce((s, a) => s + a.positions.length, 0);
  const hasPortfolio = positionsCount > 0;

  const yearsToRetirement = profile?.years_until_retirement ?? LIFE_DEFAULTS.yearsUntilRetirement;
  const targetIncome = profile?.target_retirement_income ?? LIFE_DEFAULTS.targetRetirementIncome;
  const safeWithdrawal = totalValue * 0.04;
  const gap = targetIncome - safeWithdrawal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Snapshot of your portfolio, profile, and AI-powered insights."
        action={
          hasPortfolio ? (
            <Link href="/dashboard/analysis">
              <Button>
                <Sparkles className="size-4" />
                Run analysis
              </Button>
            </Link>
          ) : (
            <Link href="/dashboard/holdings">
              <Button>
                <Wallet className="size-4" />
                Add holdings
              </Button>
            </Link>
          )
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPITile
          label="Total Value"
          value={fmtUsd(totalValue, { compact: totalValue >= 100_000 })}
          hint={`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"} · ${positionsCount} ${positionsCount === 1 ? "holding" : "holdings"}`}
          icon={<Wallet className="size-4" />}
          tone={hasPortfolio ? "default" : "default"}
        />
        <KPITile
          label="Years to Retirement"
          value={yearsToRetirement}
          hint={profile?.current_age ? `Age ${profile.current_age} → ${profile.current_age + yearsToRetirement}` : "Set your age in settings"}
          icon={<Target className="size-4" />}
        />
        <KPITile
          label="Target Income / yr"
          value={fmtUsd(targetIncome, { compact: true })}
          hint={`Safe withdraw today: ${fmtUsd(safeWithdrawal, { compact: true })}`}
          icon={<Coins className="size-4" />}
        />
        <KPITile
          label="Income Gap"
          value={gap > 0 ? fmtUsd(gap, { compact: true }) : "On track"}
          hint={gap > 0 ? "vs current 4% rule" : "current portfolio supports target"}
          icon={<PiggyBank className="size-4" />}
          tone={gap > targetIncome * 0.5 ? "warning" : gap > 0 ? "default" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accounts summary */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Wallet className="size-4" />}
            title="Accounts"
            description="Cash + position values across all accounts"
            action={
              <Link href="/dashboard/holdings">
                <Button variant="ghost" size="sm">
                  Edit <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            }
          />
          <CardBody>
            {accounts.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-5" />}
                title="No accounts yet"
                description="Load a sample portfolio or add your accounts to get started."
                action={
                  <Link href="/dashboard/holdings">
                    <Button>
                      Set up holdings <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 -my-2">
                {accounts.map((a) => {
                  const pv = a.positions.reduce((s, p) => s + p.quantity * (p.currentPrice ?? 0), 0);
                  const at = a.cashBalance + pv;
                  const pct = totalValue ? (at / totalValue) * 100 : 0;
                  return (
                    <div key={a.id} className="py-3 flex items-center gap-4">
                      <div className="size-9 grid place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Wallet className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {a.positions.length} holdings · {fmtUsd(a.cashBalance)} cash
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular-nums">{fmtUsd(at)}</div>
                        <div className="text-xs text-zinc-500 tabular-nums">{pct.toFixed(0)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Profile summary */}
        <Card>
          <CardHeader
            icon={<Target className="size-4" />}
            title="Profile"
            action={
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="sm">
                  Edit <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            }
          />
          <CardBody className="space-y-3">
            <Row label="Current age" value={profile?.current_age ?? "—"} />
            <Row label="Years to retirement" value={profile?.years_until_retirement ?? "—"} />
            <Row label="Target income" value={profile?.target_retirement_income ? fmtUsd(profile.target_retirement_income) : "—"} />
            <Row label="Annual contribution" value={profile?.annual_contribution ? fmtUsd(profile.annual_contribution) : "—"} />
            <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
              {hasPortfolio ? (
                <Badge tone="success">
                  <Activity className="size-3" />
                  Ready for analysis
                </Badge>
              ) : (
                <Badge tone="warning">
                  <Activity className="size-3" />
                  Add holdings first
                </Badge>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
