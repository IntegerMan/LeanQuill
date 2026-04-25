export function buildHarnessDraftQuery(options: {
  isCursorOrCopilot: boolean;
  kind: "research" | "import" | "storyChat";
}): string {
  const { isCursorOrCopilot, kind } = options;
  if (isCursorOrCopilot) {
    if (kind === "research") {
      return "@leanquill-researcher ";
    }
    if (kind === "import") {
      return "@leanquill-import-research ";
    }
    return "@leanquill-story-chat ";
  }
  if (kind === "research") {
    return "Research: ";
  }
  if (kind === "import") {
    return "Import research: ";
  }
  return "Story chat: ";
}

export function buildHarnessFallbackHint(kind: "research" | "import" | "storyChat"): string {
  if (kind === "research") {
    return (
      "Open your AI chat and invoke LeanQuill-Researcher with your question. " +
      "For Claude, use: /agent:leanquill-researcher <your question>"
    );
  }
  if (kind === "import") {
    return (
      "Open your AI chat and invoke LeanQuill-Import-Research with your source material. " +
      "For Claude, use: /agent:leanquill-import-research <your import context>"
    );
  }
  return (
    "Open your AI chat and invoke LeanQuill-Story-Chat with your story question. " +
    "For Claude, use: /agent:leanquill-story-chat <your story question>"
  );
}

export function buildStoryChatDraftQuery(options: {
  isCursorOrCopilot: boolean;
  contextSummary: string;
  storyQuestion?: string;
}): string {
  const prefix = buildHarnessDraftQuery({ isCursorOrCopilot: options.isCursorOrCopilot, kind: "storyChat" });
  const q = options.storyQuestion ?? "";
  return [prefix, "LeanQuill story chat context:", options.contextSummary, "", `Story question: ${q}`].join("\n");
}

