/**
 * Monotonic id for the set of files under `.leanquill/workflows/*.md` shipped by the
 * extension. **Increment** when any workflow body in `leanquillWorkflows.ts` changes so
 * existing workspaces can auto-receive the update.
 * Authors who fork a workflow can set `leanquill_workflow_pinned: true` in that file’s
 * frontmatter to opt out, or set `leanquill_workflow_bundle` higher than the extension’s
 * value to “win” over downgrades.
 */
export const LEANQUILL_WORKFLOW_BUNDLE_VERSION = 1;

const FRONTMATTER = /^\s*---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Returns the `leanquill_workflow_bundle` integer from the first YAML front matter block, or
 * 0 if missing (treated as older than any shipped bundle).
 */
export function readWorkflowBundleFromContent(fileContent: string): number {
  const m = fileContent.match(FRONTMATTER);
  if (!m) {
    return 0;
  }
  const line = m[1].match(/^\s*leanquill_workflow_bundle:\s*(\d+)\s*$/m);
  if (!line) {
    return 0;
  }
  const n = parseInt(line[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * When true, `ensureLeanquillWorkflows` will not replace this file.
 */
export function isLeanquillWorkflowPinned(fileContent: string): boolean {
  const m = fileContent.match(FRONTMATTER);
  if (!m) {
    return false;
  }
  return /^\s*leanquill_workflow_pinned:\s*(true|yes|1)\s*$/im.test(m[1]);
}
