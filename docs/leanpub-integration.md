# LeanPub integration

LeanQuill is designed to work natively with the [LeanPub](https://leanpub.com/) publishing workflow.

## Expected repository layout

```
your-book/
├── manuscript/
│   ├── Book.txt          # Chapter compile order (LeanPub reads this)
│   ├── ch1.md
│   ├── ch2.md
│   └── ...
├── notes/                # Optional — story intelligence
│   ├── characters/
│   └── threads/
├── research/
│   └── leanquill/        # AI-assisted research output
└── .leanquill/           # LeanQuill project state (git-tracked)
```

## Book.txt synchronization

`Book.txt` is the file LeanPub uses to determine which chapters to include and in what order. LeanQuill keeps it in sync with your outline:

- **Outline → Book.txt**: When you reorder nodes in the outline, LeanQuill regenerates `Book.txt` from the active nodes in depth-first order. Only nodes marked as **active** are included.
- **External edits detected**: If you edit `Book.txt` manually (or it changes via git), LeanQuill detects the change and offers to reconcile with the outline order.
- **Multi-part books**: When your outline has multiple top-level nodes with the `part` trait, `Book.txt` emits `part: Title` directives that LeanPub recognizes for part separators.

## Chapter order resolution

LeanQuill resolves chapter order using this priority:

1. **`Book.txt`** — If present, parsed for ordered chapter paths (comments and `part:` directives are skipped)
2. **Alphabetical fallback** — If no `Book.txt` exists, `manuscript/*.md` files are sorted alphabetically

The resolved order is cached in `.leanquill/chapter-order.json` for fast access.

## Publishing

LeanQuill does not manage the publishing step — LeanPub handles compilation when you push to your git remote. LeanQuill focuses on the authoring and organization workflow that happens before that push.

---

[← Back to README](../README.md)
