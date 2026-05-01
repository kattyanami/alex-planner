import { eq } from "drizzle-orm";
import { db } from "./index";
import { instruments, users } from "./schema";

export async function ensureUser(clerkUserId: string, displayName?: string) {
  await db
    .insert(users)
    .values({ clerkUserId, displayName: displayName ?? null })
    .onConflictDoNothing();
}

export async function getUser(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));
  return user ?? null;
}

export async function listInstruments(limit = 25) {
  return db.select().from(instruments).limit(limit);
}
