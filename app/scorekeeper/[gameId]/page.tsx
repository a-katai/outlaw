import { redirect } from "next/navigation";
import { isScorekeeperAuthed } from "@/lib/scorekeeper-auth";
import { ConsoleClient } from "./console-client";

export default async function ScorekeeperGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { gameId } = await params;
  const { code } = await searchParams;
  const authed = await isScorekeeperAuthed();
  if (!authed && code) {
    redirect(`/api/scorekeeper/login?code=${encodeURIComponent(code)}&next=${encodeURIComponent(`/scorekeeper/${gameId}`)}`);
  }
  if (!authed) redirect("/scorekeeper");

  return <ConsoleClient gameId={gameId} />;
}
