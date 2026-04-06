---
phase: 03-outline-and-beat-planning
plan: 02
subsystem: ui
tags: [tree-view, drag-and-drop, outline, sidebar, reorder]

requires:
  - phase: 03-outline-and-beat-planning/plan-01
    provides: OutlineIndex types, readOutlineIndex, writeOutlineIndex

provides:
  - OutlineTreeProvider for sidebar outline navigation
  - OutlineDragDropController for reorder/promote/demote
  - buildOutlineTree and reorderOutline pure functions

affects: [03-04 integration wiring]

tech-stack:
  added: []
  patterns: [VS Code TreeDataProvider + TreeDragAndDropController pattern]

key-files:
  created: [src/outlineTree.ts]
  modified: []

key-decisions:
  - "OutlineTreeNode is a discriminated union (kind: part/chapter/beat) for type-safe tree rendering"
  - "reorderOutline is a pure function for testability — all drag-drop logic isolated from VS Code APIs"
  - "Custom MIME type application/vnd.code.tree.leanquill.outlineTree for drag data"
  - "Inactive nodes use disabledForeground ThemeColor and contextValue suffix :inactive"

patterns-established:
  - "Outline tree pattern: provider holds _index, lazy-loads on first getChildren, reloadIndex re-reads and refreshes"
  - "Drag-and-drop: serialize node IDs in handleDrag, deserialize+reorder+write in handleDrop"

requirements-completed: [PLAN-01]

duration: 5min
completed: 2026-03-30
---

# Plan 03-02: Sidebar Outline Tree Summary

**Built native VS Code TreeView for outline with hierarchical rendering and drag-and-drop reorder/promote/demote**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Created OutlineTreeProvider with Parts → Chapters → Beats hierarchical rendering
- Implemented OutlineDragDropController with same-level reorder and cross-level promote/demote
- Extracted reorderOutline as a pure testable function
- Inactive nodes show greyed icons and "(inactive)" description

## Task Commits

1. **Task 1+2: Create OutlineTreeProvider with drag-and-drop** - `83d302a` (feat)

## Files Created/Modified
- `src/outlineTree.ts` - OutlineTreeProvider, OutlineDragDropController, buildOutlineTree, reorderOutline

## Decisions Made
- Discriminated union OutlineTreeNode for type-safe kind dispatch
- Pure reorderOutline function isolates all mutation logic from VS Code APIs
- Custom MIME type for drag data prevents accidental cross-tree drops

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- OutlineTreeProvider ready for registration in extension.ts (Plan 04)
- getDragDropController() method available for createTreeView() options
- reorderOutline can be unit-tested independently when needed

---
*Phase: 03-outline-and-beat-planning*
*Completed: 2026-03-30*
