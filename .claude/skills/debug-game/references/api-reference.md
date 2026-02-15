# quintus-debug Command Reference

All commands use the format: `quintus-debug <command> [args] [flags]`

---

## Connection

### `connect [demo]`
Start dev server (if needed), open browser with `?debug`, verify bridge.

```bash
quintus-debug connect                    # default: platformer-demo
quintus-debug connect platformer-demo    # explicit demo name
```

The demo name maps to `http://localhost:3050/<demo>.html?debug`.

### `disconnect`
Close the browser session.

```bash
quintus-debug disconnect
```

---

## Inspection

### `status`
Show current frame number, elapsed time, and paused state.

```bash
quintus-debug status
# Frame: 42  Elapsed: 0.700s  Paused: true
```

### `tree`
Formatted ASCII scene tree using the engine's `formatTree()`. Shows type, name, position, velocity, floor state, and tags.

```bash
quintus-debug tree
# Scene "Level1"
# ├── Actor "Player" (200, 100) vel=(0,-50) [player]
# ├── StaticCollider "Floor" (200, 280)
# └── Sensor "Coin" (150, 200) [coin]
```

### `layout`
Spatial overview — all nodes with positions, sorted by depth. Includes velocity, contact flags, collision group, and shape info.

```bash
quintus-debug layout
# Actor "Player"  pos=(200.0,100.0)  vel=(0.0,-50.0)  [floor]  group=player  shape={"type":"rect","width":14,"height":24}
# StaticCollider "Floor"  pos=(200.0,280.0)  group=world  shape={"type":"rect","width":400,"height":20}
```

### `inspect <name|id>`
Full JSON snapshot of a single node. Accepts node name (string) or node ID (number).

```bash
quintus-debug inspect Player
quintus-debug inspect 5
```

Returns the full `NodeSnapshot` / `Node2DSnapshot` / `ActorSnapshot` as formatted JSON.

### `query <q>`
Find nodes by type name, node name, or tag. Returns a compact list.

```bash
quintus-debug query Actor           # by constructor type
quintus-debug query player          # by tag
quintus-debug query Coin            # by name
```

### `physics <name>`
Physics-focused summary for a single node: position, global position, velocity, gravity, floor/wall/ceiling flags, collision group, shape, tags.

```bash
quintus-debug physics Player
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

## Simulation Control

### `step [N]`
Advance N physics frames (default: 1). Reports new frame number and elapsed time.

```bash
quintus-debug step          # step 1 frame
quintus-debug step 60       # step 60 frames (1 second at 60fps)
```

### `pause`
Pause the game loop (prevents real-time updates if `resume` was called).

```bash
quintus-debug pause
```

### `resume`
Resume real-time game loop execution.

```bash
quintus-debug resume
```

---

## Input

### `actions`
List all registered input actions.

```bash
quintus-debug actions
# Available actions:
#   - move_left
#   - move_right
#   - jump
```

### `press <action>`
Press and hold an input action. Stays held until `release` or `release-all`.

```bash
quintus-debug press move_right
```

### `release <action>`
Release a held input action.

```bash
quintus-debug release move_right
```

### `release-all`
Release all currently held actions.

```bash
quintus-debug release-all
```

### `tap <action> [frames]`
Press an action, step N frames, then release. Shorthand for press + step + release.

```bash
quintus-debug tap jump 1       # single-frame jump input
quintus-debug tap move_right 30 # hold right for 30 frames
```

---

## Scripting

### `run '<json>'`
Execute a `DebugAction[]` script. Each action is one of:
- `{ "press": "<action>", "frames": N }` — press, step N, release
- `{ "wait": N }` — step N frames
- `{ "release": "<action>" }` — release, step 1

```bash
quintus-debug run '[{"press":"move_right","frames":30},{"press":"jump","frames":10},{"wait":20}]'
```

### `track <name> [frames]`
Step N frames (default: 30), printing a tabular view of position, velocity, and contact flags each frame.

```bash
quintus-debug track Player 20
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
quintus-debug jump-analysis Player
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
quintus-debug events
quintus-debug events --category=physics
quintus-debug events --category=physics --limit=5
quintus-debug events --search=floor --from=10 --to=50
```

### `peek [flags]`
Same as `events` but does NOT advance the drain cursor. Safe to call repeatedly.

```bash
quintus-debug peek --category=physics
```

### `clear-events`
Clear the event log and reset the drain cursor.

```bash
quintus-debug clear-events
```

---

## Capture

### `screenshot [file]`
Save the game canvas as a PNG file.

```bash
quintus-debug screenshot                         # default: /tmp/quintus-screenshot.png
quintus-debug screenshot /tmp/my-screenshot.png
```
