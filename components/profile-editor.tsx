"use client";

import { useState, useTransition } from "react";
import { Save, Target } from "lucide-react";
import { updateProfileAction } from "@/lib/actions/profile";
import type { UserProfileFull } from "@/lib/db/queries";
import { Button, Card, CardBody, CardHeader, Field, Input } from "@/components/ui/primitives";

export function ProfileEditor({ profile }: { profile: UserProfileFull | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const r = await updateProfileAction(formData);
      if ("error" in r && r.error) setMsg({ kind: "err", text: r.error });
      else setMsg({ kind: "ok", text: "Saved" });
    });
  }

  return (
    <Card>
      <CardHeader
        icon={<Target className="size-4" />}
        title="Retirement profile"
        description="These feed Monte Carlo + Reporter. Empty values fall back to assumption defaults."
      />
      <CardBody>
        <form action={onSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Current age">
            <Input
              name="currentAge"
              type="number"
              defaultValue={profile?.current_age ?? ""}
              placeholder="40"
            />
          </Field>
          <Field label="Years to retirement">
            <Input
              name="yearsUntilRetirement"
              type="number"
              defaultValue={profile?.years_until_retirement ?? ""}
              placeholder="25"
            />
          </Field>
          <Field label="Target income / yr">
            <Input
              name="targetRetirementIncome"
              type="number"
              step="1000"
              defaultValue={profile?.target_retirement_income ?? ""}
              placeholder="80000"
              prefix="$"
            />
          </Field>
          <Field label="Annual contribution">
            <Input
              name="annualContribution"
              type="number"
              step="500"
              defaultValue={profile?.annual_contribution ?? ""}
              placeholder="10000"
              prefix="$"
            />
          </Field>

          <div className="col-span-2 md:col-span-4 flex items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              <Save className="size-4" />
              {pending ? "Saving…" : "Save profile"}
            </Button>
            {msg && (
              <span
                className={`text-xs font-medium ${
                  msg.kind === "ok"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {msg.kind === "ok" ? "✓" : "✗"} {msg.text}
              </span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
