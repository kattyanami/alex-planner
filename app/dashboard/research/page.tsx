import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Brain, Database, Globe } from "lucide-react";
import {
  getEmbeddingStatus,
  getResearchSummaryForUser,
  getUserAccountsDetailed,
} from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ResearcherPanel } from "@/components/researcher-panel";

export default async function ResearchPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [accounts, summary, embed] = await Promise.all([
    getUserAccountsDetailed(userId),
    getResearchSummaryForUser(userId),
    getEmbeddingStatus(),
  ]);

  const hasHoldings = accounts.some((a) => a.positions.length > 0);
  const embedTone =
    embed.total === 0 ? "neutral" : embed.pending === 0 ? "success" : "warning";
  const embedLabel =
    embed.total === 0
      ? "no docs yet"
      : embed.pending === 0
        ? `${embed.embedded} embedded`
        : `${embed.embedded}/${embed.total} embedded · ${embed.pending} pending`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        description="Per-holding news fetched from Yahoo Finance, embedded with text-embedding-3-small, retrieved via pgvector cosine similarity. The Reporter agent RAGs over relevant headlines on every analysis run."
        action={
          <Badge tone={embedTone}>
            <Brain className="size-3" />
            {embedLabel}
          </Badge>
        }
      />

      <ResearcherPanel summary={summary.symbols} hasHoldings={hasHoldings} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Globe className="size-4" />}
            title="Researcher"
            description="Yahoo Finance news"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Fetches ~6 recent news articles per holding via{" "}
            <code className="font-mono text-xs">yahoo-finance2</code>. Upgrade
            path: replace the inner fetcher with Vercel Sandbox + Playwright
            for JS-heavy sources (SEC EDGAR, earnings transcripts).
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<Brain className="size-4" />}
            title="Embedder"
            description="OpenAI text-embedding-3-small"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Each doc embedded into a 1536-dim vector and stored in{" "}
            <code className="font-mono text-xs">research_documents.embedding</code>
            . HNSW index on{" "}
            <code className="font-mono text-xs">vector_cosine_ops</code> for
            sub-millisecond retrieval at any scale. Embedding happens automatically
            after every &quot;Run now&quot;.
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<Database className="size-4" />}
            title="Reporter RAG"
            description="Top-3 docs per holding"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            On every analysis run, Reporter builds one portfolio-aware query
            embedding and retrieves the top-3 most relevant headlines per
            holding via pgvector{" "}
            <code className="font-mono text-xs">{"<=>"}</code> cosine
            distance. Headlines are injected into the prompt with relevance
            scores; the agent cites them when material.
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
