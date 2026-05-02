"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  addAccount,
  addPosition,
  clearUserPortfolio,
  logActivity,
  removeAccount,
  removePosition,
  seedSamplePortfolioForUser,
  setAccountCash,
} from "@/lib/db/queries";

async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

function refresh() {
  revalidatePath("/dashboard");
}

export async function seedSamplePortfolioAction() {
  try {
    const userId = await requireUser();
    const r = await seedSamplePortfolioForUser(userId);
    if (!r.skipped) {
      await logActivity(userId, "sample_loaded", "Loaded sample portfolio", {
        accounts: 2,
        positions: 5,
      });
    }
    refresh();
    return { ok: true, skipped: r.skipped } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function clearPortfolioAction() {
  try {
    const userId = await requireUser();
    await clearUserPortfolio(userId);
    await logActivity(userId, "portfolio_cleared", "Cleared all accounts and positions");
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function addAccountAction(formData: FormData) {
  try {
    const userId = await requireUser();
    const name = String(formData.get("name") ?? "").trim();
    const cashRaw = formData.get("cash");
    const cash = cashRaw ? Number(cashRaw) : 0;
    if (!name) return { error: "Account name is required" };
    if (Number.isNaN(cash) || cash < 0) return { error: "Cash balance must be ≥ 0" };
    await addAccount(userId, name, cash);
    await logActivity(userId, "account_added", `Added account "${name}"`, { cash });
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function removeAccountAction(accountId: string) {
  try {
    const userId = await requireUser();
    await removeAccount(userId, accountId);
    await logActivity(userId, "account_removed", "Removed an account", { accountId });
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function setAccountCashAction(accountId: string, cash: number) {
  try {
    const userId = await requireUser();
    if (Number.isNaN(cash) || cash < 0) return { error: "Cash balance must be ≥ 0" };
    await setAccountCash(userId, accountId, cash);
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function addPositionAction(formData: FormData) {
  try {
    const userId = await requireUser();
    const accountId = String(formData.get("accountId") ?? "");
    const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
    const quantity = Number(formData.get("quantity") ?? 0);
    if (!accountId) return { error: "Account is required" };
    if (!symbol) return { error: "Symbol is required" };
    if (Number.isNaN(quantity) || quantity <= 0) return { error: "Quantity must be > 0" };
    await addPosition(userId, accountId, symbol, quantity);
    await logActivity(userId, "position_added", `Added ${symbol} (${quantity} shares)`, {
      symbol,
      quantity,
    });
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function removePositionAction(positionId: string) {
  try {
    const userId = await requireUser();
    await removePosition(userId, positionId);
    await logActivity(userId, "position_removed", "Removed a holding", { positionId });
    refresh();
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
