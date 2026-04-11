---
description: Close the current work session — synthesize what happened, draft a session doc, get approval, commit it, and send off with style.
---

You are closing this work session for the PandS inventory app. Work through these steps in order.

---

## Step 1 — Gather context

Run these commands to orient yourself:

```bash
git log --oneline -10
git status
git diff --stat HEAD
```

Also review the conversation history — what was discussed, built, fixed, or decided this session.

---

## Step 2 — Draft the session document

Using everything you observed, fill out the template below **yourself**. Do not ask the user questions yet — synthesize from the session. Be specific: name files, line numbers, routes, decisions, tradeoffs. If something is genuinely unknown, mark it `— unclear —` and flag it as a question for the user.

```markdown
# Session — [Day Month Year, Session N]

**Duration:** [estimate from conversation length / git timestamps]
**Branch:** [git branch --show-current]

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

Fill every section. Write `— none —` rather than leaving blank. Use human dates (Apr 10, 2026), not ISO.

---

## Step 3 — Present for approval

Show the drafted document to the user in full. Then ask:

> "Does this look right? Anything to add, correct, or cut before I commit it?"

Wait for their response. Apply any edits they request. If they approve (or say "looks good", "ship it", etc.), proceed to Step 4.

---

## Step 4 — Determine the filename

Today's date formatted as `ddmmyyyy` (e.g., April 10 2026 → `10042026`).

Check `docs/sessions/` for existing files matching `ddmmyyyy-*.md` for today. The next file gets the next integer suffix starting at 1. If none exist today, use `1`.

Filename: `docs/sessions/ddmmyyyy-N.md`

---

## Step 5 — Git activities

1. Write the approved session doc to `docs/sessions/<filename>`.
2. Stage and commit:
    ```
    git add docs/sessions/<filename>
    git commit -m "chore: session notes <ddmmyyyy>-<N>"
    ```
3. If `git status` shows other uncommitted changes, mention them — offer to help commit if the user wants.
4. Show the final `git log --oneline -5`.

---

## Step 6 — Send-off

End with a short "next session warmup" — two or three sentences the user can read cold to re-orient fast. Then one fun or encouraging closing line. Vary it each session.
