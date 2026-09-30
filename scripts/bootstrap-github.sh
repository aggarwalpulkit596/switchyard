#!/usr/bin/env bash
# Creates labels, milestones and issues from backlog/*.md on the current GitHub repo.
# Idempotent: skips labels, milestones and issues (by exact title) that already exist.
# Requires: gh (authenticated), jq.
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Bootstrapping $REPO"

label() { # name color description
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" 2>/dev/null \
    && echo "  + label $1" || echo "  = label $1"
}
for t in feature:1D76DB bug:D73A4A spike:FBCA04 chore:C5DEF5 docs:0E8A16; do
  label "type:${t%%:*}" "${t##*:}" "Issue type"
done
for a in web api worker domain db railway demo-app infra docs; do
  label "area:$a" "BFD4F2" "Area"
done
label "priority:p0" "B60205" "Blocks milestone exit"
label "priority:p1" "D93F0B" "Needed this milestone"
label "priority:p2" "FEF2C0" "Nice to have"
label "status:blocked" "000000" "Waiting on dependency"
label "status:needs-decision" "5319E7" "Needs an ADR or owner decision"

milestone() { # title due description
  if gh api "repos/$REPO/milestones?state=all&per_page=100" | jq -e --arg t "$1" '.[]|select(.title==$t)' >/dev/null; then
    echo "  = milestone $1"
  else
    gh api "repos/$REPO/milestones" -f title="$1" -f due_on="$2T23:59:59Z" -f description="$3" >/dev/null
    echo "  + milestone $1"
  fi
}
milestone "M0" "2026-10-05" "Foundations & platform verification spike"
milestone "M1" "2026-10-19" "Rehearsal & evidence vertical slice (application trigger)"
milestone "M2" "2026-10-26" "Dark deploy by digest + recovery"
milestone "M3" "2026-11-02" "Flag-controlled activation"
milestone "M4" "2026-11-09" "Guardrails, propagation & recovery verification"
milestone "M5" "2026-11-16" "Polish, demo, measured results"

existing="$(gh issue list --repo "$REPO" --state all --limit 500 --json title -q '.[].title')"
for f in backlog/*.md; do
  title=$(awk -F'"' '/^title:/{print $2; exit}' "$f")
  labels=$(awk -F'"' '/^labels:/{print $2; exit}' "$f")
  ms=$(awk -F'"' '/^milestone:/{print $2; exit}' "$f")
  body=$(awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$f")
  if grep -Fxq "$title" <<<"$existing"; then
    echo "  = issue $title"; continue
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --milestone "$ms" --body "$body" >/dev/null
  echo "  + issue $title"
done
echo "Done."
