import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  ensureUser,
  getUser,
  getUserAccountsDetailed,
  getUserProfile,
  listAllInstruments,
} from "@/lib/db/queries";
import { TestTagger } from "@/components/test-tagger";
import { TestAnalyze } from "@/components/test-analyze";
import { ProfileEditor } from "@/components/profile-editor";
import { PortfolioEditor } from "@/components/portfolio-editor";

export const maxDuration = 60;

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const displayName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  await ensureUser(userId, displayName || undefined);

  const [user, profile, accounts, allInstruments] = await Promise.all([
    getUser(userId),
    getUserProfile(userId),
    getUserAccountsDetailed(userId),
    listAllInstruments(),
  ]);

  const instrumentOptions = allInstruments.map((i) => ({
    symbol: i.symbol,
    name: i.name,
    currentPrice: i.currentPrice ? Number(i.currentPrice) : null,
  }));

  const hasPortfolio =
    accounts.length > 0 && accounts.some((a) => a.positions.length > 0);

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, {user?.displayName || "there"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Clerk ID: <code className="font-mono text-xs">{userId}</code>
          </p>
        </div>
        <UserButton />
      </header>

      <ProfileEditor profile={profile} />
      <PortfolioEditor accounts={accounts} instruments={instrumentOptions} />
      <TestAnalyze hasPortfolio={hasPortfolio} />

      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 select-none">
          Debug tools
        </summary>
        <TestTagger />
      </details>
    </div>
  );
}
