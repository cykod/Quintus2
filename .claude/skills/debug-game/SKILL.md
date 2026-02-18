---
name: debug-game
description: Debug a running Quintus game — inspect scene tree, step frames, simulate input, analyze physics, and view events. Use when the user wants to debug, test, or understand the runtime behavior of a Quintus game demo.
allowed-tools: Bash(qdbg:*),Bash(playwright-cli:*)
---

# Quintus Game Debugger

Debug running Quintus games through the `qdbg` CLI wrapper, which provides ergonomic access to the engine's debug bridge (`window.__quintusDebug`).

## Quick Start

```bash
# 1. Connect to the running demo (starts dev server if needed)
pnpm qdbg connect platformer-demo

# 2. See the scene tree
pnpm qdbg tree

# 3. Step a few frames and inspect
pnpm qdbg step 10
pnpm qdbg physics Player

# 4. Test input
pnpm qdbg tap jump 1
pnpm qdbg step 30
pnpm qdbg physics Player

# 5. View events
pnpm qdbg events --category=physics

# 6. Done
pnpm qdbg disconnect
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

**Want to move a node to a position?**
- Walk right to x=250 → `move-to Player move_right 250 -`
- Walk left to x=50 → `move-to Player move_left 50 -`
- Jump then drift right → `tap jump 1` then `move-to Player move_right 100 -`
- See what's around the player → `nearby Player 150`

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
7. **`jump` uses `isJustPressed`.** Do NOT use `move-to` with `jump` as a sustained action — it only fires on the first frame. Instead: `tap jump 1` to initiate the jump, then `move-to` with the movement action to drift.
8. **Ceiling collision trap.** Jumping from directly under a platform will hit its underside and kill your upward velocity. Use `nearby` to check for platforms above, and position to the **side** of the platform before jumping so you can arc over its edge.

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

## Reaching a Platform (Tested Workflow)

To land on a platform from below (e.g., reaching a platform at (100, 220) rect 80x12):

```bash
# 1. Check surroundings — understand what's above you
pnpm qdbg nearby Player 150

# 2. Position BESIDE the platform, not under it (platform x range = 60–140)
#    Clear edge = platform_edge - player_half_width - margin
pnpm qdbg move-to Player move_left 45 -

# 3. Jump straight up from the clear position
pnpm qdbg tap jump 1

# 4. Wait a few frames to rise above the platform top (y < 202 for a 214-top platform)
pnpm qdbg step 11

# 5. Drift sideways over the platform
pnpm qdbg move-to Player move_right 110 -

# 6. Let gravity land you — step a few frames
pnpm qdbg step 20

# 7. Verify
pnpm qdbg physics Player
```

**Key insight:** You must jump from beside the platform and arc over its edge. Jumping from directly underneath hits the platform's underside (ceiling collision), killing your vertical velocity.

## Common Pitfalls

- **"Node not found"** — Node names are case-sensitive. Use `tree` to see exact names.
- **Player falls through** — Check `physics Player` for velocity spikes. Large velocities can tunnel through thin platforms.
- **Jump doesn't work** — Must be `isOnFloor: true`. Check with `physics Player` before tapping jump.
- **Ceiling collision on jump** — Jumping from directly under a platform hits its underside. Use `nearby` to check for obstacles, then position beside the platform edge before jumping.
- **`move-to` with jump does nothing** — `jump` uses `isJustPressed`, which only fires once. Use `tap jump 1` first, then `move-to` for the drift.
- **Events empty** — Events drain on read. If you already called `events`, subsequent calls only show new events. Use `peek` to re-read, or `clear-events` then reproduce.
- **Positions look wrong** — Remember positions are center-based. A platform at y=280 with height 20 has its top edge at y=270.

## Reference Documentation

- **Full command reference:** [references/api-reference.md](references/api-reference.md)
- **Physics methodology:** [references/physics.md](references/physics.md)
- **Step-by-step recipes:** [references/recipes.md](references/recipes.md)
