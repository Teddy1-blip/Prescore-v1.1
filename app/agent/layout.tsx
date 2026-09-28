import {redirect} from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user=await requireChatGPTUser("/agent");
  if(!user.roles.includes("AGENT")&&!user.roles.includes("ADMIN")) redirect("/dashboard");
  return children;
}
