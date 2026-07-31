import type { Metadata } from "next";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AdminDashboard } from "./admin-dashboard";
import { AdminLogin } from "./admin-login";

export const metadata: Metadata = {
  title: "Admin | Outlaw Hockey League",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const authed = await isAdminAuthed();
  return authed ? <AdminDashboard /> : <AdminLogin />;
}
