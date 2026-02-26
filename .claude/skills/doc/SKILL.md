---
name: doc
description: "Generate a manual testing walkthrough doc for recent work. Documents the most recent commit or current WIP with step-by-step testing instructions and optional Playwright screenshots."
allowed-tools: Bash(playwright-cli:*)
---

# Doc Skill

Generate a documentation file in `docs/` that describes what was just built and provides a manual testing walkthrough, optionally with browser screenshots.

## Instructions

### Step 1: Determine What Was Built

Gather context from multiple sources to understand the recent work:

1. **Check git state** to decide if we're documenting a commit or WIP:
   ```bash
   git status
   git diff --stat
   git diff --cached --stat
   ```

2. **If there are uncommitted changes (WIP)**: Use the WIP as the primary source.
   ```bash
   git diff
   git diff --cached
   ```

3. **If the working tree is clean**: Document the most recent commit.
   ```bash
   git log -1 --format="%H %s%n%n%b"
   git diff HEAD~1..HEAD
   git diff --stat HEAD~1..HEAD
   ```

4. **Review conversation history**: Look at the current conversation for additional context about what the user was working on, what they asked for, and any design decisions discussed. This often provides the best "why" context.

5. **Read changed files** in full to understand the feature end-to-end. Use the Read tool on the key files that were modified.

### Step 2: Determine the Output Directory

Generate a directory name that includes today's date (YYYY-MM-DD) followed by a descriptive kebab-case slug. The doc goes in `overview.md` and screenshots go in a `screenshots/` subdirectory:

```
docs/2026-02-22-add-user-auth-flow/
  overview.md
  screenshots/
    login-form-filled.png
    dashboard-after-login.png
```

Create the directory structure:
```bash
mkdir -p docs/<date-slug>/screenshots
```

### Step 3: Determine If Playwright Testing Is Appropriate

Playwright screenshots are appropriate when the changes involve:
- Web UI (HTML, CSS, React components, templates, etc.)
- Browser-visible behavior (forms, modals, navigation, layout)
- API responses that can be verified via a browser

Playwright screenshots are NOT appropriate when:
- Changes are purely backend/CLI with no web interface
- Changes are to build tooling, configs, or non-visual code
- No dev server is available or easily startable

If Playwright is appropriate, proceed to Step 4a. Otherwise, skip to Step 4b.

### Step 4a: Playwright Visual Testing Walkthrough

For each testable feature or behavior:

1. **Start the dev server** if it isn't already running. Check for common patterns:
   ```bash
   # Check for running servers first
   lsof -i :3000 -i :4000 -i :5173 -i :8080 2>/dev/null
   ```
   If no server is running, look at `package.json` or project config for the start command, start it in the background, and wait for it to be ready.

2. **Open the browser**:
   ```bash
   playwright-cli open http://localhost:<port>
   ```

3. **Walk through each test step**, taking a screenshot at each meaningful state:
   ```bash
   playwright-cli snapshot
   # navigate, click, fill forms as needed
   playwright-cli click e5
   playwright-cli screenshot --filename=docs/<date-slug>/screenshots/<step-name>.png
   ```

4. **If something isn't working as expected**:
   - Take a screenshot of the broken state
   - Document what was expected vs what happened
   - Propose a fix (code change) in the doc
   - Use AskUserQuestion to ask the user if they want to apply the fix
   - If they say yes, apply the fix and re-test
   - If they say no, document the issue as a known issue in the doc

5. **Close the browser** when done:
   ```bash
   playwright-cli close
   ```

### Step 4b: Non-Visual Testing Walkthrough

For CLI tools, APIs, backend logic, etc.:

1. Identify the commands or API calls needed to verify the changes
2. Run them and capture representative output
3. Document the expected vs actual results

### Step 5: Write the Documentation

Write the doc file using this structure:

```markdown
# <Feature/Fix Title>

*Generated: <full written-out date, e.g. "Sunday, February 22nd, 2026">*
*Source: <commit hash + message> or "Current WIP"*

## What Was Built

<2-4 paragraph description of what was built and why. Draw from the conversation
history, commit messages, and code changes. Focus on the user-facing behavior
and key implementation decisions.>

## Files Changed

| File | Change |
|------|--------|
| `path/to/file.ts` | Brief description of change |

## How to Test

### Prerequisites

- <Any setup needed: env vars, database state, running services>

### Test Steps

#### 1. <First test scenario>

<Description of what to do and what to expect>

```bash
<command or action>
```

<If Playwright was used, include the screenshot>:
![Step 1: Description](screenshots/<step-name>.png)  <!-- relative to overview.md -->

**Expected**: <what should happen>

#### 2. <Next test scenario>

...

## Known Issues

<Any issues discovered during testing, with proposed fixes if applicable.
Omit this section if there are no issues.>
```

### Step 6: Confirm with User

Show the user:
- The path to the generated doc
- A brief summary of what was documented
- How many test steps were included
- Whether Playwright screenshots were captured

### Notes

- Always create the `docs/<date-slug>/screenshots/` directory before saving screenshots there
- Screenshot filenames should be descriptive: `login-form-filled.png`, not `step1.png`
- Image paths in `overview.md` should be relative: `screenshots/<name>.png`
- If the dev server needs to be started, prefer running it in the background and give it time to boot
- When reading changed files, focus on understanding the user-facing behavior, not every implementation detail
- The doc should be useful to someone who wasn't part of the conversation — include enough context to stand alone
- If there's a CHANGELOG.md in the project, read the most recent entry for additional context
