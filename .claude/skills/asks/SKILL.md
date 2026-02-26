---
name: asks
description: Review the current conversation, summarize the main ask into a single sentence, and append it to ASKS.md in the project root. If the user includes additional instructions after `/asks`, log the ask AND execute those instructions.
---

# Asks Skill

Summarize the primary request from the current conversation and log it to ASKS.md.

## Instructions

### Step 1: Check for Inline Instructions

If the user typed something after `/asks` (e.g., `/asks now fix the tests`), treat it as two tasks:
1. First, log the ask (Steps 2–5 below)
2. Then, execute the user's inline instruction as a normal request

If `/asks` was invoked with no additional text, just log the ask.

### Step 2: Review the Conversation

Review the full conversation history. Identify:

- The **primary ask** — the big-picture request the user made
- Ignore back-and-forth feedback, corrections, intermediate changes, and implementation details
- If `/asks` was called earlier in the conversation, only consider messages **after** the most recent `/asks` invocation
- Focus on **what** was requested, not how it was implemented

### Step 3: Determine Ask Type Code

Use a **fixed 4-character code** based on the type of ask:

| Code   | When to use                                      |
|--------|--------------------------------------------------|
| `IMPL` | Implementation work (adding features, fixing bugs, refactoring, etc.) |
| `MILE` | Called from the `/milestone` skill               |
| `DEVL` | Called from the `/devil` skill                   |
| `ASKS` | Anything else (research, planning, questions, etc.) |

If the `/asks` skill was invoked by another skill (`/milestone` or `/devil`), use that skill's code. Otherwise, use `IMPL` if the conversation involved implementation work, or `ASKS` for everything else.

### Step 4: Compose the Summary

Write a **single medium-length sentence** (roughly 15-30 words) that captures the core ask.

**Tense rules:**
- `IMPL` — Use **active/imperative tense** (present, ongoing work): "Add...", "Implement...", "Fix...", "Refactor..."
- `MILE` — Use **past tense** (work is done and committed): "Added...", "Implemented...", "Fixed...", "Refactored..."
- `DEVL` — Use **active tense**: "Review...", "Analyze..."
- `ASKS` — Use **active tense**: "Research...", "Plan...", "Design..."

**Other guidelines:**
- Be razor-focused on the **what** — what did the user want accomplished?
- Do NOT include implementation details, feedback loops, or iteration history
- Do NOT mention files changed unless the file itself was the deliverable (e.g., "Create PHASE_6_DESIGN.md...")

Examples:
- `[IMPL]` "Implement the meeting agenda pipeline with PDF extraction and structured output via OpenAI"
- `[MILE]` "Added ordinance pipeline evals and fixed assertion handling for edge cases"
- `[DEVL]` "Review Phase 3 design for scalability concerns and testing gaps"
- `[ASKS]` "Research address normalization strategies for St/Saint ambiguity"

### Step 5: Log It

Run the `log_ask.sh` script from the skill's directory to append the entry. The script handles timestamping and file creation/appending:

```bash
.claude/skills/asks/log_ask.sh CODE "Summary sentence"
```

For example:
```bash
.claude/skills/asks/log_ask.sh IMPL "Implement the meeting agenda pipeline with PDF extraction and structured output"
```

This must be run from the **project root directory** (where ASKS.md lives).

### Step 6: Rename Terminal Title

The `log_ask.sh` script automatically sets the terminal title to `[CODE] Summary` using the same code and summary from the log entry. This helps you identify conversations at a glance in your terminal tab/window.

### Step 7: Confirm and Continue

Show the user the output from the script (the `Logged:` and `Terminal title set:` lines).

If there were inline instructions from Step 1, now proceed to execute them as a normal user request.

### Notes

- The type code tells you at a glance what kind of work was done
- Keep the summary focused and concise — it's a log, not documentation
- If the conversation had multiple distinct big asks, pick the most significant one or combine them if closely related
- This is a lightweight record — don't overthink it
- When invoked by another skill, that skill should pass the type code — don't second-guess it
