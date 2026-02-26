---
name: implement
description: "Implement a phase or feature from a design document. Usage: /implement <design-file>"
arguments:
  - name: args
    description: "Path to the design document to implement (e.g. 'steering/PHASE_6_DESIGN.md' or '@steering/PHASE_6_DESIGN.md')"
---

# Implement Skill

Implement a phase or feature based on a design document.

## Instructions

### Step 1: Parse Arguments

Extract the **design file path** from the arguments. The user may prefix it with `@` — strip that if present.

If no file path is provided, ask the user using AskUserQuestion.

### Step 2: Read the Design Document

Read the specified design file. If the file doesn't exist, inform the user and stop.

### Step 3: Log the Ask

Log the ask by calling `log_ask.sh` with the `IMPL` code:
```bash
.claude/skills/asks/log_ask.sh IMPL "Implement <brief description derived from the design document>"
```
Derive the brief description from the design document's title or overview section. Use active/imperative tense (e.g. "Implement phase 6 steering pipeline", "Implement admin system with role-based access"). Do NOT ask the user — just call it directly.

### Step 4: Read the Implementation Spec (if it exists)

Check if an `AGENT_IMPLEMENTATION_SPEC.md` file exists in the project root (current working directory). If it does, read it thoroughly. This file contains project-specific guidelines for how implementations should be done — coding conventions, testing requirements, commit practices, etc.

Adhere to all instructions in the spec during implementation.

If the file does not exist, proceed without it — use your best judgment and follow existing codebase conventions.

### Step 5: Implement

Proceed to implement the design document as you would normally. This means:

1. Use EnterPlanMode to plan the implementation approach for the user's approval
2. Follow the design document's specifications closely
3. Follow the `AGENT_IMPLEMENTATION_SPEC.md` guidelines if one was found
4. Write clean, well-structured code consistent with the existing codebase
5. Include tests as specified in the design or as required by the implementation spec

### Notes

- The design document is your source of truth — implement what it says
- Follow `AGENT_IMPLEMENTATION_SPEC.md` conventions if present
- When the design is ambiguous, make reasonable decisions and note them
- Cross-reference with existing code to maintain consistency
