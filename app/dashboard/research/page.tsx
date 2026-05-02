import { Newspaper, Globe, Database, Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard-shell";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from "@/components/ui/primitives";

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        description="Scheduled web research per holding — Vercel Cron triggers a Sandbox running Playwright, results land in pgvector for retrieval."
        action={<Badge tone="warning">Phase 5 — coming next</Badge>}
      />

      <Card>
        <CardHeader
          icon={<Newspaper className="size-4" />}
          title="Researcher pipeline"
          description="Mirrors the right side of the AWS architecture (Scheduler → Researcher → Ingest → Vector Store)."
        />
        <CardBody>
          <EmptyState
            icon={<Newspaper className="size-5" />}
            title="Researcher not enabled yet"
            description="Once Phase 5 ships, this page shows last cron run, doc count per symbol, and latest fetched headlines for each holding in your portfolio."
          />
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Clock className="size-4" />}
            title="Scheduler"
            description="Vercel Cron"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Nightly trigger at 02:00 UTC, configurable in <code className="text-xs">vercel.json</code>. Replaces AWS EventBridge.
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<Globe className="size-4" />}
            title="Researcher"
            description="Sandbox + Playwright"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            Ephemeral isolated VM scrapes per-holding sources (Yahoo Finance, SEC EDGAR). Replaces AWS Lambda + Playwright Layer.
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<Database className="size-4" />}
            title="Vector store"
            description="Neon pgvector"
          />
          <CardBody className="text-sm text-zinc-500 dark:text-zinc-400">
            OpenAI embeddings stored alongside docs in Neon, queried at agent runtime. Replaces AWS S3 Vectors.
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
