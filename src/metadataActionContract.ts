export type MetadataActionOperation =
  | "set"
  | "append"
  | "removeFromList"
  | "createMemory"
  | "supersedeMemory"
  | "createIssue"
  | "updateIssueStatus"
  | "updateThemeMetadata"
  | "updateResearchAssociation"
  | "updateChatLogProvenance";

export type MetadataActionRisk = "low" | "requiresApproval";

export type MetadataActionApprovalMethod = "native-tool-confirmation" | "chat-text-confirmation" | "extension-command";

export interface MetadataAction {
  schemaVersion: "1";
  actionId: string;
  sourceChatId: string;
  operation: MetadataActionOperation;
  targetPath: string;
  fieldPath: string[];
  oldValue?: unknown;
  newValue?: unknown;
  rationale: string;
  risk: MetadataActionRisk;
  authorApproval?: {
    approvedAt: string;
    method: MetadataActionApprovalMethod;
    transcriptExcerpt?: string;
  };
}

/**
 * Queued `MetadataAction` JSON for `leanquill.applyMetadataAction` when the author runs the command
 * with no selection (read from disk, then removed after a successful apply). Agents write this file
 * after a plain-language interview and confirmation — readers should not hand-edit the schema in chat.
 */
export const PENDING_METADATA_ACTION_RELPATH = ".leanquill/pending-metadata-action.json" as const;

export interface MetadataActionValidationResult {
  ok: boolean;
  action?: MetadataAction;
  errors: string[];
  blockedReasons: string[];
}

const OPS: MetadataActionOperation[] = [
  "set",
  "append",
  "removeFromList",
  "createMemory",
  "supersedeMemory",
  "createIssue",
  "updateIssueStatus",
  "updateThemeMetadata",
  "updateResearchAssociation",
  "updateChatLogProvenance",
];

const APPROVAL_METHODS: MetadataActionApprovalMethod[] = [
  "native-tool-confirmation",
  "chat-text-confirmation",
  "extension-command",
];

