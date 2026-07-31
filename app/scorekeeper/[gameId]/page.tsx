import { redirect } from "next/navigation";
import { isScorekeeperAuthed } from "@/lib/scorekeeper-auth";
import { ConsoleClient } from "./console-client";

export default async function ScorekeeperGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const authed = await isScorekeeperAuthed();
  if (!authed) redirect("/scorekeeper");

  const { gameId } = await params;
  return <ConsoleClient gameId={gameId} />;
}
