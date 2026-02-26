---
name: milestone
description: Create a milestone commit with a changelog entry. Use this when you want to save your work with a well-crafted commit message and update CHANGELOG.md.
---

# Milestone Skill

Create a milestone commit with changelog entry based on current changes and conversation context.

## Instructions

### Step 1: Gather Information

Run these commands to understand the current state:

1. `git status` - see overall state
2. `git diff` - see unstaged changes
3. `git diff --cached` - see staged changes

Also review the recent conversation history to understand what work was accomplished.

**Design document check:** If the conversation involved implementing phases or tasks from a design document (e.g., a `design-*.md` file), read that document and check whether any phase/task statuses need updating (e.g., marking phases as `DONE`, updating sub-task checkboxes). Include those edits in the files you stage.

### Step 2: Propose Commit Messages

Based on the diff and conversation context, propose two messages:

**Short message**: A concise 1-line commit message (50-72 characters) in imperative mood
- Good: "Add ordinance pipeline evals and fix assertions"
- Bad: "Added some fixes" or "Updates"

**Long message**: A 1-paragraph description (3-5 sentences) explaining:
- What was changed
- Why it was changed
- Any notable implementation details

Present both to the user:

```
**Short:** <short message>

**Long:**
<long message paragraph>
```

### Step 3: Get User Feedback

Ask the user using AskUserQuestion with these options:
- "Accept and commit" - proceed with proposed messages
- "Edit messages" - let user provide modifications
- "Cancel" - abort the milestone

If user wants to edit, ask them to provide the modified messages.

### Step 4: Execute (If Accepted)

Once user accepts (with or without edits):

1. **Stage relevant files** — `git add` the specific files that were changed (be thoughtful about what to stage; don't blindly use `-A`)

2. **Run the changelog + commit script**:
   ```bash
   .claude/skills/milestone/scripts/update-changelog.sh "<short message>" "<long message>"
   ```

   This script will:
   - Format the timestamp as "Friday, February 7th at 2pm"
   - Add the title as an h2 heading (`## Title`)
   - Wrap the description at 80 characters
   - Prepend the entry to CHANGELOG.md
   - Stage CHANGELOG.md
   - Commit all staged changes with short title, long description, and Co-Authored-By trailer

3. **Log the ask**: Run `log_ask.sh` with the `MILE` code and a **past-tense** summary:
   ```bash
   .claude/skills/asks/log_ask.sh MILE "Added rich summary pipeline with image classification and narrative generation"
   ```

4. **Report success** with the commit hash from `git rev-parse --short HEAD`

### Changelog Format

Each entry in CHANGELOG.md looks like:

```markdown
## Short commit message title
*Friday, February 7th at 2pm*
Long description paragraph wrapped at 80 characters. This explains what was
changed, why it was changed, and any notable implementation details that future
developers should know about.

---
```

### Notes

- The Co-Authored-By line is included automatically by the script
- Handle special characters properly — the script uses HEREDOC for the commit message
- The script handles creating CHANGELOG.md if it doesn't exist
