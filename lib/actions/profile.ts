"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { logActivity, updateUserProfile } from "@/lib/db/queries";

export async function updateProfileAction(formData: FormData) {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const num = (key: string): number | null => {
      const raw = formData.get(key);
      if (raw == null || raw === "") return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    };

    const yearsUntilRetirement = num("yearsUntilRetirement");
    const targetRetirementIncome = num("targetRetirementIncome");
    const currentAge = num("currentAge");
    const annualContribution = num("annualContribution");

    if (yearsUntilRetirement != null && (yearsUntilRetirement < 0 || yearsUntilRetirement > 80))
      return { error: "Years to retirement must be 0–80" };
    if (currentAge != null && (currentAge < 18 || currentAge > 100))
      return { error: "Current age must be 18–100" };
    if (targetRetirementIncome != null && targetRetirementIncome < 0)
      return { error: "Target income must be ≥ 0" };
    if (annualContribution != null && annualContribution < 0)
      return { error: "Annual contribution must be ≥ 0" };

    await updateUserProfile(userId, {
      yearsUntilRetirement,
      targetRetirementIncome,
      currentAge,
      annualContribution,
    });
    await logActivity(userId, "profile_saved", "Updated retirement profile", {
      yearsUntilRetirement,
      targetRetirementIncome,
      currentAge,
      annualContribution,
    });
    revalidatePath("/dashboard");
    return { ok: true } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
