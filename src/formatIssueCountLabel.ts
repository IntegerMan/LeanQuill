/**
 * Sidebar / outline copy for active issue counts (D-09).
 * Singular when count === 1; otherwise plural ("0 Issues", "2 Issues").
 */
export function formatIssueCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(Number(count)));
  if (!Number.isFinite(n)) {
    return "0 Issues";
  }
  if (n === 1) {
    return "1 Issue";
  }
  return `${n} Issues`;
}
