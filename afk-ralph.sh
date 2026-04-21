#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

N=$1
CONTEXT_FILE=".ralph-context.md"

cleanup() {
  rm -f "$CONTEXT_FILE"
}
trap cleanup EXIT

# Returns the number of the lowest open issue with no open blockers.
# Exits with code 1 if no such issue exists.
find_next_issue() {
  local numbers
  numbers=$(gh issue list --state open --json number \
    --jq '[.[].number] | sort | .[]')

  [ -z "$numbers" ] && return 1

  for num in $numbers; do
    local body blockers blocked
    blocked=false
    body=$(gh issue view "$num" --json body --jq '.body')
    blockers=$(printf '%s' "$body" | grep -oE 'Blocked by #[0-9]+' | grep -oE '[0-9]+' || true)

    for blocker in $blockers; do
      local state
      state=$(gh issue view "$blocker" --json state --jq '.state')
      if [ "$state" = "OPEN" ]; then
        blocked=true
        break
      fi
    done

    if [ "$blocked" = "false" ]; then
      echo "$num"
      return 0
    fi
  done

  return 1
}

for ((i = 1; i <= N; i++)); do
  echo "=== Iteration $i / $N ==="

  issue_number=$(find_next_issue) || {
    echo "No unblocked open issues remain. Done after $((i - 1)) iterations."
    exit 0
  }

  echo "Working on issue #${issue_number}..."

  issue_title=$(gh issue view "$issue_number" --json title --jq '.title')
  issue_body=$(gh issue view "$issue_number"  --json body   --jq '.body')
  issue_comments=$(gh issue view "$issue_number" --json comments \
    --jq '[.comments[] | "**\(.author.login):** \(.body)"] | join("\n\n")')

  other_issues=$(gh issue list --state open --json number,title \
    --jq "[.[] | select(.number != $issue_number)] | sort_by(.number)[] | \"- #\(.number): \(.title)\"")

  {
    echo "# Issue #${issue_number}: ${issue_title}"
    echo ""
    echo "${issue_body}"
    if [ -n "$issue_comments" ]; then
      echo ""
      echo "## Previous comments"
      echo ""
      echo "${issue_comments}"
    fi
    echo ""
    echo "---"
    echo ""
    echo "## Other open issues (context only — do not work on these)"
    echo ""
    echo "${other_issues:-None}"
  } > "$CONTEXT_FILE"

  result=$(docker sandbox run claude -- --permission-mode acceptEdits -p \
    "@${CONTEXT_FILE} \
    1. Implement every acceptance criterion listed in issue #${issue_number}. \
    2. Run tests and type checks to validate your changes. \
    3. Commit your changes with a descriptive message referencing the issue. \
    4. If every acceptance criterion is met, output exactly on its own line: <promise>COMPLETE</promise> \
    5. Then output exactly on the next line: <summary>One sentence describing what was built.</summary>")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    summary=$(printf '%s' "$result" | sed -n 's/.*<summary>\(.*\)<\/summary>.*/\1/p' | head -1)
    [ -n "$summary" ] && gh issue comment "$issue_number" --body "$summary"
    gh issue close "$issue_number"
    echo "Issue #${issue_number} closed."
  fi
done

echo "Reached iteration limit (${N}). Stopping."
