import {getRuntime} from "../../../lib/platform/runtime";
import { requireApiUser, unauthorized } from "../api-auth";
import { readControlSettings } from "../../../lib/admin-controls";

type PreparedStatement = { bind: (...values: unknown[]) => PreparedStatement; run: () => Promise<unknown> };
type RuntimeDatabase = { prepare: (query: string) => PreparedStatement; batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>> };

const defaults = ["overview", "analysis", "report", "credit", "company", "offers", "analyst", "applications", "documents", "chats", "exports", "methodology", "agent", "prospects"];

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  try {
    const env = getRuntime();
    const db = env.DB as unknown as RuntimeDatabase;
    await db.prepare(`CREATE TABLE IF NOT EXISTS module_settings (module_key TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    const [result, controlSettings] = await Promise.all([
      db.batch([db.prepare("SELECT module_key AS moduleKey, enabled FROM module_settings")]),
      readControlSettings(db),
    ]);
    const modules = Object.fromEntries(defaults.map((key) => [key, true]));
    for (const item of result[0]?.results as Array<{ moduleKey: string; enabled: number }>) modules[item.moduleKey] = Boolean(item.enabled);
    const controls = Object.fromEntries(controlSettings.map((item) => [item.controlKey, Boolean(item.enabled)]));
    return Response.json({ modules, controls });
  } catch {
    return Response.json({ modules: Object.fromEntries(defaults.map((key) => [key, true])), controls: {} });
  }
}
