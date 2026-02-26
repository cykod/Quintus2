---
name: design
description: "Create a design document for a project phase or feature. Usage: /design - <output-file> - <instructions>"
arguments:
  - name: args
    description: "Dash-separated: output file path and design instructions (e.g. 'steering/PHASE_6_DESIGN.md - please design phase 6 of @steering/IMPLEMENTATION_DESIGN.md')"
---

# Design Skill

Create a design document for a project phase or feature.

## Instructions

### Step 1: Parse Arguments

The arguments follow this format:
```
<output-file> - <design instructions>
```

Split on the first ` - ` (space-dash-space) to extract:
- **output-file** (required): The path where the design document should be written
- **design instructions** (required): What to design, may reference other files with `@` notation

If either part is missing, ask the user using AskUserQuestion.

### Step 2: Log the Ask

Log the ask by calling `log_ask.sh` with the `DSGN` code:
```bash
.claude/skills/asks/log_ask.sh DSGN "Design <brief description of what's being designed>"
```
Derive the brief description from the design instructions. Use active/imperative tense (e.g. "Design phase 6 steering implementation", "Design admin system with role-based access"). Do NOT ask the user — just call it directly.

### Step 3: Read the Design Spec (if it exists)

Check if an `AGENT_DESIGN_SPEC.md` file exists in the project root (current working directory). If it does, read it thoroughly. This file contains project-specific guidelines for how design documents should be structured, what sections to include, conventions to follow, etc.

Adhere to all instructions in the spec when creating the design document.

If the file does not exist, proceed without it — use your best judgment for document structure.

### Step 4: Read Referenced Files

If the design instructions reference any files (via `@` notation or explicit paths), read those files to understand the context. These might include:
- An overall implementation design or plan
- Existing phase designs for consistency
- Related code files for technical context

### Step 5: Create the Design Document

Write the design document to the specified output file path. The document should:

1. Be thorough and actionable — an implementer should be able to work from this document
2. Follow the conventions in `AGENT_DESIGN_SPEC.md` if one was found
3. Cover the scope described in the design instructions
4. Reference existing code and architecture where relevant
5. Include concrete technical details, not just high-level hand-waving

Use the Task tool with an Explore agent to investigate the codebase as needed to ground the design in reality.

### Step 6: Confirm

Show the user:
- The path of the created design document
- A brief summary of what was designed (2-3 sentences)

### Notes

- The design document is the deliverable — put your effort into making it comprehensive and useful
- Cross-reference with actual codebase to ensure the design is grounded in reality
- If the project has existing design documents, match their style and conventions
- The `@` references in instructions are just pointers to files — read them for context
