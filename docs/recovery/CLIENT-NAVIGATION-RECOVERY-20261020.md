# Client navigation recovery — first isolated patch

Date: 2026-10-20. Base recovery commit: cc5842a989ce3f3ed1036d53791922ce0fa6af32. Base staging commit: 7aa6b167b696e8cc4073f623036081c8602fc7a1. Shared base tree: b77b6b9328be07143a0c60624b82fbf9e20e3eaa.

## Scope

- Unselected sections now show their own title and explicit analysis selection rather than repeating the home onboarding screen.
- Documents, BKI upload in Obligations, Applications and Billing no longer require the analytical model to finish loading successfully. Existing server authorization, module controls and read-only restrictions remain.
- Model-dependent analytical components still require a model; no values are synthesized and no FULL entitlement is granted.
- A pending model read no longer removes the new-analysis entry point.
- Upload/saving/enrichment callbacks are byte-for-byte unchanged.

## Evidence actually executed

Command from repository root: `node --test tests/client-navigation-recovery.test.mjs`.

Local environment: Node 22.16.0, TypeScript 5.8.3 (globally installed, exposed with NODE_PATH). The repository specifies TypeScript 5.9.3; that exact dependency set was not installed in this environment.

The test executes the real ClientWorkspace JSX branches after TypeScript transpilation, with explicitly stubbed React hooks and child components. It does not use real React scheduling, the DOM, Next.js, PostgreSQL or an authenticated live browser.

- Original client.tsx, Git blob e75646cfd17afa651a56c7eb20b2162074920df7: 27 tests, 10 passed, 17 failed.
- Patched client.tsx, Git blob afe927d453bcc4aab44af5dbcf5970150bac784c: 27 tests, 27 passed, 0 failed.
- Test blob: eda411ff984333e51f0fa57a49a39b7eca88b760.
- JSX transpilation reported no syntax errors. This is not a project-wide TypeScript check.

## Not completed by this patch

No staging/production deployment, database mutation, QA archive execution, Checko/runtime-policy change, billing contract repair, live source upload or 19-block acceptance. Existing historical analysis cards are not removed or archived by this patch. The complete Next.js build, real browser regression and live upload-to-result acceptance remain required before promoting the patch to staging.

No automatic selection of a historical company was introduced. No scoring, parser, entitlement or API implementation is changed.
