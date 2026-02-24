# Implementation Spec Conventions

This document defines how design specs should be implemented for the Quintus project. The `/implement` skill reads this file automatically.

## Workflow

### 1. Read the Design, Work Phase by Phase

Read the full design doc first. Then implement one phase at a time, in order. Do not skip ahead.

### 2. Test After Every Phase

After completing each phase, run the full test suite:

```bash
pnpm test
```

All tests must pass with **zero warnings** before moving to the next phase. If tests fail, fix them before proceeding. Also run lint:

```bash
pnpm lint
```

If there are any warnings please fix them. The project should have **zero warnings***.

### 3. Ask When Uncertain

If something in the design is ambiguous, has multiple valid implementations, or doesn't match the current codebase, **stop and ask the user**. Don't guess. Common cases:

- The design references a class/API that doesn't exist yet
- Two approaches seem equally valid and the design doesn't specify
- The design conflicts with existing code patterns
- A phase seems too large or has hidden dependencies

### 4. Update the Design Doc as You Go

After completing each phase:

1. **Status table** — mark the phase as `Done` in the status table at the top
2. **Checkboxes** — check off `[x]` completed items within the phase
3. **Notes** — if you deviated from the design, add a brief note explaining why

### 5. Summarize at the End

When all phases are complete, provide a summary covering:

- What was implemented (package names, key classes, features)
- Any deviations from the design and why
- How to test manually (see below)

## Manual Testing with `/debug-game`

For anything with visual output (games, demos, UI), **use the `/debug-game` skill as the primary testing method**. It launches the game in a browser via Playwright, connects to the engine's debug bridge (`window.__quintusDebug`), and gives you full runtime inspection and control.

### Connecting

```
/debug-game                        # Invoke the skill
quintus-debug connect              # Opens browser with ?debug, game starts paused at frame 0
quintus-debug connect platformer   # Connect to a specific example (matches examples/<name>/)
```

The game always starts paused in debug mode. You control when frames advance.

### Core Inspection Loop

The typical debug workflow is: **connect → tree → step → inspect → repeat**.

```bash
quintus-debug tree                 # ASCII scene tree showing all nodes
quintus-debug layout               # Spatial overview: all nodes sorted by position + physics info
quintus-debug inspect Player       # Detail for a single node (by name or numeric ID)
quintus-debug physics Player       # Physics state: position, velocity, gravity, contacts, group
quintus-debug status               # Current frame number, elapsed time, paused state
```

### Stepping and Input Simulation

```bash
quintus-debug step                 # Advance 1 frame
quintus-debug step 60              # Advance 60 frames (~1 second at 60fps)
quintus-debug press right          # Hold the "right" input action
quintus-debug step 30              # Advance while held
quintus-debug release right        # Let go
quintus-debug tap jump 1           # Press jump for 1 frame then release (shorthand for press+step+release)
quintus-debug release-all          # Release all held inputs
quintus-debug actions              # List all registered input actions
```

### Event and Signal Inspection

```bash
quintus-debug events               # Drain all debug events (signals, physics contacts, errors)
quintus-debug events --category=physics    # Filter to physics events only
quintus-debug events --search=coin         # Search event messages
quintus-debug peek                 # View events without draining them
quintus-debug clear-events         # Reset the event log
```

### Physics Debugging

```bash
quintus-debug physics Player       # Full physics snapshot: pos, vel, gravity, onFloor, contacts
quintus-debug track Player 60      # Step 60 frames, output tabular pos/vel/flags per frame
quintus-debug jump-analysis Player # Press jump, track full arc, report: height, apex, air time
```

Key physics formulas to verify against:
```
Jump height = |jumpForce|² / (2 × gravity)
Air time    = 2 × |jumpForce| / gravity × 60 frames
Horiz reach = speed × air_time_seconds
```

### UI and Click Testing

```bash
quintus-debug click 160 120                # Dispatch pointer click at game-space coords (x, y)
quintus-debug click-button "Start Game"    # Find and click a button by name or text label
```

### Screenshots

```bash
quintus-debug screenshot                   # Capture current canvas state
quintus-debug screenshot /tmp/test.png     # Save to specific path
```

### Scripted Sequences

For complex multi-step test sequences, use the `run` command with a JSON action script:

```bash
quintus-debug run '[{"press":"right","frames":30},{"wait":10},{"press":"jump","frames":1}]'
```

### Disconnecting

```bash
quintus-debug disconnect           # Close browser session
```

### When to Use `/debug-game`

Use it **after every phase that produces visual output or changes game behavior**:

1. **After implementing game entities** — verify they appear in the scene tree with correct properties
2. **After physics changes** — step frames and check positions, velocities, and collision contacts
3. **After input wiring** — simulate button presses and verify the player/entities respond
4. **After tilemap/camera work** — inspect layout, check camera follow, verify tile collisions
5. **After UI work** — click buttons, check labels update, verify HUD positioning
6. **After audio hookups** — check events fire (audio won't play in headless but signals should emit)

This is more reliable than eyeballing `pnpm dev` in a browser because you get deterministic frame-by-frame control and structured data output.

## Code Conventions

Follow the patterns in `CLAUDE.md`. Key reminders:

- Tests alongside source: `src/foo.ts` → `src/foo.test.ts`
- Biome formatting: tabs, double quotes, semicolons, 100-char lines
- `strict: true`, no `any`, `verbatimModuleSyntax: true`
- All packages export from `src/index.ts`
- Plugin pattern: WeakMap + `getXxx()` accessor + module augmentation
- Signals for events, not callbacks

## Common Pitfalls

- **Don't forget `game.stop()`** in tests that call `game.start()` — lingering rAF loops cause stderr warnings
- **Don't import from `old/`** — it's reference only
- **Don't add deps between packages** unless the design specifies it — use DI patterns (like `TileMap.registerPhysics()`) to avoid coupling
- **Run `pnpm build` before `pnpm test`** if you've changed package exports — tests resolve against built output for cross-package imports
