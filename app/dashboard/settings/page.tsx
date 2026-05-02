import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Settings, ShieldCheck } from "lucide-react";
import { getUserProfile } from "@/lib/db/queries";
import { PageHeader } from "@/components/dashboard-shell";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/primitives";
import { ProfileEditor } from "@/components/profile-editor";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [clerkUser, profile] = await Promise.all([
    currentUser(),
    getUserProfile(userId),
  ]);

  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Retirement profile + account info." />

      <ProfileEditor profile={profile} />

      <Card>
        <CardHeader
          icon={<ShieldCheck className="size-4" />}
          title="Account"
          description="Auth + identity managed by Clerk."
        />
        <CardBody className="space-y-3">
          <Row label="Display name" value={profile?.display_name ?? "—"} />
          <Row label="Email" value={email ?? "—"} />
          <Row
            label="Clerk ID"
            value={
              <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/60">
                {userId}
              </code>
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<Settings className="size-4" />}
          title="System"
          description="Stack — for reference."
        />
        <CardBody className="space-y-2">
          <Row label="Auth" value={<Badge tone="success">Clerk v7</Badge>} />
          <Row label="Database" value={<Badge tone="success">Neon Postgres</Badge>} />
          <Row label="ORM" value={<Badge tone="success">Drizzle</Badge>} />
          <Row label="LLM provider" value={<Badge tone="accent">OpenAI · gpt-5-mini</Badge>} />
          <Row label="Framework" value={<Badge tone="neutral">Next.js 16 (App Router)</Badge>} />
          <Row label="Hosting" value={<Badge tone="neutral">Vercel</Badge>} />
        </CardBody>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
