import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyAnalysisControls,
  bankControlKey,
  controlDefinitions,
  factorTitleControlKey,
  filterOfferProducts,
  productControlKey,
  recommendationControlKey,
} from "../lib/admin-controls.ts";

test("exposes granular controls for every requested output family", () => {
  const categories = new Set(controlDefinitions.map((item) => item.category));
  assert.deepEqual(categories, new Set(["stop_factor", "policy_rule", "recommendation", "bank", "product", "metric"]));
  assert.ok(controlDefinitions.filter((item) => item.category === "policy_rule").length >= 100);
  assert.ok(controlDefinitions.filter((item) => item.category === "bank").length >= 20);
  assert.ok(controlDefinitions.filter((item) => item.category === "metric").length >= 20);
});

test("disabled factors, recommendations, banks and products are removed from customer output", () => {
  const disabled = new Set([
    factorTitleControlKey("Высокая долговая нагрузка"),
    recommendationControlKey("Долговая нагрузка"),
    bankControlKey("Тест Банк"),
    productControlKey("Овердрафт"),
  ]);
  const state = { disabled, enabled: {} };
  const analysis = {
    factors: [{ title: "Высокая долговая нагрузка", severity: "critical", detail: "x" }, { title: "Короткая история", severity: "warning", detail: "y" }],
    topRisks: [],
    recommendations: [{ product: "Рефинансирование", title: "Снизить платёж", rationale: "x", action: "y", priority: "high" }, { product: "Факторинг", title: "Дебиторка", rationale: "x", action: "y", priority: "medium" }],
    productFits: [{ product: "Овердрафт", status: "recommended" }, { product: "Факторинг", status: "recommended" }],
  };
  const filtered = applyAnalysisControls(analysis, state);
  assert.deepEqual(filtered.factors.map((item) => item.title), ["Короткая история"]);
  assert.deepEqual(filtered.recommendations.map((item) => item.product), ["Концентрация покупателей"]);
  assert.deepEqual(filtered.productFits.map((item) => item.product), ["Факторинг"]);
  assert.equal(filterOfferProducts({ bank: "Тест Банк", products: ["КИК"], recommendedProduct: "КИК" }, state), null);
  assert.deepEqual(filterOfferProducts({ bank: "Другой Банк", products: ["Овердрафт", "КИК"], recommendedProduct: "Овердрафт" }, state), { bank: "Другой Банк", products: ["КИК"], recommendedProduct: "КИК" });
});

test("every header-authenticated page is forced dynamic", async () => {
  for (const file of ["app/login/page.tsx", "app/dashboard/layout.tsx", "app/agent/layout.tsx", "app/admin/page.tsx", "app/prescore-control/page.tsx", "app/report/[id]/page.tsx"]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /export const dynamic = ["']force-dynamic["']/);
  }
});

test("login hub exposes client and agent but keeps internal administration private", async () => {
  const login = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  const landing = await readFile(new URL("../app/components/landing-v3/landing.tsx", import.meta.url), "utf8");
  assert.match(login, /href="\/dashboard"/);
  assert.match(login, /href="\/agent"/);
  assert.doesNotMatch(login, /href="\/(?:admin|prescore-control)"/);
  assert.doesNotMatch(login, /ЛК администратора/);
  assert.match(landing, /href=\{configuredAppLink\('\/agent'\)\}/);
  assert.doesNotMatch(landing, /href="\/(?:admin|prescore-control)"/);
});
