# Phase 9: AI Safety Rails and Persona Baseline - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare LeanQuill for AI workflows by shipping a project-local persona library baseline and enforcing hard, auditable manuscript immutability constraints for AI execution surfaces. This phase defines persona defaults, enable/disable behavior, and safety enforcement depth, but does not add new AI product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Packaged Persona Defaults
- **D-01:** Ship three packaged defaults using the full persona schema: `casual-reader`, `avid-genre-fan`, and `copy-editor`.
- **D-02:** Generate packaged defaults as real markdown files in `.leanquill/personas/` during initialize.
- **D-03:** Persona behaviors must differ meaningfully via `context_access` and `feedback` priorities (not just display labels/tone).

### Persona Enable/Disable Configuration
- **D-04:** Canonical project config shape remains `active_personas` as `{ id, enabled }[]`.
- **D-05:** Initialize seeds all three packaged defaults as enabled entries in `active_personas`.
- **D-06:** If an enabled persona id is missing on disk, LeanQuill warns and skips that persona for the run.
- **D-07:** Disabled personas are ignored entirely at runtime.

### AI Write-Block Enforcement
- **D-08:** Enforce defense in depth: metadata-action contract validation plus `SafeFileSystem` boundary checks.
- **D-09:** AI-driven writes to `manuscript/Book.txt` are blocked; any Book.txt exception remains limited to explicit non-AI scaffold/initialize flows.
- **D-10:** Unsafe metadata actions are rejected, produce an audit record, and surface a user-visible error.
- **D-11:** Approval baseline: low-risk memory/chat-log writes under `.leanquill/**` may be automatic; entity/theme/research/issue metadata updates require explicit author approval.

### Custom Persona Guardrails
- **D-12:** Validation is hybrid: required core keys hard-fail; non-critical fields warn/default.
- **D-13:** Unknown persona frontmatter fields are preserved for forward compatibility and ignored by current runtime logic.
- **D-14:** Invalid personas are skipped while the run continues with valid personas; show a summary warning.
- **D-15:** Validation feedback surfaces in LeanQuill output channel plus concise toast notifications.

### Claude's Discretion
- Exact default values for packaged persona expertise numeric dimensions, as long as each default remains clearly distinct and schema-valid.
- Exact warning phrasing and output formatting for persona validation/reporting.
- Internal validator architecture and helper/module split, provided D-12 through D-15 behavior is preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Product Constraints
- `.planning/ROADMAP.md` - Phase 9 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - `PER-01` requirement and AI feature sequencing context.
- `.planning/PROJECT.md` - non-negotiables: manuscript immutability, local-first state, AI advisor-only posture.

### Persona and Config Contracts
- `Imported/data-contracts/persona-schema.md` - full persona schema fields and semantics for packaged/custom personas.
- `Imported/data-contracts/project-config-schema.md` - `active_personas` structure and AI policy contract shape.
- `docs/ai-integration.md` - packaged default persona intent and advisory-only AI posture.

### Existing Implementation Touchpoints
- `src/initialize.ts` - project.yaml generation, `.leanquill/personas/` directory creation, and initialization defaults.
- `src/projectConfig.ts` - project config parsing and default model.
- `src/safeFileSystem.ts` - write-boundary enforcement and path allowlist behavior.
- `src/types.ts` - shared type contracts consumed by extension/runtime modules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SafeFileSystem.allowPath()` and `canWrite()` already implement default-deny + scoped exceptions and can anchor Phase 9 defense-in-depth policy.
- `initialize.ts` already creates `.leanquill/personas/` and writes `project.yaml`, making it the natural place to seed packaged persona files and `active_personas`.
- `projectConfig.ts` already parses folders and schema versions and can be extended for robust `active_personas` parsing/validation.

### Established Patterns
- LeanQuill persists contract-driven state under `.leanquill/**` and treats manuscript writes as exceptional.
- Config/state migrations are handled with schema-version checks and non-destructive upgrades.
- User-facing operational warnings typically combine concise UI notifications with richer output channel detail.

### Integration Points
- Persona baseline and config defaults wire through `initialize.ts` and project-yaml render logic.
- Runtime persona loading/validation hooks attach where AI workflow invocation consumes persona ids.
- Metadata action and safety checks integrate with existing AI contract/action modules and `SafeFileSystem` guards.

</code_context>

<specifics>
## Specific Ideas

- Keep roadmap-aligned packaged persona ids exactly as `casual-reader`, `avid-genre-fan`, and `copy-editor`.
- Prioritize explicit, auditable rejection behavior over silent auto-rewrites for unsafe metadata actions.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 09-ai-safety-rails-and-persona-baseline*
*Context gathered: 2026-04-25*
