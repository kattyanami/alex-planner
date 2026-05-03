import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Database, Globe } from "lucide-react";
import { getResearchSummaryForUser, getUserAccountsDetailed } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ResearcherPanel } from "@/components/researcher-panel";

export default async function ResearchPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [accounts, summary] = await Promise.all([
    getUserAccountsDetailed(userId),
    getResearchSummaryForUser(userId),
  ]);

  const hasHoldings = accounts.some((a) => a.positions.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        description="Per-holding news fetched from Yahoo Finance. Deduplicated by URL hash. Will feed Phase 6 pgvector retrieval so the Reporter agent can RAG over real headlines."
      />

      <ResearcherPanel summary={summary.symbols} hasHoldings={hasHoldings} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Globe className="size-4" />}
            title="Researcher"
            description="Yahoo Finance news"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Currently fetches ~6 recent news articles per holding via{" "}
            <code className="font-mono text-xs">yahoo-finance2</code>. Upgrade
            path: replace the inner fetcher with Vercel Sandbox + Playwright
            for JS-heavy sources (SEC EDGAR, earnings transcripts).
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<Database className="size-4" />}
            title="Storage"
            description="Postgres → pgvector (Phase 6)"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Documents land in{" "}
            <code className="font-mono text-xs">research_documents</code> with
            unique{" "}
            <code className="font-mono text-xs">(symbol, hash)</code> dedup.
            Phase 6 will add an embeddings column + similarity search so the
            Reporter agent can RAG over real news instead of training data.
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
