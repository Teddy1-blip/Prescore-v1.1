import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PortableDatabase } from "../lib/db/compatibility.ts";
import { analyzeBankStatements, analysisForStorage } from "../lib/prescore.ts";
import { statementFixture } from "./fixtures/block1-statements.mjs";
import { ensureFreeEntitlement, grantFullEntitlement, resolveAnalysisTier } from "../lib/entitlements.ts";
import { buildWorkspaceBasicV1, WORKSPACE_MODEL_VERSION } from "../lib/workspace/model.ts";
import { loadWorkspaceModel } from "../lib/workspace/service.ts";

const catalog = JSON.parse(fs.readFileSync(new URL("../lib/db/catalog.json", import.meta.url)));
const migration = fs.readFileSync(new URL("../lib/db/migrations/0001_product.sql", import.meta.url), "utf8");

function actualStatementAnalysis() {
  const text = statementFixture({
    inn: "5032333146",
    company: "ООО СИТИМЭЙТС",
    bank: "ПАО БАНК УРАЛСИБ",
    periodFrom: "01.07.2026",
    periodTo: "31.07.2026",
    transactionDate: "15.07.2026",
    amount: "100000.00",
  });
  return analysisForStorage(analyzeBankStatements([{ text, fileName: "workspace-sync.txt" }]));
}

test("Workspace BASIC is an allowlisted projection with no legacy credit conclusions", () => {
  const analysis = actualStatementAnalysis();
  const basic = buildWorkspaceBasicV1(analysis);
  assert.equal(basic.company.inn, analysis.companyInn);
  assert.equal(basic.sources.statements, 1);
  assert.equal(basic.cashFlow.totalInflow, 100000);
  assert.equal(basic.cashFlow.operatingInflow, 100000);
  const serialized = JSON.stringify(basic);
  for (const forbidden of ["estimatedLimit", '"score"', '"grade"', '"readiness"', "baseMonthlyPaymentCapacity", "stressLimit"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("real parser → saved analysis → FREE Workspace remains useful; FULL adds canonical report", async () => {
  const pg = new PGlite();
  const query = async (sql, values) => {
    const result = await pg.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows };
  };
  const db = new PortableDatabase({ query, connect: async () => ({ query, release() {} }) }, catalog);
  try {
    await pg.exec(migration);
    const analysis = actualStatementAnalysis();
    const owner = "workspace-owner@example.test";
    await db.prepare(`INSERT INTO analyses
      (id, company_name, company_inn, file_name, period_from, period_to, score, grade, readiness, payload, owner_email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(analysis.id, analysis.companyName, analysis.companyInn, analysis.fileName, analysis.periodFrom, analysis.periodTo,
        analysis.score, analysis.grade, analysis.readiness, JSON.stringify(analysis), owner, analysis.createdAt).run();
    await ensureFreeEntitlement(db, analysis.id, owner, analysis.companyInn);

    let profileReads = 0;
    const access = async id => {
      const row = await db.prepare("SELECT payload, company_inn AS companyInn, owner_email AS ownerEmail FROM analyses WHERE id = ? AND owner_email = ? LIMIT 1")
        .bind(id, owner).first();
      return row ? { row, access: "owner" } : null;
    };
    const deps = {
      readAccess: access,
      readTier: (id, a) => resolveAnalysisTier(db, {
        analysisId: id,
        userEmail: a.row.ownerEmail,
        companyInn: a.row.companyInn,
        readOnly: true,
      }),
      readProfile: async () => { profileReads++; return undefined; },
    };

    const free = await loadWorkspaceModel(analysis.id, deps);
    assert.equal(free.status, "READY");
    assert.equal(free.model.version, WORKSPACE_MODEL_VERSION);
    assert.equal(free.model.tier, "FREE");
    assert.equal(free.model.full.status, "LOCKED");
    assert.equal(free.model.basic.cashFlow.totalInflow, 100000);
    assert.equal(free.model.basic.sources.banks.includes("Уралсиб"), true);
    assert.equal(profileReads, 0);

    // A second read is the server-side equivalent of a page refresh: the same
    // persisted analysis remains usable without carrying browser state.
    const refreshed = await loadWorkspaceModel(analysis.id, deps);
    assert.deepEqual(refreshed.model.basic, free.model.basic);

    await grantFullEntitlement(db, {
      analysisId: analysis.id,
      userEmail: owner,
      companyInn: analysis.companyInn,
      grantedBy: "TEST",
    });
    const full = await loadWorkspaceModel(analysis.id, deps);
    assert.equal(full.status, "READY");
    assert.equal(full.model.tier, "FULL");
    assert.equal(full.model.full.status, "READY");
    assert.equal(full.model.full.model.company.inn, analysis.companyInn);
    assert.ok(full.model.full.model.analysisV3);
    assert.ok(full.model.full.model.expertise);
    assert.equal(profileReads, 1);
  } finally {
    await pg.close();
  }
});

test("premium calculation failure never erases BASIC workspace facts", async () => {
  const analysis = actualStatementAnalysis();
  delete analysis.metricsV2;
  const result = await loadWorkspaceModel(analysis.id, {
    readAccess: async () => ({ row: { payload: JSON.stringify(analysis), companyInn: analysis.companyInn, ownerEmail: "owner@test" }, access: "owner" }),
    readTier: async () => "FULL",
    readProfile: async () => undefined,
  });
  assert.equal(result.status, "READY");
  assert.equal(result.model.basic.company.inn, analysis.companyInn);
  assert.equal(result.model.full.status, "UNAVAILABLE");
  assert.equal(result.model.full.diagnostic.reason, "BANK_METRICS_MISSING");
});

test("Workspace model rejects unauthorized and mismatched saved identities before exposing data", async () => {
  const analysis = actualStatementAnalysis();
  assert.deepEqual(await loadWorkspaceModel(analysis.id, {
    readAccess: async () => null,
    readTier: async () => assert.fail("tier read before access"),
    readProfile: async () => assert.fail("profile read before access"),
  }), { status: "NOT_FOUND" });

  const mismatch = await loadWorkspaceModel("other-id", {
    readAccess: async () => ({ row: { payload: JSON.stringify(analysis), companyInn: analysis.companyInn, ownerEmail: "owner@test" }, access: "owner" }),
    readTier: async () => assert.fail("tier read after identity mismatch"),
    readProfile: async () => assert.fail("profile read after identity mismatch"),
  });
  assert.equal(mismatch.status, "UNAVAILABLE");
  assert.equal(mismatch.diagnostic.reason, "SAVED_IDENTITY_MISMATCH");
});

test("Workspace API is read-only, private, and uses shared ownership/assignment access", () => {
  const source = fs.readFileSync(new URL("../app/api/workspace-model/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireApiUser\(\)/);
  assert.match(source, /readableAnalysis\(db, key, user\)/);
  assert.match(source, /readOnly: true/);
  assert.match(source, /private, no-store/);
  assert.doesNotMatch(source, /INSERT |UPDATE |DELETE |CREATE |ALTER /);
});