function normSlashes(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isTraversalOrAbsolute(targetPath: string): boolean {
  const n = normSlashes(targetPath);
  if (n.includes("..")) {
    return true;
  }
  if (n.startsWith("/")) {
    return true;
  }
  if (/^[a-zA-Z]:/.test(n)) {
    return true;
  }
  return false;
}

function isManuscriptPath(targetPath: string): boolean {
  const n = normSlashes(targetPath);
  if (n === "manuscript/Book.txt") {
    return true;
  }
  if (n.startsWith("manuscript/") || n.includes("/manuscript/")) {
    return true;
  }
  return false;
}

function lowRiskLeanQuillPath(targetPath: string): boolean {
  const n = normSlashes(targetPath);
  if (n === ".leanquill/metadata-actions.jsonl") {
    return true;
  }
  if (n.startsWith(".leanquill/memory/")) {
    return true;
  }
  if (n.startsWith(".leanquill/chats/")) {
    return true;
  }
  return false;
}

function underAllowedRoot(targetPath: string, configuredWritableRoots: string[]): boolean {
  const n = normSlashes(targetPath);
  if (n.startsWith(".leanquill/") || n === ".leanquill") {
    return true;
  }
  for (const root of configuredWritableRoots) {
    const r = normSlashes(root.endsWith("/") ? root : `${root}/`);
    if (n === r.slice(0, -1) || n.startsWith(r)) {
      return true;
    }
  }
  return false;
}

function isConfiguredStoryMetadataPath(targetPath: string, configuredWritableRoots: string[]): boolean {
  const n = normSlashes(targetPath);
  for (const root of configuredWritableRoots) {
    const r = normSlashes(root.endsWith("/") ? root : `${root}/`);
    // `.leanquill/` is an allowed write root but memory/chats/logs are not "story note" metadata;
    // do not treat every `.leanquill/**` path as configured story metadata for approval-bypass checks.
    if (r === ".leanquill/" || r === ".leanquill") {
      continue;
    }
    if (n === r.slice(0, -1) || n.startsWith(r)) {
      return true;
    }
  }
  return n === ".leanquill/themes.yaml";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
}

export function validateMetadataAction(
  raw: unknown,
  options: { configuredWritableRoots: string[] },
): MetadataActionValidationResult {
  const errors: string[] = [];
  const blockedReasons: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("Metadata action must be a JSON object.");
    return { ok: false, errors, blockedReasons };
  }

  const o = raw as Record<string, unknown>;
  const schemaVersion = o.schemaVersion;
  const actionId = asString(o.actionId);
  const sourceChatId = asString(o.sourceChatId);
  const operation = o.operation as MetadataActionOperation | undefined;
  const targetPathRaw = asString(o.targetPath);
  const fieldPath = asStringArray(o.fieldPath);
  const rationale = asString(o.rationale);
  const risk = o.risk as MetadataActionRisk | undefined;
  const authorApproval = o.authorApproval;

  if (schemaVersion !== "1") {
    errors.push('schemaVersion must be "1".');
  }
  if (!actionId?.trim()) {
    errors.push("actionId is required.");
  }
  if (!sourceChatId?.trim()) {
    errors.push("sourceChatId is required.");
  }
  if (!operation || !OPS.includes(operation)) {
    errors.push("Unknown operation.");
  }
  if (!targetPathRaw?.trim()) {
    errors.push("targetPath is required.");
  }
  if (!fieldPath) {
    errors.push("fieldPath must be an array of strings.");
  }
  if (!rationale?.trim()) {
    errors.push("rationale is required.");
  }
  if (risk !== "low" && risk !== "requiresApproval") {
    errors.push("risk must be low or requiresApproval.");
  }

  if (errors.length > 0) {
    return { ok: false, errors, blockedReasons };
  }

  const targetPath = normSlashes(targetPathRaw!);

  if (isTraversalOrAbsolute(targetPath)) {
    blockedReasons.push("path traversal");
    return {
      ok: false,
      errors: [],
      blockedReasons,
      action: undefined,
    };
  }

  if (isManuscriptPath(targetPath)) {
    blockedReasons.push("manuscript prose writes");
    return { ok: false, errors: [], blockedReasons };
  }

  const roots = options.configuredWritableRoots.map((r) => (r.endsWith("/") ? r : `${r}/`).replace(/\\/g, "/"));

  if (!underAllowedRoot(targetPath, roots)) {
    blockedReasons.push("unconfigured path roots");
    return { ok: false, errors: [], blockedReasons };
  }

  const onStoryMetadata = isConfiguredStoryMetadataPath(targetPath, roots);
  const onLowRiskLeanQuill = lowRiskLeanQuillPath(targetPath);

  if (risk === "low" && (onStoryMetadata || targetPath.startsWith("notes/"))) {
    blockedReasons.push("approval bypass");
    return {
      ok: false,
      errors: [],
      blockedReasons,
      action: {
        schemaVersion: "1",
        actionId: actionId!,
        sourceChatId: sourceChatId!,
        operation: operation!,
        targetPath,
        fieldPath: fieldPath!,
        oldValue: o.oldValue,
        newValue: o.newValue,
        rationale: rationale!,
        risk: "low",
      },
    };
  }

  if (risk === "low" && !onLowRiskLeanQuill) {
    errors.push('Only .leanquill memory/chat-log actions may be low risk without targeting other paths.');
    return { ok: false, errors, blockedReasons };
  }

  if (risk === "requiresApproval") {
    if (!authorApproval || typeof authorApproval !== "object" || Array.isArray(authorApproval)) {
      errors.push("requiresApproval risk needs authorApproval object.");
    } else {
      const aa = authorApproval as Record<string, unknown>;
      const approvedAt = asString(aa.approvedAt);
      const method = aa.method as MetadataActionApprovalMethod | undefined;
      if (!approvedAt?.trim()) {
        errors.push("authorApproval.approvedAt is required when risk is requiresApproval.");
      }
      if (!method || !APPROVAL_METHODS.includes(method)) {
        errors.push("authorApproval.method must be a supported approval method.");
      }
    }
  }

  if (risk === "requiresApproval" && errors.length === 0 && onStoryMetadata) {
    // validated above
  }

  if (errors.length > 0) {
    return { ok: false, errors, blockedReasons };
  }

  const action: MetadataAction = {
    schemaVersion: "1",
    actionId: actionId!,
    sourceChatId: sourceChatId!,
    operation: operation!,
    targetPath,
    fieldPath: fieldPath!,
    oldValue: o.oldValue,
    newValue: o.newValue,
    rationale: rationale!,
    risk: risk!,
    authorApproval:
      authorApproval && typeof authorApproval === "object" && !Array.isArray(authorApproval)
        ? {
            approvedAt: String((authorApproval as Record<string, unknown>).approvedAt ?? ""),
            method: (authorApproval as Record<string, unknown>).method as MetadataActionApprovalMethod,
            transcriptExcerpt: asString((authorApproval as Record<string, unknown>).transcriptExcerpt),
          }
        : undefined,
  };

  return { ok: true, action, errors: [], blockedReasons: [] };
}
