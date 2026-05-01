"use client";

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/lib/actions/profile";
import type { UserProfileFull } from "@/lib/db/queries";

export function ProfileEditor({ profile }: { profile: UserProfileFull | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const r = await updateProfileAction(formData);
      if ("error" in r) setMsg(`✗ ${r.error}`);
      else setMsg("✓ Saved");
    });
  }

  return (
    <section className="mt-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-1">Your retirement profile</h2>
      <p className="text-sm text-zinc-500 mb-4">
        These feed the Monte Carlo + Reporter agents. Empty values fall back to defaults from{" "}
        <code className="text-xs">lib/finance/assumptions.ts</code>.
      </p>

      <form action={onSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field
          label="Current age"
          name="currentAge"
          type="number"
          defaultValue={profile?.current_age ?? ""}
          placeholder="40"
        />
        <Field
          label="Years to retirement"
          name="yearsUntilRetirement"
          type="number"
          defaultValue={profile?.years_until_retirement ?? ""}
          placeholder="25"
        />
        <Field
          label="Target income / yr"
          name="targetRetirementIncome"
          type="number"
          step="1000"
          defaultValue={profile?.target_retirement_income ?? ""}
          placeholder="80000"
          prefix="$"
        />
        <Field
          label="Annual contribution"
          name="annualContribution"
          type="number"
          step="500"
          defaultValue={profile?.annual_contribution ?? ""}
          placeholder="10000"
          prefix="$"
        />

        <div className="col-span-2 md:col-span-4 flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={pending}
            className="h-9 px-4 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50 text-sm"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
          {msg && (
            <span
              className={`text-xs ${msg.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {msg}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  prefix,
  ...props
}: {
  label: string;
  prefix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute inset-y-0 left-2 flex items-center text-xs text-zinc-500">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`h-9 w-full px-3 ${prefix ? "pl-5" : ""} rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500`}
        />
      </div>
    </label>
  );
}
