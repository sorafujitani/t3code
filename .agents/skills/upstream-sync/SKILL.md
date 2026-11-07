---
name: upstream-sync
description: Merge pingdotgg/t3code main into this fork's main, resolving conflicts and keeping the fork's customizations. Use for the scheduled upstream sync or when asked to sync, merge, or catch up with upstream.
---

# Upstream sync

GitHub's hourly `Sync upstream` workflow merges upstream when nothing conflicts. This skill
finishes the merges it cannot. Work only in `.t3/upstream-sync` through
`scripts/sync-upstream.sh`; never change the main checkout or its branch.

## Steps

1. Run `scripts/sync-upstream.sh prepare`.
   - Exit 3: already up to date. Report that in one line and stop.
   - Exit 0: merged cleanly. Go to step 3.
   - Exit 2: conflicts are left in `.t3/upstream-sync`. Resolve them (step 2).
2. Resolve every conflicted file, `git add` it, and `git commit --no-edit` in the worktree.
3. Run `scripts/sync-upstream.sh verify`. Fix failures the merge caused, commit, and run it again.
4. Write the PR body to `.t3/upstream-sync-pr.md` and run
   `scripts/sync-upstream.sh publish .t3/upstream-sync-pr.md`. It merges the PR into `main`.

## Resolving conflicts

The fork's intent lives in its own commits. Read them before deciding:

```sh
git -C .t3/upstream-sync log --no-merges --format='%h %s' upstream/main..origin/main
git -C .t3/upstream-sync log -p --no-merges upstream/main..origin/main -- <file>
git -C .t3/upstream-sync log --format='%h %s' origin/main..upstream/main -- <file>
```

- Keep both sides whenever they can coexist: fork additions such as the DeepSeek icons,
  `app-sync`, keybindings, and panel defaults, next to whatever upstream added.
- When upstream changes behavior the fork deliberately changed, keep the fork's behavior and
  take the rest of upstream's change. Example: upstream made side chats copy the parent's
  permission mode; the fork keeps Full access but takes upstream's model and reasoning
  inheritance.
- Look past textual conflicts. An upstream commit that touches a fork feature in a file that
  merged cleanly can still undo it; check the fork commits' files with
  `git diff origin/main HEAD -- <file>`.
- For user docs, describe the merged behavior.
- Otherwise prefer upstream.

## Verification

`verify` runs `check:changed` against `upstream/main`, which covers the fork's changes and the
resolutions on top of the new upstream. If a failure also happens on plain `upstream/main`,
it is upstream's, not the merge's: note it in the PR body and continue.

Stop without publishing, and say why, when a conflict needs a product decision you cannot
infer from the fork's commits, or when a merge-caused failure remains after a real attempt.
Leave the worktree as it is.

## PR body

In English: how many upstream commits the merge brings in, then one line per conflicted file
stating how it was resolved and why, then the verification result and any upstream-owned
failures. End with the model and harness that did the work.
