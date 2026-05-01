"use client";

import { useClerk } from "@clerk/nextjs";

export function SignInLauncher() {
  const { openSignIn } = useClerk();
  return (
    <button
      onClick={() => openSignIn()}
      className="px-5 h-11 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
    >
      Sign in
    </button>
  );
}

export function SignUpLauncher() {
  const { openSignUp } = useClerk();
  return (
    <button
      onClick={() => openSignUp()}
      className="px-5 h-11 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
    >
      Sign up
    </button>
  );
}
