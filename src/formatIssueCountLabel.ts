/**
 * Sidebar / outline copy for active issue counts (D-09).
 * Singular when count === 1; otherwise lowercase plural ("0 issues", "2 issues").
 */
export function formatIssueCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(Number(count)));
  if (!Number.isFinite(n)) {
    return "0 issues";
  }
  if (n === 1) {
    return "1 Issue";
  }
  return `${n} issues`;
}
