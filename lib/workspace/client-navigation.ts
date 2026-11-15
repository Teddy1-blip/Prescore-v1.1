/**
 * Navigation for the ONE existing client /dashboard.
 * Dossier identity is not a saved bank-analysis identity.
 * A company without a statement must never navigate as analysisId=<dossier>.
 */
export function clientNavigationHref(
  search: string,
  view: string,
  analysisId = '',
  dossierId = '',
): string {
  const query = new URLSearchParams(search);
  if (dossierId) {
    query.set('dossierId', dossierId);
    query.delete('analysisId');
    // Cash filter state only belongs to a selected bank analysis.
    for (const key of ['bankMonth', 'cashFor', 'cashMonth', 'cashSeries', 'cashMode']) query.delete(key);
  } else if (analysisId) {
    query.set('analysisId', analysisId);
    query.delete('dossierId');
  } else {
    query.delete('analysisId');
    query.delete('dossierId');
  }
  query.set('view', view);
  return '?' + query.toString();
}
