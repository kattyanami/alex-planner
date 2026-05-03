import { auth } from "@clerk/nextjs/server";
import { streamRetirement } from "@/lib/agents/retirement";
import { getUserPortfolio, getUserProfile } from "@/lib/db/queries";

export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const [portfolio, profile] = await Promise.all([
    getUserPortfolio(userId),
    getUserProfile(userId),
  ]);

  const isEmpty =
    portfolio.accounts.length === 0 ||
    portfolio.accounts.every((a) => a.positions.length === 0);
  if (isEmpty) {
    return new Response("No portfolio yet. Add holdings first.", {
      status: 400,
    });
  }

  const stream = await streamRetirement(portfolio, profile ?? {}, {
    currentAge: profile?.current_age ?? undefined,
    annualContribution: profile?.annual_contribution ?? undefined,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
