"use client";

import { useRouter } from "next/navigation";

export function ScorekeeperSignOut() {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/scorekeeper/logout", { method: "POST" });
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={signOut}
      className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
    >
      Sign out
    </button>
  );
}
