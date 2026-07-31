import type { Metadata } from "next";
import { PickClient } from "./pick-client";

export const metadata: Metadata = {
  title: "Make a Pick | Outlaw Hockey League",
  description: "Captain view for making live draft picks.",
};

export default function DraftPickPage() {
  return <PickClient />;
}
