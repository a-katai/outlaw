"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminState, fetchAdminState } from "./admin-api";
import { AdminDraftTab } from "./admin-draft-tab";
import { AdminPaymentsTab } from "./admin-payments-tab";
import { AdminSeasonTab } from "./admin-season-tab";
import { fetchSeasonAdminState, type SeasonAdminState } from "./admin-season-api";

type Tab = "draft" | "payments" | "season";

export function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("draft");
  const [state, setState] = useState<AdminState | null>(null);
  const [seasonState, setSeasonState] = useState<SeasonAdminState | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const data = await fetchAdminState();
    setState(data);
    setLoading(false);
  }, []);

  const refetchSeason = useCallback(async () => {
    const data = await fetchSeasonAdminState();
    setSeasonState(data);
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [data, seasonData] = await Promise.all([fetchAdminState(), fetchSeasonAdminState()]);
      if (ignore) return;
      setState(data);
      setSeasonState(seasonData);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League Hub</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Admin</h1>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
        >
          Sign out
        </button>
      </div>

      <div className="flex gap-2 border-b border-black/10">
        {(
          [
            { key: "draft", label: "Draft control" },
            { key: "season", label: "Season" },
            { key: "payments", label: "Payments ledger" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              tab === t.key ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !state ? (
        <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading…</div>
      ) : tab === "draft" ? (
        <AdminDraftTab state={state} refetch={refetch} />
      ) : tab === "season" ? (
        !seasonState ? (
          <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading…</div>
        ) : (
          <AdminSeasonTab state={seasonState} refetch={refetchSeason} />
        )
      ) : (
        <AdminPaymentsTab state={state} refetch={refetch} />
      )}
    </section>
  );
}
