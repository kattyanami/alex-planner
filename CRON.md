# Cron — how to enable scheduled Researcher runs

Right now the Researcher only runs when you click **"Run now"** on
`/dashboard/research`. To put it on a schedule:

## Step 1 — Replace `vercel.json` with the cron config

Currently `vercel.json` is a stub (no crons). Copy the contents of
`vercel.cron.example.json` into `vercel.json`:

```bash
cp vercel.cron.example.json vercel.json
```

The active config will look like:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",

  "crons": [
    {
      "path": "/api/cron/research",
      "schedule": "0 2 * * *"
    }
  ]
}
```

`0 2 * * *` = every day at **02:00 UTC**. Other useful schedules:

| Cron string         | Cadence                                  |
| ------------------- | ---------------------------------------- |
| `0 * * * *`         | Every hour, on the hour                  |
| `0 0 * * *`         | Daily at midnight UTC                    |
| `0 0 * * 1`         | Weekly, Monday 00:00 UTC                 |
| `0 6,18 * * 1-5`    | Twice/day on weekdays, 06:00 + 18:00 UTC |
| `*/15 * * * *`      | Every 15 minutes (probably too noisy)    |

## Step 2 — Set `CRON_SECRET` on Vercel

Any random string works. Recommended:

```bash
openssl rand -base64 32
```

Then on Vercel:

```bash
cd ~/PROJECTS/alex-planner
vercel env add CRON_SECRET production
# paste the random value when prompted
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on every
scheduled invocation. The route checks for it:

```ts
// app/api/cron/research/route.ts
if (expected && authHeader !== `Bearer ${expected}`) {
  return new NextResponse("Unauthorized", { status: 401 });
}
```

The check **only kicks in if `CRON_SECRET` is set** — meaning the route
also stays callable without the env var (handy for manual testing during
dev).

## Step 3 — Redeploy

```bash
git add vercel.json
git commit -m "chore(cron): enable nightly researcher schedule"
git push
```

Done. Verify on Vercel dashboard → Project → Cron Jobs.

## Step 4 (optional) — Verify the cron is hitting your route

After the next scheduled time, check Vercel logs:

```bash
vercel logs alex-planner.vercel.app | grep "/api/cron/research"
```

Or open `https://alex-planner.vercel.app/dashboard/research` and look at
the doc counts / last-fetched timestamps — they should bump every night.

## Disabling / changing the schedule later

To pause: replace `vercel.json` with the stub again (`{ "$schema": "..." }`).
To change cadence: just edit the `schedule` string and push.

---

## Why is `CRON_SECRET` even needed?

Once cron is on, the route is publicly reachable on the internet at
`https://alex-planner.vercel.app/api/cron/research`. Without auth, any
random web crawler hitting that URL would burn API quota by triggering
researcher runs. The shared secret proves the request actually came from
Vercel's cron infrastructure.

For **manual testing** today (no schedule, no env var, no header):

```bash
curl https://alex-planner.vercel.app/api/cron/research
# → returns the full {ok: true, usersProcessed, totalDocs, ...}
```

This works because the auth check is skipped when `CRON_SECRET` is unset.
Once you set the secret to schedule the cron, manual curl will need the
header:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://alex-planner.vercel.app/api/cron/research
```
