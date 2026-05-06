# Ralph Loop (`afk-ralph.sh`)

This repository uses a loop script to process GitHub issues in repeated AFK agent runs.

The core script is `afk-ralph.sh` (the "Ralph loop").

## Requirements

- `sbx` installed and configured (required).
- `gh` (GitHub CLI) authenticated for the target repository.
- `python3`.
- `timeout` (or `gtimeout`) is recommended for enforcing per-iteration limits.

## First-time SBX setup (required)

Before running Ralph, create your sandbox manually once with `sbx`, then note the sandbox name.

Ralph takes that sandbox name as the first argument:

```bash
./afk-ralph.sh <sandbox-name> <iterations>
```

If the sandbox does not already exist, the loop cannot start correctly.

### Why `sbx` is required

`sbx` was chosen for stability. In this workflow, each iteration needs a predictable, isolated execution environment with reliable resource behavior across repeated runs. The script is built around `sbx run ...` as its agent launcher.

## Why GitHub GraphQL is used

The loop uses GitHub's GraphQL API for issue selection because it is more stable for this use case:

- one structured query fetches exactly the needed issue set;
- response shape is predictable, reducing brittle text parsing;
- fewer round trips for list/filter operations in the hot path.

In short: GraphQL was selected for operational stability over long unattended loops.

## Recommended planning flow

Before running the loop, the recommended flow is to use **Matt Pocock**'s agent skills:

- [`/to-prd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-prd/SKILL.md)
- [`/to-issues`](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-issues/SKILL.md)

Repository: [`mattpocock/skills`](https://github.com/mattpocock/skills)

This gives the loop clean, implementation-ready issues with clear acceptance criteria and dependency ordering.

## What the Ralph loop does

At a high level, `afk-ralph.sh <sandbox-name> <iterations>`:

1. Validates input (`sandbox-name`, positive iteration count).
2. Finds the next **open, unblocked, `grindable`** issue.
3. Builds a context file (`.ralph-context.md`) containing:
   - current issue title/body/comments;
   - previous partial summary (if a prior attempt timed out);
   - other open grindable issues as context-only.
4. Initializes/updates a status checkpoint file (`.ralph-status.json`).
5. Launches the agent in SBX with strict constraints:
   - 15-minute hard timeout per iteration;
   - targeted work only (no broad exploration);
   - smallest validating tests first;
   - checkpoint progress to `.ralph-status.json`.
6. Reads the final reported status:
   - if `complete` for the same issue, comments summary and closes the issue;
   - otherwise leaves it open for a later iteration.
7. Repeats until iteration limit is reached or no unblocked grindable issues remain.

## Issue selection rule

Ralph only picks up GitHub issues labeled `grindable`. Issues without that label are ignored by the loop.

## Issue dependency behavior

The script recognizes blockers by scanning issue body text for:

- `Blocked by #123`

If any referenced blocker issue is still open, that issue is skipped until unblocked.

## Timeouts and resumability

- Each run is capped at 15 minutes when `timeout`/`gtimeout` is available.
- If interrupted or timed out, the next iteration can resume from the previous `.ralph-status.json` summary.
- Temporary context/status files are cleaned up on exit.

## Logging and troubleshooting

- The full agent conversation/output for each iteration is logged to the `logs` directory.
- Log files follow this pattern: `logs/ralph-YYYYMMDD-HHMMSS-issue-<issue-number>.log`.
- Use these logs as the primary troubleshooting source when an iteration times out, fails, or behaves unexpectedly.

## Usage

```bash
./afk-ralph.sh <sandbox-name> <iterations>
```

Example:

```bash
./afk-ralph.sh my-sandbox 10
```

This will attempt up to 10 issue-processing iterations.
