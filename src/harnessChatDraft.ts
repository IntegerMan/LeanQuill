export function buildHarnessDraftQuery(options: {
  isCursorOrCopilot: boolean;
  kind: "research" | "import";
}): string {
  const { isCursorOrCopilot, kind } = options;
  if (isCursorOrCopilot) {
    return kind === "research" ? "@leanquill-researcher " : "@leanquill-import-research ";
  }
  return kind === "research" ? "Research: " : "Import research: ";
}

export function buildHarnessFallbackHint(kind: "research" | "import"): string {
  if (kind === "research") {
    return (
      "Open your AI chat and invoke LeanQuill-Researcher with your question. " +
      "For Claude, use: /agent:leanquill-researcher <your question>"
    );
  }
  return (
    "Open your AI chat and invoke LeanQuill-Import-Research with your source material. " +
    "For Claude, use: /agent:leanquill-import-research <your import context>"
  );
}
