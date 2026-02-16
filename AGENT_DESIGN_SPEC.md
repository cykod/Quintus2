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

## Guidelines

- **Testability first** — if a phase can't be tested in isolation, break it down further. Every phase should end with `pnpm test` passing.
- **Reference real files** — don't describe code in the abstract. Point to `packages/core/src/node.ts:42` and show what to change.
- **Show, don't tell** — a 10-line code example beats a paragraph of explanation.
- **Existing patterns** — check how existing packages handle similar concerns (plugin pattern, WeakMap accessors, module augmentation, signal conventions). Match them.
- **Size phases for ~1-2 hours of work** — large enough to be meaningful, small enough to test and commit independently.
- **Cross-reference** — link to `CLAUDE.md`, `IMPLEMENTATION_PLAN.md`, or other design docs when relevant. Use `@` notation for file references.
