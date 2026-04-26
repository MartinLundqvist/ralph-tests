#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

N=$1
CONTEXT_FILE=".ralph-context.md"
STATUS_FILE=".ralph-status.json"
TIMEOUT_BIN=$(command -v timeout || command -v gtimeout || true)
progress_pid=""

cleanup() {
  trap - EXIT INT TERM
  if [ -n "$progress_pid" ]; then
    kill "$progress_pid" 2>/dev/null || true
    wait "$progress_pid" 2>/dev/null || true
  fi
  rm -f "$CONTEXT_FILE" "$STATUS_FILE"
}

handle_termination() {
  echo ""
  echo "Terminating agent..."
  cleanup
  exit 130
}

trap cleanup EXIT
trap handle_termination INT TERM

start_log_progress() {
  local log_file=$1
  local line_count

  (
    while true; do
      if [ -f "$log_file" ]; then
        line_count=$(wc -l < "$log_file" 2>/dev/null | tr -d ' ')
      else
        line_count=0
      fi

      printf "\rAgent running... log lines: %s" "${line_count:-0}"
      sleep 2
    done
  ) &
  progress_pid=$!
}

stop_log_progress() {
  if [ -n "$progress_pid" ]; then
    kill "$progress_pid" 2>/dev/null || true
    wait "$progress_pid" 2>/dev/null || true
    progress_pid=""
    printf "\r"
  fi
}

# Returns the number of the lowest open "grindable" issue with no open blockers.
# Exits with code 1 if no such issue exists.
find_next_issue() {
  local numbers
  numbers=$(gh issue list --state open --label grindable --json number \
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

read_status_field() {
  python3 - "$STATUS_FILE" "$1" <<'PY'
import json
import sys

try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
except Exception:
    sys.exit(0)

value = data.get(sys.argv[2], "")
print("" if value is None else value)
PY
}

for ((i = 1; i <= N; i++)); do
  echo "=== Iteration $i / $N ==="
  echo "Looking for the next unblocked grindable issue..."

  issue_number=$(find_next_issue) || {
    echo "No unblocked grindable issues remain. Done after $((i - 1)) iterations."
    exit 0
  }

  echo "Working on issue #${issue_number}..."
  echo "Fetching issue details and comments..."

  issue_title=$(gh issue view "$issue_number" --json title --jq '.title')
  issue_body=$(gh issue view "$issue_number"  --json body   --jq '.body')
  issue_comments=$(gh issue view "$issue_number" --json comments \
    --jq '[.comments[] | "**\(.author.login):** \(.body)"] | join("\n\n")')

  other_issues=$(gh issue list --state open --label grindable --json number,title \
    --jq "[.[] | select(.number != $issue_number)] | sort_by(.number)[] | \"- #\(.number): \(.title)\"")

  echo "Writing context to ${CONTEXT_FILE}..."
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

  echo "Initializing status file ${STATUS_FILE}..."
  cat > "$STATUS_FILE" <<EOF
{
  "issue": $issue_number,
  "status": "in_progress",
  "summary": null
}
EOF

  log_file="logs/ralph-$(date +%Y%m%d-%H%M%S)-issue-${issue_number}.log"
  
  echo "Starting agent for issue #${issue_number}..."
  agent_cmd=(docker sandbox run claude -- --permission-mode acceptEdits --verbose --output-format stream-json -p \
    "@${CONTEXT_FILE} \
    1. Implement every acceptance criterion listed in issue #${issue_number}. \
    2. Run tests and type checks to validate your changes. \
    3. Commit your changes with a descriptive message referencing the issue. \
    4. Update ${STATUS_FILE} as the final source of truth. Keep the issue field set to ${issue_number}. \
    5. If every acceptance criterion is met, set status to complete and summary to one sentence describing what was built. \
    6. If the work is not complete, leave status as in_progress or set it to blocked, and explain the reason in summary.")

  : > "$log_file"
  start_log_progress "$log_file"

  set +e
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" --foreground --kill-after=10s 900s "${agent_cmd[@]}" > "$log_file" 2>&1
    agent_status=$?
  else
    echo "Warning: timeout/gtimeout not found; running agent without a 15-minute timeout." >> "$log_file"
    "${agent_cmd[@]}" >> "$log_file" 2>&1
    agent_status=$?
  fi
  set -e

  stop_log_progress
  line_count=$(wc -l < "$log_file" 2>/dev/null | tr -d ' ')
  echo "Agent finished. Log: ${log_file} (${line_count:-0} lines)."

  if [ "$agent_status" -eq 124 ]; then
    echo "Agent timed out after 15 minutes."
  fi

  # Read the completion status
  echo "Reading completion status from ${STATUS_FILE}..."
  status=$(read_status_field status)
  status_issue=$(read_status_field issue)
  echo "Status reported: issue=${status_issue:-unknown}, status=${status:-unknown}"

  if [ "$status" = "complete" ] && [ "$status_issue" = "$issue_number" ]; then
    summary=$(read_status_field summary)
    echo "Issue #${issue_number} marked complete. Closing issue..."
    [ -n "$summary" ] && gh issue comment "$issue_number" --body "$summary"
    gh issue close "$issue_number"
    sleep 3
    echo "Issue #${issue_number} closed."
  else
    echo "Issue #${issue_number} not closed because the status file did not report complete for this issue."
  fi
done

echo "Reached iteration limit (${N}). Stopping."
