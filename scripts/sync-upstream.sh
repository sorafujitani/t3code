#!/usr/bin/env bash
# Merges upstream main into this fork's main from a dedicated worktree, so the
# checkout you work in is never touched.
#
#   scripts/sync-upstream.sh prepare            fetch and merge in .t3/upstream-sync
#                                               exit 0 merged cleanly, 2 conflicts left in the worktree, 3 up to date
#   scripts/sync-upstream.sh verify             install and run check:changed against upstream/main
#   scripts/sync-upstream.sh publish [body.md]  push, open a PR into main, merge it, close the sync issue
#
# The upstream-sync skill (.agents/skills/upstream-sync) resolves conflicts between prepare and verify.
set -euo pipefail

UPSTREAM_REPO="${UPSTREAM_REPO:-pingdotgg/t3code}"
BRANCH="sync/upstream"
ISSUE_LABEL="upstream-sync"

root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
wt="$root/.t3/upstream-sync"
repo="$(cd "$root" && gh repo view --json nameWithOwner --jq .nameWithOwner)"

fail() {
  echo "sync-upstream: $*" >&2
  exit 1
}

fetch() {
  git -C "$root" fetch -q origin main
  git -C "$root" fetch -q "https://github.com/$UPSTREAM_REPO.git" "+main:refs/remotes/upstream/main"
}

prepare() {
  fetch
  local behind
  behind="$(git -C "$root" rev-list --count origin/main..upstream/main)"
  if [ "$behind" = 0 ]; then
    echo "main is up to date with $UPSTREAM_REPO"
    exit 3
  fi
  if [ -e "$wt/.git" ]; then
    git -C "$wt" merge --abort 2>/dev/null || true
    git -C "$wt" reset -q --hard
    git -C "$wt" clean -qfd
    git -C "$wt" checkout -q -B "$BRANCH" origin/main
  else
    git -C "$root" worktree add -q -B "$BRANCH" "$wt" origin/main
  fi
  echo "main is $behind commits behind $UPSTREAM_REPO; merging in $wt"
  if git -C "$wt" merge -q --no-edit -m "Merge upstream main" upstream/main; then
    echo "merged cleanly"
    exit 0
  fi
  echo "conflicts:"
  git -C "$wt" diff --name-only --diff-filter=U
  exit 2
}

require_merged() {
  [ -e "$wt/.git" ] || fail "no worktree at $wt; run prepare first"
  cd "$wt"
  [ -z "$(git status --porcelain)" ] || fail "commit or discard every change in $wt first"
  git merge-base --is-ancestor upstream/main HEAD || fail "HEAD does not contain upstream/main"
  git merge-base --is-ancestor origin/main HEAD || fail "origin/main moved since prepare; run prepare again"
  local forked
  forked="$(git diff --name-only --diff-filter=d upstream/main HEAD)"
  if [ -n "$forked" ] && git grep -nE '^(<<<<<<<|>>>>>>>)( |$)' -- $forked >&2; then
    fail "conflict markers remain"
  fi
}

verify() {
  require_merged
  vp i
  vp run check:changed upstream/main
}

publish() {
  local body="${1:-}"
  [ -z "$body" ] || body="$(cd "$(dirname "$body")" && pwd)/$(basename "$body")"
  fetch
  require_merged
  git push -q --force origin "HEAD:refs/heads/$BRANCH"
  if [ -z "$body" ]; then
    body="$(mktemp)"
    echo "Merges $UPSTREAM_REPO main into main without conflicts." > "$body"
  fi
  local pr
  pr="$(gh pr list --repo "$repo" --head "$BRANCH" --state open --json url --jq '.[0].url // empty')"
  if [ -z "$pr" ]; then
    pr="$(gh pr create --repo "$repo" --base main --head "$BRANCH" \
      --title "chore: merge upstream main" --body-file "$body")"
  else
    gh pr edit "$pr" --repo "$repo" --body-file "$body"
  fi
  gh pr merge "$pr" --repo "$repo" --merge
  for issue in $(gh issue list --repo "$repo" --label "$ISSUE_LABEL" --state open --json number --jq '.[].number'); do
    gh issue close "$issue" --repo "$repo" --comment "Merged in $pr."
  done
  git -C "$root" fetch -q origin main
  echo "merged $pr"
}

case "${1:-}" in
  prepare) prepare ;;
  verify) verify ;;
  publish) publish "${2:-}" ;;
  *) fail "usage: scripts/sync-upstream.sh prepare|verify|publish [body.md]" ;;
esac
