---
description: Close the current work session — interview the user, write a structured session doc to docs/sessions/, commit it, and send you off with style.
---

You are closing this work session for the PandS inventory app. Work through these steps in order.

---

## Step 1 — Interview

Ask the user the following questions **one block at a time** (don't dump them all at once). Wait for answers before proceeding to the next block.

**Block A — What happened:**

- What did we actually ship or finish this session?
- Any decisions made that future-you should know about? (architecture, UX choices, tradeoffs)

**Block B — The messy stuff:**

- Any bugs discovered (fixed or unfixed)?
- Anything left half-done or in a weird state?
- Open questions or things you're unsure about?

**Block C — Next session setup:**

- What's the #1 thing to pick up next time?
- Any context that will be hard to reconstruct cold? (e.g., "the weird MySQL edge case is in receiving.js:87")

**Offer suggestions** based on what you observed during the session — things the user might not think to mention: uncommitted changes, TODO comments spotted in files, services or routes that seemed fragile, anything in git status that looks unresolved.

---

## Step 2 — Determine the filename

Today's date formatted as `ddmmyyyy` (e.g., April 7 2026 → `07042026`).

Check `docs/sessions/` for existing files matching `ddmmyyyy-*.md` for today. The next file gets the next integer suffix starting at 1. If none exist today, use `1`.

Filename: `docs/sessions/ddmmyyyy-N.md`

---

## Step 3 — Write the session file

Use this template:

```markdown
# Session — [Day Month Year, Session N]

**Duration:** [ask or estimate]
**Branch:** [run git branch --show-current]

## Shipped / Completed

- ...

## Decisions Made

- ...

## Bugs & Issues

- **Fixed:** ...
- **Open:** ...

## Left Half-Done / Weird State

- ...

## Open Questions

- ...

## Next Session — Start Here

1. [top priority]
2. ...

## Context Anchors

> Things that are hard to reconstruct cold — specific files, line numbers, gotchas.

- ...

## Notes

[anything else that came up]
```

Fill every section. Write `— none —` rather than leaving a section blank. Use `fmtDate`-style human dates (Apr 7, 2026), not ISO.

---

## Step 4 — Git activities

1. Run `git status` and report any uncommitted changes to the user.
2. Stage and commit the session file:
    ```
    git add docs/sessions/<filename>
    git commit -m "chore: session notes <ddmmyyyy>-<N>"
    ```
3. If there are other staged/unstaged changes the user wants to commit before closing, offer to help write a commit message for them.
4. Report the final `git log --oneline -5` so the user can see where things stand.

---

## Step 5 — Send-off

End with a short, genuinely useful "next session warmup" — two or three sentences the user can read cold to re-orient fast. Then add one fun or encouraging closing line. Vary it — don't always use the same line.
