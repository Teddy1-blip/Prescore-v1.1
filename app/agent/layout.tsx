import {headers} from "next/headers";
import {requireChatGPTUser} from "../chatgpt-auth";
import {safeReturnPath} from "../../lib/auth/contracts";
import {AgentConnection} from "./connect";

export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/agent");
  if (!user.roles.includes("AGENT") && !user.roles.includes("ADMIN")) {
    const requested = safeReturnPath((await headers()).get("x-prescore-return-to") || "/agent");
    const url = new URL(requested, "https://prescore.invalid");
    const returnTo = url.pathname === "/agent" || url.pathname.startsWith("/agent/") ? requested : "/agent";
    return <AgentConnection email={user.email} returnTo={returnTo} invitation={url.pathname === "/agent" ? url.searchParams.get("invitation") || "" : ""}/>;
  }
  return children;
}
