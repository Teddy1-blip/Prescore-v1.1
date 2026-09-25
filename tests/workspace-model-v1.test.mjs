import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { PortableDatabase } from "../lib/db/compatibility.ts";
import * as prescore from "../lib/prescore.ts";
import * as sources from "../lib/credit-engine/source-foundation.ts";
import * as controls from "../lib/admin-controls.ts";
import * as entitlements from "../lib/entitlements.ts";
import * as workspaceService from "../lib/workspace/service.ts";
import { buildCanonicalCreditAnalysis } from "../lib/credit-engine/production/orchestrator.ts";
import { statementFixture } from "./fixtures/block1-statements.mjs";

function load(file, imports) {
  const exports = {};
  const source = fs.readFileSync(file, "utf8");
  new Function("exports", "require", ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, (name) => {
    if (name in imports) return imports[name];
    throw new Error("UNEXPECTED_IMPORT:" + name);
  });
  return exports;
}

function forbiddenKeys(value, forbidden, path = "basic") {
  if (!value || typeof value !== "object") return [];
  const leaks = [];
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) leaks.push(path + "." + key);
    leaks.push(...forbiddenKeys(child, forbidden, path + "." + key));
  }
  return leaks;
}

test("real 1C upload → persisted analysis → Workspace BASIC/FULL and assigned broker read-only", async () => {
  const pg = new PGlite();
  const catalog = JSON.parse(fs.readFileSync("lib/db/catalog.json", "utf8"));
  const query = async (sql, values) => {
    const result = await pg.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows };
  };
  const db = new PortableDatabase({ query, connect: async () => ({ query, release() {} }) }, catalog);
  let current = { email: "workspace-owner@test.invalid", isAdmin: false };
  const apiAuth = load("app/api/api-auth.ts", { "../chatgpt-auth": { getChatGPTUser: async () => null } });
  const analysisRoute = load("app/api/analysis/route.ts", {
    "../../../lib/platform/runtime": { getRuntime: () => ({ DB: db }) },
    "../../../lib/prescore": prescore,
    "../../../lib/credit-engine/source-foundation": sources,
    "../../../lib/admin-controls": controls,
    "../api-auth": { requireApiUser: async () => current, unauthorized: apiAuth.unauthorized },
    "../../../lib/entitlements": entitlements,
  });
  const workspaceRoute = load("app/api/workspace-model/route.ts", {
    "../../../lib/platform/runtime": { getRuntime: () => ({ DB: db }) },
    "../../../lib/entitlements": entitlements,
    "../../../lib/workspace/service.ts": workspaceService,
    "../api-auth": { requireApiUser: async () => current, readableAnalysis: apiAuth.readableAnalysis },
  });

  try {
    for (const migration of ["0001_product.sql", "0003_runtime_indexes.sql"]) {
      await pg.exec(fs.readFileSync("lib/db/migrations/" + migration, "utf8"));
    }

    const statement = statementFixture({ openingBalance: null, endingBalance: null });
    const uploaded = await analysisRoute.POST(new Request("https://prescore.test/api/analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ statements: [{ fileName: "bank-statement.txt", text: statement }] }),
    }));
    assert.equal(uploaded.status, 200);
    const uploadedBody = await uploaded.json();
    const analysisId = uploadedBody.analysis.id;
    assert.ok(analysisId);

    const savedAccess = await apiAuth.readableAnalysis(db, analysisId, current);
    assert.equal(savedAccess.access, "owner");
    const saved = JSON.parse(savedAccess.row.payload);
    assert.equal(saved.companyInn, "5032333146");
    assert.ok(saved.metricsV2);
    assert.equal(saved.transactionsTruncated, false);

    await db.prepare("INSERT INTO client_documents (id, company_inn, analysis_id, category, file_name, content_base64, owner_email) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind("doc-1", saved.companyInn, analysisId, "Банковская выписка", "bank-statement.txt", "", current.email).run();
    await db.prepare("INSERT INTO deals (id, analysis_id, company_name, product, status, owner_email) " +
      "VALUES (?, ?, ?, ?, ?, ?)")
      .bind("deal-1", analysisId, saved.companyName, "Оборотный кредит", "Ожидает ответа", current.email).run();

    const getModel = () => workspaceRoute.GET(new Request("https://prescore.test/api/workspace-model?analysisId=" + encodeURIComponent(analysisId)));
    const beforeRead = await apiAuth.readableAnalysis(db, analysisId, current);
    const basicResponse = await getModel();
    assert.equal(basicResponse.status, 200);
    assert.match(basicResponse.headers.get("cache-control") ?? "", /private, no-store/);
    const basic = await basicResponse.json();
    assert.equal(basic.version, "PRESCORE-WORKSPACE-MODEL-1.0.0");
    assert.equal(basic.state, "READY_BASIC");
    assert.equal(basic.fullAvailability, "LOCKED");
    assert.equal(basic.basic.analysis.company.name, "ООО СИТИМЭЙТС");
    assert.equal(basic.basic.analysis.company.inn, "5032333146");
    assert.deepEqual(basic.basic.analysis.period, { from: "2026-07-01", to: "2026-07-31" });
    assert.equal(basic.basic.sources.statements.count, 1);
    assert.deepEqual(basic.basic.sources.statements.bankNames, ["Уралсиб"]);
    assert.equal(basic.basic.sources.statements.accountCount, 1);
    assert.equal(basic.basic.bankingFacts.operatingInflow.status, "KNOWN");
    assert.ok(basic.basic.bankingFacts.operatingInflow.value > 0);
    assert.equal(basic.basic.bankingFacts.endingBalance.status, "UNKNOWN");
    assert.equal(basic.basic.bankingFacts.endingBalance.value, null);
    assert.equal(basic.basic.operations.documents.status, "AVAILABLE");
    assert.equal(basic.basic.operations.documents.analysisCount, 1);
    assert.deepEqual(basic.basic.operations.applications.statuses, [{ status: "Ожидает ответа", count: 1 }]);
    assert.equal(basic.basic.operations.applications.count, 1);
    assert.deepEqual(forbiddenKeys(basic.basic, new Set([
      "score", "grade", "readiness", "estimatedLimit", "estimatedLimitMin", "estimatedLimitMax",
      "prescoreIndex", "debtCapacity", "expertise", "recommendations", "actionPlan",
    ])), []);
    assert.equal("full" in basic, false);
    assert.equal("payload" in basic, false);
    assert.equal(JSON.stringify(basic.basic).includes(statement), false);

    const repeated = await (await getModel()).json();
    assert.deepEqual(repeated.basic, basic.basic);
    assert.deepEqual(await apiAuth.readableAnalysis(db, analysisId, current), beforeRead);
    assert.equal((await db.prepare("SELECT tier FROM analysis_entitlements WHERE analysis_id = ?").bind(analysisId).first()).tier, "FREE");

    await entitlements.grantFullEntitlement(db, {
      analysisId, userEmail: current.email, companyInn: saved.companyInn, grantedBy: "SYNTHETIC_TEST",
    });
    const fullResponse = await getModel();
    assert.equal(fullResponse.status, 200);
    const full = await fullResponse.json();
    assert.equal(full.state, "READY_FULL");
    assert.equal(full.fullAvailability, "READY");
    assert.equal(full.entitlement, "FULL");
    assert.equal(full.full.report.meta.entitlement, "FULL");
    assert.ok(full.full.report.analysisV3);
    assert.ok(full.full.report.expertise);
    assert.ok(full.full.canonical.prescoreIndex);
    assert.ok(full.full.canonical.financingReadiness);
    assert.ok(full.full.canonical.creditAssessment);
    assert.ok(full.full.canonical.debtCapacity);
    assert.ok(full.full.canonical.productSelection);
    assert.ok(full.full.canonical.recommendations);
    assert.ok(full.full.canonical.actionPlan);
    assert.ok(full.full.canonical.explainability);
    assert.deepEqual(full.full.canonical.prescoreIndex, buildCanonicalCreditAnalysis({ analysis: saved }).prescoreIndex);

    await db.prepare("INSERT INTO agent_accounts (user_email, agent_code, name) VALUES (?, ?, ?)")
      .bind("workspace-broker@test.invalid", "ws-agent", "Синтетический брокер").run();
    await db.prepare("INSERT INTO agent_leads (id, agent_code, company_name, company_inn, email, consent_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)")
      .bind("lead-1", "ws-agent", saved.companyName, saved.companyInn, current.email, "2026-07-31").run();
    current = { email: "workspace-broker@test.invalid", isAdmin: false };
    const brokerBefore = await apiAuth.readableAnalysis(db, analysisId, current);
    assert.equal(brokerBefore.access, "agent");
    const brokerResponse = await getModel();
    assert.equal(brokerResponse.status, 200);
    const broker = await brokerResponse.json();
    assert.equal(broker.access.role, "ASSIGNED_BROKER");
    assert.equal(broker.access.readOnly, true);
    assert.equal(broker.state, "READY_FULL");
    assert.deepEqual(broker.full.report, full.full.report);
    assert.deepEqual(await apiAuth.readableAnalysis(db, analysisId, current), brokerBefore);

    current = { email: "unrelated-broker@test.invalid", isAdmin: false };
    const deniedBroker = await getModel();
    assert.equal(deniedBroker.status, 404);
    assert.deepEqual(await deniedBroker.json(), { version: "PRESCORE-WORKSPACE-MODEL-1.0.0", state: "NOT_FOUND", analysisId });
    current = { email: "unrelated-client@test.invalid", isAdmin: false };
    assert.equal((await getModel()).status, 404);
    current = null;
    assert.equal((await getModel()).status, 401);
  } finally {
    await pg.close();
  }
});

test("FULL canonical failure preserves the usable BASIC projection", async () => {
  const result = prescore.analyzeBankStatements([{ text: statementFixture(), fileName: "valid.txt" }]);
  const saved = { ...prescore.analysisForStorage(result), metricsV2: undefined };
  const access = { row: { payload: JSON.stringify(saved), companyInn: saved.companyInn, ownerEmail: "owner@test.invalid" }, access: "owner" };
  const workspace = await workspaceService.loadWorkspaceModelV1(saved.id, {
    readAccess: async () => access,
    readTier: async () => "FULL",
    readProfile: async () => undefined,
    readOperations: async () => ({
      documents: { status: "UNKNOWN", count: null, analysisCount: null },
      applications: { status: "UNKNOWN", count: null, activeCount: null, statuses: null },
    }),
  });
  assert.equal(workspace.state, "READY_BASIC");
  assert.equal(workspace.fullAvailability, "UNAVAILABLE");
  assert.equal(workspace.basic.analysis.company.inn, saved.companyInn);
  assert.equal(workspace.basic.bankingFacts.operatingInflow.status, "UNKNOWN");
  assert.equal("full" in workspace, false);
});
