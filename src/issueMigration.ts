// STUB: Phase 08-02 implements

import type { SafeFileSystem } from "./safeFileSystem";

/**
 * One-time v3 migration: `.leanquill/open-questions/*` → `.leanquill/issues/question/*` (D-01–D-03).
 * Phase 08-01: no-op stub; real migration in 08-02.
 */
export async function migrateIssuesLayoutV3IfNeeded(
  _rootPath: string,
  _safeFs: SafeFileSystem,
): Promise<{ ran: boolean }> {
  return { ran: false };
}
