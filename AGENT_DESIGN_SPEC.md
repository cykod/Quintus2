# Design Spec Conventions

This document defines how design specs should be written for the Quintus project. The `/design` skill reads this file automatically.

## Document Structure

Every design spec must follow this structure:

### 1. Header Block

```markdown
# Phase N: Title — Detailed Design

> **Goal:** One-sentence goal
> **Outcome:** What success looks like
```

### 2. Status Table (required, at the top after the header)

Every spec must have a phase status table immediately after the header. Use these statuses: `Pending`, `In Progress`, `Done`, `Skipped`.

```markdown
## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Meta-package setup | Done |
| 2 | Player and physics | In Progress |
| 3 | Enemies and AI | Pending |
```

Update this table as implementation progresses.

### 3. Phases with Checkboxes

Break the design into numbered phases. Each phase has checkboxes for its deliverables. These are the unit of work — each checkbox should be independently testable.

```markdown
## Phase 1: Meta-Package Setup

- [ ] Create `packages/quintus/package.json` with workspace deps
- [ ] Write `src/index.ts` re-exporting all packages
- [ ] Add build config (`tsup.config.ts`)
- [ ] Write tests verifying all exports resolve
- [ ] Verify `pnpm build` succeeds
```

Keep checkboxes concrete and actionable. "Add feature X" not "Think about feature X".

### 4. Technical Detail

Each phase should include enough detail to implement without guessing:

- **File paths** — reference exact locations (`packages/physics/src/actor.ts`)
- **Code examples** — show key interfaces, class signatures, and usage patterns
- **ASCII diagrams** — for data flow, scene trees, state machines, etc.
- **Models/interfaces** — show the TypeScript types that define the contract

```markdown
### Scene Tree

```
Scene (Level1)
├── TileMap
├── Player (Actor)
│   └── CollisionShape (BoxShape 16x24)
├── EnemyManager (Node)
│   ├── Slime (Actor)
│   └── Bat (Actor)
└── HUD (UILayer)
    ├── ScoreLabel
    └── HealthBar
```​
```

### 5. Test Plan

Every phase must describe what tests to write. Tests live alongside source (`src/foo.test.ts`). Include:

- Unit tests for new classes/functions
- Integration tests showing systems working together
- Edge cases worth covering

```markdown
### Tests for Phase 2

**Unit:** `packages/physics/src/actor.test.ts`
- `move()` with no colliders → free movement
- `move()` against StaticCollider → slides along surface
- `isOnFloor()` true after landing, false after jumping

**Integration:** `packages/physics/src/integration.test.ts`
- Actor falls under gravity onto StaticCollider
- Actor-to-Actor collision with onContact signal
```

### 6. Definition of Done

End with a clear checklist of completion criteria:

```markdown
## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] Demo runs in browser via `pnpm dev`
```

## Specifying Behavior Precisely

Three failure modes cost a phase each across the embedded-integration build. All three are
about *how* a rule is written, not how much detail it has.

**Invariants have two halves: the rule, and the family it ranges over. Specify both.** Name
the family's members *and* its deliberate exemptions, with a reason for each. "Every tree
query skips destroyed nodes" is half a spec — it under-covers when a method is forgotten,
and over-covers when a lookalike is swept in (`Node.is()` is a type guard, not a query:
narrowing must not depend on lifecycle state). A rule written to fix under-coverage
produces over-coverage unless it names its exemptions.

When a phase applies one rule to several call sites, state the rule once as an invariant
and mark any per-site table as an implementation hint, not the specification. Enumerations
can't be checked for completeness; invariants can. Scope the invariant to the
**subsystem**, not to the code the phase adds — if the phase opens a new path into existing
code, that code's contract is now the phase's problem.

**The prose guarantee and the prescribed mechanic are two specifications, and only the
mechanic gets implemented.** A design that says "letterboxes into the parent's **content
box**" in prose and "compute from `clientWidth`/`clientHeight`" in a table has specified two
different things — those are different boxes, and the mechanic shipped as a bug that every
downstream artifact agreed with. Before implementing, check the mechanic actually delivers
the prose, and write the test against the prose. If a prose sentence has no test, add the
test or delete the sentence.

**Any sentence asserting behavior that already exists must cite the file and symbol it was
read from — and must have been read, not recalled.** Statements about behavior the phase
will create are proposals and need no citation. Statements about current behavior are
claims about the codebase, and they're the most-copied, least-checked text in the repo: the
design doc binds every downstream artifact and nothing binds the design doc. Cite `file` +
**symbol name**; line numbers are optional and must be marked "as of `<date>`" — they drift
within a single phase.

**Test the invariant across the family in one table-driven test, and give each exemption
its own passing assertion.** Omission from a loop is invisible; an explicit assertion fails
RED when someone over-generalizes.

**Record escalated decisions in an "Open decisions" section with their resolution**, not
only in a phase's shipped-note. They're the highest-value text in the doc for a future
maintainer and the easiest to lose.

## Guidelines

- **Testability first** — if a phase can't be tested in isolation, break it down further. Every phase should end with `pnpm test` passing.
- **Reference real files** — don't describe code in the abstract. Point to `packages/core/src/node.ts:42` and show what to change.
- **Show, don't tell** — a 10-line code example beats a paragraph of explanation.
- **Existing patterns** — check how existing packages handle similar concerns (plugin pattern, WeakMap accessors, module augmentation, signal conventions). Match them.
- **Size phases for ~1-2 hours of work** — large enough to be meaningful, small enough to test and commit independently.
- **Cross-reference** — link to `CLAUDE.md`, `IMPLEMENTATION_PLAN.md`, or other design docs when relevant. Use `@` notation for file references.
- **Point at existing artifacts instead of naming new ones.** A hardcoded method name, asset
  filename, or extension is an assumption about what some phase will produce, and it rots
  when that phase does something different. "Reuse `examples/tower-defense/assets/sfx/cannon.ogg`"
  beats "synthesize a cannon.wav"; "see `reactive-state.ts`" beats transcribing an API shape.
- **Don't split a phase across a single control-flow path.** When one flow
  (`onDetonate → carve → score → afterShot → switchTo`) is cut so the middle phase owns the
  wiring and the endpoints land later, every cut becomes a forward reference that must be
  stubbed. Split along data boundaries, or build a registered flow-skeleton first so later
  phases fill stubs rather than create them.
