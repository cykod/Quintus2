# Agent Tooling Suggestions — changes to apply outside the container

> **Why this doc exists.** These retro findings target files under `~/.claude/skills/`, which
> live outside the repo and outside the container. `/auto-apply-retro` applies findings to
> project docs (`CLAUDE.md`, `AGENT_*_SPEC.md`); everything here needs a human to apply it to
> the global skill definitions instead.
>
> **Source:** the 19 retros under `.work/retro/` reviewed on 2026-07-30, principally
> `2026-07-29-usage-fixes-p1-p2`, `-p3`, `-p4`, `-p5` (the embedded-integration build) and
> `2026-07-02-phase7-e2e-docs` (the packaging build).

---

## Status

| # | Target | Change | Evidence strength | Applied? |
|---|--------|--------|-------------------|----------|
| 1 | `~/.claude/skills/build/SKILL.md` §5b | Shared-checkout no-mutation rule for the five parallel agents | **Strong** — one real corruption, then held 3× when injected manually | ☐ |
| 2 | `~/.claude/skills/build/SKILL.md` §5 | Inject the prior batch's retro process-findings into each agent prompt | **Strong** — measured as the operative variable (see §2) | ☐ |
| 3 | `~/.claude/skills/build/SKILL.md` (or `/autobuild`) | Run `/apply-retro` *between* batches, not only at the end | Medium — recurred across two separate builds | ☐ |

---

## 1. Shared-checkout rule (`/build` §5b)

**The problem, observed.** `/build` §5b launches five agents in parallel against **one working
tree** with no rule against mutating it. In Batch 1 of the embedded-integration build, the
code-review agent ran `git stash` to compare against baseline. The retro agent — mid-verification
against `packages/core/src/node.ts` — silently read **pre-change** code and was one step from
filing the implementation as broken. Recovering required `git show 'stash@{0}':<path>`. The same
agent also left a probe file at `packages/core/src/__cdrv_probe.test.ts`, inside the root vitest
glob.

**The mitigation works.** For Batches 2–4 the rule below was pasted by hand into all five agent
prompts. The tree stayed clean all three times, and each retro confirmed it independently.
Making it part of the skill is what stops it depending on the orchestrator remembering.

**Suggested text** — add to the shared preamble for the five agents in §5b:

```markdown
**Shared-checkout rule (all five agents):** you run in parallel against the *same* working
tree. Never `git stash`, `git checkout --`, `git restore`, or otherwise revert files — another
agent may be mid-measurement and will silently read the wrong code. To see pre-change content
use `git show HEAD:<path>`; to verify RED, create a throwaway `git worktree`. Scratch and probe
files go in the scratchpad directory, never under `packages/*/src/` (the root vitest glob
collects them). Leave the tree exactly as you found it.
```

> An alternative worth considering: give the review agents `isolation: "worktree"` so the rule is
> structural rather than advisory. Costs ~200–500ms and disk per agent. The retro flagged this as
> the more robust fix; the prompt rule is the cheap one.

---

## 2. Inject the prior retro's process findings into agent prompts

**The finding (batch 5 retro, "the single highest-value durable change").** The build ran a
natural experiment across four batches:

- **Every finding with a code half was closed by `/fix`, inside its own batch.**
- **Every doc/process-only finding recurred in all subsequent batches — with one exception:**
  the shared-checkout rule, which held because it was pasted into each agent's prompt by hand.

So the operative variable is not retro latency. It is **whether a finding reaches the next
agent's prompt**. `/fix` reaches code; prompts reach agents; `.work/retro/*.md` reaches nobody.

Concretely, Batch 2 re-paid for three findings Batch 1 had already made, and in one case the
stale text was actively wrong (see §3 caveat below).

**Suggested change.** In `/build` §5a, before launching the implement agent, read the previous
batch's retro (if any) and inline its **process** findings — not its code findings, which `/fix`
already closed — into the agent prompt. Something like:

```markdown
**Carry-forward from the previous batch's retro.** Read `.work/retro/<prev-slug>.md` and inline
its process/workflow findings into this prompt (not its code findings — `/fix` closed those).
Typical carry-forwards: known-red baselines so the agent doesn't re-measure them, gates that
are not what they appear to be, and `file:line` drift in the design doc.
```

---

## 3. Run `/apply-retro` between batches

Both the packaging build (`2026-07-02-phase7-e2e-docs`) and the embedded-integration build
reached the same conclusion independently: retro findings that are cheap, recurring, and a
prerequisite of a named later phase should be applied **before starting the next batch**, not
batched to the end.

In the packaging build, a "local-tarball scaffold→install→build→test" helper was flagged in the
Phase 4 retro, recurred verbatim in Phases 5 and 6, and wasn't formalized until Phase 7 — three
phases of re-improvised friction one early `/apply-retro` run would have retired.

> **Caveat, and the reason this is ranked third.** Applying retros between batches only helps if
> the text being applied is *correct*. Batch 1's retro proposed a `pnpm -r tsc --noEmit` CI gate
> described as "blocked by one pre-existing error". Batch 2 measured it: **16 of 23 packages red,
> ~253 errors**, almost all `TS2304: Cannot find name 'vi'` from package tsconfigs sweeping in
> `*.test.ts` without `"types": ["vitest/globals"]`. Had `/apply-retro` run between batches
> without review, that guidance would have landed in `CLAUDE.md` and pointed every later agent at
> a wall. A later retro's correction must be allowed to supersede an earlier one's draft — which
> is exactly what the supersession handling in `/auto-apply-retro` did on 2026-07-30.

---

## Not proposed

- **Escalation rate.** Three of four batches ended with a genuine product decision escalated to
  the human (physics solver semantics, editable-target default, sibling centering). The batch-5
  retro assessed this as **healthy**, not a symptom of under-specification: all three were
  product/compatibility questions with breaking-change dimensions and no locally-correct answer.
  The tell for under-specification would be escalating *mechanics*, and none were. No change.
