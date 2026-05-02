import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserAccountsDetailed } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { TestAnalyze } from "@/components/test-analyze";

export default async function AnalysisPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const accounts = await getUserAccountsDetailed(userId);
  const hasPortfolio =
    accounts.length > 0 && accounts.some((a) => a.positions.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analysis"
        description="Multi-agent portfolio analysis — Tagger × N + Reporter + Charter + Retirement run in parallel via Promise.all."
      />
      <TestAnalyze hasPortfolio={hasPortfolio} />
    </div>
  );
}
