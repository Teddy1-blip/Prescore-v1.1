import { getChatGPTUser } from "../../chatgpt-auth";
import { getPool } from "../../../lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });

  const pool = getPool();
  const email = user.email.trim().toLowerCase();
  const [platform, agent] = await Promise.all([
    pool.query("SELECT role FROM platform_roles WHERE user_id=$1 ORDER BY role", [user.id]),
    pool.query("SELECT agent_code AS \"agentCode\", name FROM agent_accounts WHERE lower(user_email)=$1 LIMIT 1", [email]),
  ]);

  return Response.json({
    authenticated: true,
    email,
    roles: user.roles,
    platformRoles: platform.rows.map((row) => row.role),
    agentAccount: agent.rows[0] ?? null,
    access: {
      client: true,
      broker: user.roles.includes("AGENT") || user.roles.includes("ADMIN"),
      admin: user.roles.includes("ADMIN"),
    },
  });
}
