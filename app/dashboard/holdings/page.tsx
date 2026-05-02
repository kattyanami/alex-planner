import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserAccountsDetailed,
  listAllInstruments,
} from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { PortfolioEditor } from "@/components/portfolio-editor";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        description="Manage accounts, cash balances, and positions. The 4-agent analysis runs against this data."
      />
      <PortfolioEditor accounts={accounts} instruments={instrumentOptions} />
    </div>
  );
}
