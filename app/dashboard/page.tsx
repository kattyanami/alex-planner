import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { ensureUser, getUser, listInstruments } from "@/lib/db/queries";
import { TestTagger } from "@/components/test-tagger";
import { TestAnalyze } from "@/components/test-analyze";

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

  const [user, sample] = await Promise.all([
    getUser(userId),
    listInstruments(10),
  ]);

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
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

      <section>
        <h2 className="text-xl font-semibold mb-4">
          Available instruments ({sample.length} of 22)
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {sample.map((i) => (
            <li
              key={i.symbol}
              className="px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            >
              <div className="font-mono font-semibold">{i.symbol}</div>
              <div className="text-sm text-zinc-500 truncate">{i.name}</div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500 mt-4">
          ✓ Auth working (Clerk) · ✓ DB query working (Drizzle → Neon)
        </p>
      </section>

      <TestTagger />
      <TestAnalyze />
    </div>
  );
}
