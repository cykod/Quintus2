# qdbg Command Reference

All commands use the format: `qdbg <command> [args] [flags]`

---

## Connection

### `connect [demo]`
Start dev server (if needed), open browser with `?debug`, verify bridge.

```bash
pnpm qdbg connect                    # default: platformer-demo
pnpm qdbg connect platformer-demo    # explicit demo name
```

The demo name maps to `http://localhost:3050/<demo>.html?debug`.

### `disconnect`
Close the browser session.

```bash
pnpm qdbg disconnect
```

---

## Inspection

### `status`
Show current frame number, elapsed time, and paused state.

```bash
pnpm qdbg status
# Frame: 42  Elapsed: 0.700s  Paused: true
```

### `tree`
Formatted ASCII scene tree using the engine's `formatTree()`. Shows type, name, position, velocity, floor state, and tags.

```bash
pnpm qdbg tree
# Scene "Level1"
# ├── Actor "Player" (200, 100) vel=(0,-50) [player]
# ├── StaticCollider "Floor" (200, 280)
# └── Sensor "Coin" (150, 200) [coin]
```

### `layout`
Spatial overview — all nodes with positions, sorted by depth. Includes velocity, contact flags, collision group, and shape info.

```bash
pnpm qdbg layout
# Actor "Player"  pos=(200.0,100.0)  vel=(0.0,-50.0)  [floor]  group=player  shape={"type":"rect","width":14,"height":24}
# StaticCollider "Floor"  pos=(200.0,280.0)  group=world  shape={"type":"rect","width":400,"height":20}
```

### `inspect <name|id>`
Full JSON snapshot of a single node. Accepts node name (string) or node ID (number).

```bash
pnpm qdbg inspect Player
pnpm qdbg inspect 5
```

Returns the full `NodeSnapshot` / `Node2DSnapshot` / `ActorSnapshot` as formatted JSON.

### `query <q>`
Find nodes by type name, node name, or tag. Returns a compact list.

```bash
pnpm qdbg query Actor           # by constructor type
pnpm qdbg query player          # by tag
pnpm qdbg query Coin            # by name
```

### `physics <name>`
Physics-focused summary for a single node: position, global position, velocity, gravity, floor/wall/ceiling flags, collision group, shape, tags.

```bash
pnpm qdbg physics Player
# Node: Actor "Player"
# Position: (200.00, 100.00)
# Global:   (200.00, 100.00)
# Velocity: (0.00, -50.00)
# Gravity:  800
# OnFloor:  false
# OnWall:   false
# OnCeil:   false
# Group:    player
# Tags:     player
```

---

## Scene

### `scenes`
List all registered scene names.

```bash
pnpm qdbg scenes
# Registered scenes:
#   - title
#   - level1
#   - level2
#   - game-over
```

### `scene <name>`
Switch to a registered scene by name. Destroys the current scene and loads the new one, stepping one frame to initialize.

```bash
pnpm qdbg scene level1      # switch to level1
pnpm qdbg scene title       # go back to title screen
```

---

## Simulation Control

### `step [N]`
Advance N physics frames (default: 1). Reports new frame number and elapsed time.

```bash
pnpm qdbg step          # step 1 frame
pnpm qdbg step 60       # step 60 frames (1 second at 60fps)
```

### `pause`
Pause the game loop (prevents real-time updates if `resume` was called).

```bash
pnpm qdbg pause
```

### `resume`
Resume real-time game loop execution.

```bash
pnpm qdbg resume
```

---

## Input

### `actions`
List all registered input actions.

```bash
pnpm qdbg actions
# Available actions:
#   - move_left
#   - move_right
#   - jump
```

### `press <action>`
Press and hold an input action. Stays held until `release` or `release-all`.

```bash
pnpm qdbg press move_right
```

### `release <action>`
Release a held input action.

```bash
pnpm qdbg release move_right
```

### `release-all`
Release all currently held actions.

```bash
pnpm qdbg release-all
```

### `tap <action> [frames]`
Press an action, step N frames, then release. Shorthand for press + step + release.

```bash
pnpm qdbg tap jump 1       # single-frame jump input
pnpm qdbg tap move_right 30 # hold right for 30 frames
```

### `click <x> <y>`
Dispatch a pointer click at game-space coordinates (x, y). Finds the topmost interactive UI node at that position and triggers its pointer down/up handlers.

```bash
pnpm qdbg click 160 186    # click at game coordinates (160, 186)
```

### `click-button <name|text>`
Find a UI button by its node name or text label and click it programmatically. Much more reliable than coordinate-based clicking.

```bash
pnpm qdbg click-button Start     # click button with text "Start"
pnpm qdbg click-button PlayBtn   # click button with name "PlayBtn"
pnpm qdbg click-button "Retry"   # click button with text "Retry"
```

---

## Movement

### `move-to <node> <actions> <x> <y> [--max=N]`
Hold one or more input actions until the node crosses the specified x and/or y threshold, then release all held actions. Use `"-"` for x or y to ignore that axis. Multiple actions can be comma-separated.

