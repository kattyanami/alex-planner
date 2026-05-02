import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserAccountsDetailed,
  listAllInstruments,
} from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { RefreshPricesButton } from "@/components/refresh-prices-button";

export default async function HoldingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [accounts, allInstruments] = await Promise.all([
    getUserAccountsDetailed(userId),
    listAllInstruments(),
  ]);

  const instrumentOptions = allInstruments.map((i) => ({
    symbol: i.symbol,
    name: i.name,
    currentPrice: i.currentPrice ? Number(i.currentPrice) : null,
  }));

  // Last refresh timestamp = most recent priceUpdatedAt across catalog
  const lastRefresh = allInstruments
    .map((i) => i.priceUpdatedAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const yahooCount = allInstruments.filter((i) => i.priceSource === "yahoo").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        description={`${allInstruments.length} instruments in catalog · ${yahooCount} priced via Yahoo Finance${lastRefresh ? ` · last refresh ${relTime(lastRefresh)}` : ""}`}
        action={<RefreshPricesButton />}
      />
      <PortfolioEditor accounts={accounts} instruments={instrumentOptions} />
    </div>
  );
}

function relTime(date: Date): string {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
