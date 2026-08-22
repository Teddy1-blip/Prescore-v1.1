import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import AdminDashboard from "./admin-dashboard";
import "./admin.css";
import "../prescore-ui-v1.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/login?returnTo=/admin");
  if (user.email.toLowerCase() !== "dorogovab@gmail.com") redirect("/dashboard");
  return <AdminDashboard />;
}
