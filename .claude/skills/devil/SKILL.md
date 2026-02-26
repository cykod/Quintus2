---
name: devil
description: Play devil's advocate on a design document. Reviews phases for potential issues, gaps in testing, and future risks.
arguments:
  - name: args
    description: "Filename and optional phase (e.g. 'docs/PLAN.md' or 'docs/PLAN.md phase 3')"
---

# Devil's Advocate Review Skill

Review a design/plan document and play devil's advocate, identifying potential issues and suggesting fixes.

## Instructions

### Step 1: Parse Arguments

Parse the arguments string to extract:
- **filename** (required): The file path to review
- **phase** (optional): A specific phase to focus on (e.g. "phase 3", "3", "Phase 3")

If no filename is provided, ask the user for one using AskUserQuestion.

### Step 2: Read the Document

Read the specified file. If the file doesn't exist, inform the user and stop.

### Step 3: Determine Scope

- If a specific phase was provided, focus the review on that phase only
- If no phase was specified, review **all phases** in the document

### Step 4: Conduct the Review

Use the Task tool with an Explore or general-purpose agent to thoroughly review the document against the actual codebase. The agent should:

1. Read the document (or specific phase)
2. Cross-reference claims against the actual code where relevant
3. Identify potential issues including:
   - **Design flaws**: Architectural decisions that could cause problems
   - **Missing edge cases**: Scenarios not accounted for
   - **Testing gaps**: Areas lacking test coverage or untestable designs
   - **Scalability concerns**: Things that won't scale well
   - **Security risks**: Potential vulnerabilities
   - **Operational risks**: Deployment, monitoring, or maintenance issues
   - **Integration issues**: Problems at boundaries between components
   - **Future maintenance**: Things that will be hard to change later

### Step 5: Report Findings

Present the results as a **numbered list** with clear visual structure. Each issue should be easy to scan and separated from the next. Use this format:

```
## Devil's Advocate Review: [filename] [phase scope]

---

### 1. ⚠️ [SHORT ISSUE TITLE IN CAPS]
*Risk: High/Medium/Low*

[2-3 sentence description of the potential problem. Be specific and direct.]

**Suggested fix:** [Concrete, actionable suggestion to address the issue. Not vague — tell them exactly what to change.]

---

### 2. ⚠️ [SHORT ISSUE TITLE IN CAPS]
*Risk: High/Medium/Low*

[Problem description.]

**Suggested fix:** [Fix suggestion.]

---
```

**Formatting rules:**
- Each issue gets its own `###` heading with a number and the ⚠️  marker
- The title should be SHORT (3-6 words) and IN CAPS for scannability
- The problem statement is a compact paragraph — no bullet lists inside it
- "Suggested fix:" is always bold and on its own line, clearly separated from the problem
- Use `---` horizontal rules between issues to give visual breathing room
- Risk level is italicized directly under the title

### Step 6: Log the Ask

After presenting the review, log the ask directly by calling `log_ask.sh` with the `DEVL` code:
```bash
.claude/skills/asks/log_ask.sh DEVL "Review [document name] for potential issues and risks"
```
Use active tense for the summary. Do NOT ask the user — just call it directly.

### Notes

- Be genuinely critical — the point is to find real problems, not to be polite
- Prioritize issues by severity (high risk first)
- Each suggestion should be actionable, not vague
- Cross-reference with the actual codebase when possible to ground the review in reality
- If the document references specific files or patterns, verify they exist and work as described
