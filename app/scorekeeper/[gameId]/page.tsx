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
  const authed = await isScorekeeperAuthed(code);
  if (!authed) redirect(code ? "/scorekeeper?error=Invalid%20code" : "/scorekeeper");

  // A valid ?code= rides along on every API call and link from here, so a
  // tablet that refuses cookies still works end to end.
  return <ConsoleClient gameId={gameId} code={code?.trim().toUpperCase() ?? null} />;
}
