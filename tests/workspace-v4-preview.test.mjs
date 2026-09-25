import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("CLIENT Workspace preview uses WorkspaceModel and never legacy credit conclusions", () => {
  const source=fs.readFileSync(new URL("../app/components/workspace-v4/client-home.tsx",import.meta.url),"utf8");
  assert.match(source,/WorkspaceModelV1/);
  assert.match(source,/PRESCORE INDEX/);
  for(const forbidden of ["analysis.score","estimatedLimit","analysis.grade","legacy readiness"]) {
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});

test("CLIENT Workspace preview is staging-only and synthetic report links stay in lab", () => {
  const page=fs.readFileSync(new URL("../app/dashboard/workspace-v4/page.tsx",import.meta.url),"utf8");
  const component=fs.readFileSync(new URL("../app/components/workspace-v4/client-home.tsx",import.meta.url),"utf8");
  assert.match(page,/prescore-staging-dorogovab\.amvera\.io/);
  assert.match(page,/loadBusiness\(caseId\)/);
  assert.match(component,/report-v2\?lab=/);
  assert.doesNotMatch(component,/report-v2\?analysisId=/);
});
