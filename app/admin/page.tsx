import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import AdminDashboard from "./admin-dashboard";
import "./admin.css";
import "../prescore-ui-v1.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/login?returnTo=/admin");
  if (!user.roles.includes("ADMIN")) redirect("/dashboard");
  return <AdminDashboard />;
}
