#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <sandbox-name> <iterations>"
  exit 1
fi

SANDBOX_NAME=$1
N=$2

if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 1 ]; then
  echo "Error: iterations must be a positive integer."
  echo "Usage: $0 <sandbox-name> <iterations>"
  exit 1
fi
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
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
  local owner repo numbers
  owner=${REPO%%/*}
  repo=${REPO##*/}
  numbers=$(gh api graphql -f query="{
    repository(owner: \"$owner\", name: \"$repo\") {
      issues(first: 50, states: OPEN, labels: [\"grindable\"]) {
        nodes { number }
      }
    }
  }" --jq '[.data.repository.issues.nodes[].number] | sort | .[]')

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

  other_issues=$(gh api graphql -f query="{
    repository(owner: \"${REPO%%/*}\", name: \"${REPO##*/}\") {
      issues(first: 50, states: OPEN, labels: [\"grindable\"]) {
        nodes { number title }
      }
    }
  }" --jq "[.data.repository.issues.nodes[] | select(.number != $issue_number)] | sort_by(.number)[] | \"- #\(.number): \(.title)\"")

  # If a prior iteration of this script worked on the same issue but did not
  # complete (e.g. it was killed by the per-iteration timeout), preserve its
  # summary so the next agent can continue instead of starting over cold.
  previous_status=""
  previous_summary=""
  if [ -f "$STATUS_FILE" ]; then
    prev_issue=$(read_status_field issue)
    if [ "$prev_issue" = "$issue_number" ]; then
      previous_status=$(read_status_field status)
      previous_summary=$(read_status_field summary)
    fi
  fi

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
    if [ -n "$previous_summary" ] && [ "$previous_status" != "complete" ]; then
      echo ""
      echo "---"
      echo ""
      echo "## Continuing from a prior iteration"
      echo ""
      echo "A previous agent run on this same issue was cut off before reporting completion (most likely by the per-iteration timeout). Its last checkpoint summary was:"
      echo ""
      echo "> ${previous_summary}"
      echo ""
      echo "Before doing anything else, run \`git status\` and \`git diff --stat HEAD\` to see what is already on disk, and continue from where the prior work left off rather than restarting from scratch."
    fi
    echo ""
    echo "---"
    echo ""
    echo "## Other open issues (context only — do not work on these)"
    echo ""
    echo "${other_issues:-None}"
  } > "$CONTEXT_FILE"

  echo "Initializing status file ${STATUS_FILE}..."
  python3 - "$issue_number" "$previous_summary" > "$STATUS_FILE" <<'PY'
import json, sys
issue = int(sys.argv[1])
summary = sys.argv[2] or None
print(json.dumps({"issue": issue, "status": "in_progress", "summary": summary}, indent=2))
PY

  mkdir -p logs
  log_file="logs/ralph-$(date +%Y%m%d-%H%M%S)-issue-${issue_number}.log"
  
  echo "Starting agent for issue #${issue_number}..."
  # Old launcher (kept for reference; switch back here if `sbx` is unavailable):
  # agent_cmd=(docker sandbox run claude -- --permission-mode acceptEdits --verbose --output-format stream-json -p \
  # `sbx run [flags] AGENT [-- AGENT_ARGS...]` — `-m 16g` raises the per-sandbox
  # memory ceiling (the old `docker sandbox` plugin was hard-capped at 4 GB).
  agent_cmd=(sbx run "$SANDBOX_NAME" -- --permission-mode acceptEdits --verbose --output-format stream-json -p \
    "@${CONTEXT_FILE} \
    Constraints: \
    - You have a hard 15-minute wall-clock budget. If you exceed it the process is killed mid-flight, your in-memory state is lost, and the next iteration starts cold. Spend the budget on writing and validating, not on broad upfront exploration. \
    - Do not launch the Explore subagent. Read files directly. Read only what is needed for the next decision; do not pre-read every type, schema, test, and migration before writing. AGENTS.md exists; trust it. \
    - Do not run recursive \`find\` from the repo root. \
    - Run the smallest validating test first (single file or \`--test-name-pattern\`). Only run a regression sweep after the targeted test passes, and prefer the project script (\`pnpm test\`, \`uv run pytest tests/ -q\`) over hand-listing test files. \
    - Do not re-grep the same command output more than once. \
    - Checkpoint your progress: every time you finish a meaningful chunk (e.g. an acceptance criterion, a passing test run), update ${STATUS_FILE} with a short \`summary\` describing what is on disk and what still remains. This is the only state the next iteration can see if you are killed. \
    Steps: \
    1. Implement every acceptance criterion listed in issue #${issue_number}. If the context file mentions a prior iteration, run \`git status\` first and continue from there rather than redoing work. \
    2. Run tests and type checks to validate your changes — smallest first, regression sweep only if needed. \
    3. Commit your changes with a descriptive message referencing the issue. \
    4. Update ${STATUS_FILE} as the final source of truth. Keep the issue field set to ${issue_number}. \
    5. If every acceptance criterion is met, set status to complete and summary to one sentence describing what was built. \
    6. If the work is not complete, leave status as in_progress or set it to blocked, and explain the reason in summary so the next iteration can resume.")

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
