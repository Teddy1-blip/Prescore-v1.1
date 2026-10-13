# Source acceptance (M1, in progress)

All data synthetic. No provider/deployment calls. Normalized sources persist in `analyses.payload`; WorkspaceModelV1 is recalculated from persisted inputs. Generic document storage is distinct.

| Source | Format/entry | Upload | Persistence/model | CLIENT/BROKER | Evidence / limitation |
|---|---|---|---|---|---|
| Bank | 1C TXT UTF-8/Windows-1251; lib/prescore.ts screening/analyzeBankStatements | /api/analysis | metricsV2, sourceManifest.bankStatements → basic.bankingFacts + full.canonical | New analysis → finances; shared dossier | bank-statements/source-authority/normalization/metrics fixtures. Bank XLSX is not supported by current flow; do not claim support |
| BFO upload | Text PDF, XLSX, CSV; parseAuthoritativeBfoText → adaptFinancialReport → existing financial engine | /api/source-documents BFO | financialStatementsV2, financialUploads/bfo → full.report.financialAnalysis, canonical/reconciliation | Add accounting statements; shared finances/analysis | polish-source-enrichment: actual bytes for all three. One annual period with explicit INN per file, explicit scale required for KNOWN; no OCR, no multi-column annual import |
| Quarterly | Text PDF/XLSX/CSV; parseAuthoritativeQuarterlyText | /api/source-documents QUARTERLY | quarterlyReport + normalized snapshots; matching-period replacement | Add quarterly statements; shared finances | client-source-workflow; polish incremental A/B/C/D; missing scale stays UNKNOWN |
| Credit history | Text PDF (NBKI/SB recognized layouts); parseAuthoritativeCreditHistoryText | /api/source-documents BKI | creditHistory + manifest.bki → credit portfolio/reconciliation/canonical | Add credit history; obligations/shared dossier | credit-history/source-authority tests; actual NBKI PDF in incremental tests. No OCR; noncompany reports do not become company debt |
| Open BFO/company/legal | existing Checko adapter; cached or explicit request | /api/checko | checko_profiles and canonical profile input | company information/shared analysis | Existing source fixtures; live paid requests prohibited. Upload BFO does not depend on this provider |
| Generic company/application files | existing bounded document upload | /api/documents | client_documents + persistent storage | DocumentsHub/chat | Existing RC1/product tests; not an analytical source |

M1 local: baseline targeted 141/141; bank/credit/source-authority 9/9; new actual-byte/enrichment checks in `tests/polish-source-enrichment.test.mjs`. Browser proof is separate `scripts/qa/polish-source-browser.mjs`; CI must pass and images must be reviewed before acceptance.
