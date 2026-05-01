import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { SignInLauncher, SignUpLauncher } from "@/components/auth-buttons";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <main className="flex flex-col items-center gap-8 text-center max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight">Alex Planner</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Multi-agent equity portfolio analysis. Upload your holdings, get AI-driven
          insights from a coordinated fleet of specialized agents.
        </p>

        <div className="flex gap-4 mt-4 items-center">
          <Show when="signed-out">
            <SignInLauncher />
            <SignUpLauncher />
          </Show>

          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="px-5 h-11 inline-flex items-center rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
            >
              Go to dashboard
            </Link>
            <UserButton />
          </Show>
        </div>
      </main>
    </div>
  );
}
