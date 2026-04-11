/** Triage filter predicates (D-05 / D-06). */

export type IssueStatus = "open" | "deferred" | "dismissed" | "resolved";

export type IssueListFilter = "active" | "open" | "deferred" | "dismissed" | "all";

/** D-06: default list = open + deferred; dismissed hidden until explicit filter. */
export function matchesIssueFilter(status: IssueStatus, filter: IssueListFilter): boolean {
  switch (filter) {
    case "active":
      return status === "open" || status === "deferred";
    case "open":
      return status === "open";
    case "deferred":
      return status === "deferred";
    case "dismissed":
      return status === "dismissed";
    case "all":
      return true;
  }
}

/** Sidebar / issue-index counts: open + deferred only (D-06). */
export function isActiveForSidebarCount(status: IssueStatus): boolean {
  return status === "open" || status === "deferred";
}
