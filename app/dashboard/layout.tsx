import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ensureUser,
  getUserAccountsDetailed,
  listAllInstruments,
} from "@/lib/db/queries";
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

  const [accounts, instruments] = await Promise.all([
    getUserAccountsDetailed(userId),
    listAllInstruments(),
  ]);

  const portfolioValue = accounts.reduce(
    (sum, a) =>
      sum +
      a.cashBalance +
      a.positions.reduce((s, p) => s + p.quantity * (p.currentPrice ?? 0), 0),
    0,
  );

  const paletteInstruments = instruments.map((i) => ({
    symbol: i.symbol,
    name: i.name,
    currentPrice: i.currentPrice ? Number(i.currentPrice) : null,
  }));

  const paletteAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    positionCount: a.positions.length,
  }));

  return (
    <DashboardShell
      displayName={displayName}
      portfolioValue={portfolioValue}
      paletteInstruments={paletteInstruments}
      paletteAccounts={paletteAccounts}
    >
      {children}
    </DashboardShell>
  );
}