The threshold direction is inferred from the node's starting position: if the target x is greater than the current x, it waits for `position.x >= target`; if less, it waits for `position.x <= target`. Same logic for y.

**Flags:**
- `--max=<N>` — maximum frames before giving up (default: 600)

```bash
# Walk Player right to x=250
pnpm qdbg move-to Player move_right 250 -

# Walk Player left to x=50
pnpm qdbg move-to Player move_left 50 -

# Jump then drift right to x=100 (two-step — jump uses isJustPressed)
pnpm qdbg tap jump 1
pnpm qdbg move-to Player move_right 100 -

# Limit to 120 frames max
pnpm qdbg move-to Player move_right 300 - --max=120
```

**Note on `jump`:** Actions that use `isJustPressed` (like `jump`) only fire on the first frame. Since `move-to` holds actions continuously, the jump triggers once but then the button stays "already pressed" and won't re-trigger. For jump + drift, use `tap jump 1` first, then `move-to` with the movement action.

Output includes final position, velocity, floor state, and frame number:
```
Reached (250.00, 258.00) in 40 frames. vel=(150.00, 0.00) [floor]  Frame: 85
```

If the threshold isn't reached within the max frames:
```
Stopped at (180.00, 258.00) after 600 frames (limit). vel=(150.00, 0.00) [floor]  Frame: 645
```

### `nearby <name> [radius]`
Show all nodes within a given radius of the target node (default: 100px). Results sorted by distance, with delta vector, collision group, shape, and body type.

```bash
pnpm qdbg nearby Player
pnpm qdbg nearby Player 200
```

Example output:
```
Nearby Player (100.0,202.0) within 100px:
  Coin  pos=(100.0,200.0)  dist=2.0  delta=(0.0,-2.0)  group=coins  shape=circle r=8  tags=
  DrawableStatic  pos=(100.0,220.0)  dist=18.0  delta=(0.0,18.0)  group=world  shape=rect 80x12  [static]
```

---

## Scripting

### `eval '<code>'`
Evaluate a JavaScript expression in the browser and print the result. Has access to `d` (the debug bridge) and `game` (the Game instance) as shorthands.

```bash
pnpm qdbg eval 'd.frame'                    # current frame number
pnpm qdbg eval 'game.currentScene.name'      # current scene name
pnpm qdbg eval 'd.listScenes()'              # array of registered scenes
pnpm qdbg eval 'document.title'              # any DOM expression
```

Objects and arrays are returned as formatted JSON. Primitives are returned as strings.

### `run '<json>'`
Execute a `DebugAction[]` script. Each action is one of:
- `{ "press": "<action>", "frames": N }` — press, step N, release
- `{ "wait": N }` — step N frames
- `{ "release": "<action>" }` — release, step 1

```bash
pnpm qdbg run '[{"press":"move_right","frames":30},{"press":"jump","frames":10},{"wait":20}]'
```

### `track <name> [frames]`
Step N frames (default: 30), printing a tabular view of position, velocity, and contact flags each frame.

```bash
pnpm qdbg track Player 20
# Frame  X         Y         Vx        Vy        Floor  Wall   Ceil
# ────────────────────────────────────────────────────────────────────────
#    43    200.00    99.78      0.00    -13.33  false  false  false
#    44    200.00    99.33      0.00    -26.67  false  false  false
#    ...
```

### `jump-analysis <name>`
Automated jump analysis: presses jump for 1 frame, tracks the full arc until landing, reports measured and theoretical metrics.

**Precondition:** The node must be `isOnFloor: true`.

```bash
pnpm qdbg jump-analysis Player
# === Jump Analysis: Player ===
# Start Y:       268.00
# Jump Vy:       -350.00
# Gravity:       800
#
# --- Measured ---
# Jump Height:   76.56 px
# Apex Frame:    +26 frames
# Air Time:      53 frames (0.883s)
# Landed:        yes (frame 95)
#
# --- Theoretical ---
# Height:        76.56 px
# Air Frames:    52.5
# Efficiency:    100.0%
```

---

## Events

### `events [flags]`
Drain events since last drain. Returns formatted output using `formatEvents()`.

**Flags:**
- `--category=<cat>` — filter by category (e.g., `physics`, `scene`, `test`)
- `--search=<text>` — case-insensitive substring match on message
- `--limit=<N>` — max number of events to return
- `--from=<frame>` — start frame (inclusive)
- `--to=<frame>` — end frame (inclusive)

```bash
pnpm qdbg events
pnpm qdbg events --category=physics
pnpm qdbg events --category=physics --limit=5
pnpm qdbg events --search=floor --from=10 --to=50
```

### `peek [flags]`
Same as `events` but does NOT advance the drain cursor. Safe to call repeatedly.

```bash
pnpm qdbg peek --category=physics
```

### `clear-events`
Clear the event log and reset the drain cursor.

```bash
pnpm qdbg clear-events
```

---

## Capture

### `screenshot [file]`
Save the game canvas as a PNG file.

```bash
pnpm qdbg screenshot                         # default: /tmp/quintus-screenshot.png
pnpm qdbg screenshot /tmp/my-screenshot.png
```
