---
name: debug-game
description: Debug a running Quintus game — inspect scene tree, step frames, simulate input, analyze physics, and view events. Use when the user wants to debug, test, or understand the runtime behavior of a Quintus game demo.
allowed-tools: Bash(quintus-debug:*),Bash(playwright-cli:*)
---

# Quintus Game Debugger

Debug running Quintus games through the `quintus-debug` CLI wrapper, which provides ergonomic access to the engine's debug bridge (`window.__quintusDebug`).

## Quick Start

```bash
# 1. Connect to the running demo (starts dev server if needed)
quintus-debug connect platformer-demo

# 2. See the scene tree
quintus-debug tree

# 3. Step a few frames and inspect
quintus-debug step 10
quintus-debug physics Player

# 4. Test input
quintus-debug tap jump 1
quintus-debug step 30
quintus-debug physics Player

# 5. View events
quintus-debug events --category=physics

# 6. Done
quintus-debug disconnect
```

## Core Mental Model

- **Debug mode starts paused.** The game renders one frame then stops. You must `step` to advance.
- **Everything is frame-based.** One `step` = one fixed timestep (1/60s). The simulation is deterministic.
- **Input is injected.** `press`/`release`/`tap` inject virtual input that the game processes on the next `step`.
- **Events drain by default.** `events` returns events since the last drain and advances the cursor. Use `peek` to view without draining.

## Command Decision Tree

**Want to see what's in the scene?**
- Overview of all nodes → `tree`
- Spatial layout with positions → `layout`
- Find specific node types → `query Actor` or `query player` (tag)
- Full detail on one node → `inspect Player`

**Want to understand physics?**
- Current state → `physics Player`
- Watch motion over time → `track Player 60`
- Analyze a jump → `jump-analysis Player`
- See collision events → `events --category=physics`

**Want to test input?**
- What actions exist? → `actions`
- Quick press-and-release → `tap jump 1`
- Hold while stepping → `press right` then `step 30` then `release right`
- Complex sequence → `run '[{"press":"right","frames":30},{"press":"jump","frames":10},{"wait":20}]'`

**Want to control time?**
- Advance frames → `step 10`
- Pause real-time → `pause`
- Resume real-time → `resume`

## Important Constraints

1. **Always connect first.** Every command except `connect` requires an active browser session with the debug bridge.
2. **`?debug` is required.** The URL must include `?debug` for the bridge to install. `connect` does this automatically.
3. **Positions are center-based.** Node2D positions represent the center of the node, not top-left corner.
4. **Sensors don't block.** Sensors detect overlap but don't participate in collision response. Only Actor↔StaticCollider and Actor↔Actor collide physically.
5. **One-way platforms** use collision normals — actors only collide when approaching from the "up" side.
6. **Input buffering.** After `press`, the action stays held until you explicitly `release` or `release-all`. Forgetting to release causes the input to persist across steps.

## Physics Quick Reference

The `move()` algorithm each frame:
1. Apply gravity: `velocity.y += gravity * dt`
2. Compute motion: `motion = velocity * dt`
3. Cast collision shape along motion vector
4. On collision: separate, slide along surface, repeat up to `maxSlides` times
5. Update floor/wall/ceiling flags from contact normals
6. Zero velocity component into collision surface

Key formulas:
```
Jump height = |jumpForce|² / (2 × gravity)
Air time     = 2 × |jumpForce| / gravity × 60  (in frames)
Horiz reach  = speed × air_time_seconds
```

## Common Pitfalls

- **"Node not found"** — Node names are case-sensitive. Use `tree` to see exact names.
- **Player falls through** — Check `physics Player` for velocity spikes. Large velocities can tunnel through thin platforms.
- **Jump doesn't work** — Must be `isOnFloor: true`. Check with `physics Player` before tapping jump.
- **Events empty** — Events drain on read. If you already called `events`, subsequent calls only show new events. Use `peek` to re-read, or `clear-events` then reproduce.
- **Positions look wrong** — Remember positions are center-based. A platform at y=280 with height 20 has its top edge at y=270.

## Reference Documentation

- **Full command reference:** [references/api-reference.md](references/api-reference.md)
- **Physics methodology:** [references/physics.md](references/physics.md)
- **Step-by-step recipes:** [references/recipes.md](references/recipes.md)
