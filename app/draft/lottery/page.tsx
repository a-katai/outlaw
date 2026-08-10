import type { Metadata } from "next";
import { LotteryClient } from "./lottery-client";

export const metadata: Metadata = {
  title: "Lottery | Outlaw Hockey League",
  description: "Draft order lottery reveal for the TV.",
};

export default function DraftLotteryPage() {
  return <LotteryClient />;
}
