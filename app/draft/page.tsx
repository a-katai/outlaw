import type { Metadata } from "next";
import { DraftBoardClient } from "./draft-board-client";

export const metadata: Metadata = {
  title: "Draft | Outlaw Hockey League",
  description: "Live draft board for the Outlaw Hockey League.",
};

export default function DraftPage() {
  return <DraftBoardClient />;
}
