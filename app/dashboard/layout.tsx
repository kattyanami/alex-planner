import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureUser, getUserAccountsDetailed } from "@/lib/db/queries";
import { DashboardShell } from "@/components/dashboard-shell";

export const maxDuration = 60;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    null;

  await ensureUser(userId, displayName ?? undefined);

  // Compute portfolio value for the topbar pill
  const accounts = await getUserAccountsDetailed(userId);
  const portfolioValue = accounts.reduce(
    (sum, a) =>
      sum +
      a.cashBalance +
      a.positions.reduce((s, p) => s + p.quantity * (p.currentPrice ?? 0), 0),
    0,
  );

  return (
    <DashboardShell displayName={displayName} portfolioValue={portfolioValue}>
      {children}
    </DashboardShell>
  );
}
