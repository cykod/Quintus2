# Debugging Recipes

Step-by-step recipes for common debugging tasks.

---

## Recipe: Debug Player Falling Through Floor

**Symptom:** Player passes through a platform instead of landing on it.

```bash
# 1. Connect and check initial state
pnpm qdbg connect platformer-demo
pnpm qdbg physics Player

# 2. Check the platform exists and has correct geometry
pnpm qdbg query StaticCollider
pnpm qdbg inspect Floor

# 3. Watch the player approach the floor frame-by-frame
pnpm qdbg track Player 60

# 4. Look for velocity spikes or missing floor flags
# If Vy is very large (>500), tunneling is likely
# If Floor never becomes true, check collision groups

# 5. Check physics events for collision details
pnpm qdbg events --category=physics
```

**Common causes:**
- Collision groups not configured to interact
- Platform shape too thin relative to velocity
- Missing collision shape on player or platform

---

## Recipe: Test Platform Reachability

**Goal:** Determine if a player can jump from one platform to reach another.

```bash
# 1. Survey the area — find platforms and their shapes
pnpm qdbg nearby Player 200

# 2. Get player physics parameters
pnpm qdbg physics Player
# Note: jumpForce (from Vy after jump), gravity, speed

# 3. Calculate theoretical reach
# height = |jumpForce|² / (2 × gravity)
# air_time_frames = 2 × |jumpForce| / gravity × 60
# horiz_reach = speed × air_time_frames / 60

# 4. Or test it empirically:
# Position beside the target platform (NOT under it — ceiling collision!)
# Platform edge = center_x ± width/2, then add player_half_width margin
pnpm qdbg move-to Player move_right 145 -

# 5. Jump and drift toward target
pnpm qdbg tap jump 1
pnpm qdbg step 10
pnpm qdbg move-to Player move_left 100 -
pnpm qdbg step 20

# 6. Check if we made it
pnpm qdbg physics Player
```

**Important:** Always position beside a platform before jumping, never directly underneath — jumping from below hits the platform's underside (ceiling collision), canceling your upward velocity.

---

## Recipe: Simulate Full Input Sequence

**Goal:** Run a scripted input sequence and see the result.

```bash
# Walk right for 30 frames, jump, continue right for 20 frames, wait to land
pnpm qdbg run '[
  {"press":"move_right","frames":30},
  {"press":"jump","frames":1},
  {"press":"move_right","frames":20},
  {"wait":30}
]'

# Check final state
pnpm qdbg physics Player
pnpm qdbg tree
```

---

## Recipe: Find and Collect Items

**Goal:** Navigate to a sensor (coin/pickup) and verify collection.

```bash
# 1. Find all sensors and check surroundings
pnpm qdbg query Sensor
pnpm qdbg nearby Player 200

# 2. If coin is on the same level (same Y), just walk to it
pnpm qdbg move-to Player move_right 250 -

# 3. If coin is above (on a platform), use the platform-reaching workflow:
#    a. Position beside the platform (clear of its X range)
pnpm qdbg move-to Player move_left 45 -
#    b. Jump and arc over the platform edge
pnpm qdbg tap jump 1
pnpm qdbg step 11
pnpm qdbg move-to Player move_right 100 -
pnpm qdbg step 20

# 4. Check if collected (sensor should be destroyed)
pnpm qdbg query Sensor
# Coin should be gone from the list

# 5. Verify via events
pnpm qdbg events --search=bodyEntered
```

---

## Recipe: Debug Sensor Overlap Detection

**Symptom:** Walking through a sensor doesn't trigger it.

```bash
# 1. Check sensor exists and has a shape
pnpm qdbg inspect TriggerZone
pnpm qdbg nearby Player 200

# 2. Check collision groups — sensor must interact with actor
# Review the group assignments in inspect output

# 3. Move actor into sensor range
pnpm qdbg move-to Player move_right 250 -

# 4. Check events for sensor overlap
pnpm qdbg events --category=physics --search=bodyEntered

# 5. If no event, verify positions actually overlap
pnpm qdbg physics Player
pnpm qdbg physics TriggerZone
# Compare positions + shape dimensions to confirm geometric overlap
```

---

## Recipe: Full Jump Arc Analysis

**Goal:** Get complete metrics on a jump.

```bash
# 1. Make sure player is on the floor
pnpm qdbg physics Player
# Must show OnFloor: true

# 2. Clear events to get clean data
pnpm qdbg clear-events

# 3. Run automated analysis
pnpm qdbg jump-analysis Player

# 4. Review physics events during the jump
pnpm qdbg events --category=physics
```

---

## Recipe: Run Scripted Test Sequence

**Goal:** Reproduce a bug with a specific input sequence.

```bash
# 1. Connect fresh
pnpm qdbg connect platformer-demo

# 2. Clear initial events
pnpm qdbg clear-events

# 3. Run the reproduction script
pnpm qdbg run '[
  {"wait":10},
  {"press":"move_right","frames":60},
  {"press":"jump","frames":1},
  {"wait":10},
  {"press":"move_left","frames":20},
  {"wait":30}
]'

# 4. Capture state
pnpm qdbg physics Player
pnpm qdbg tree
pnpm qdbg screenshot /tmp/bug-repro.png

# 5. Review all events
pnpm qdbg peek --category=physics
```

---

## Recipe: Compare Before/After State

**Goal:** See how a sequence of frames changes the game state.

```bash
# 1. Capture "before"
pnpm qdbg tree > /tmp/before-tree.txt
pnpm qdbg physics Player

# 2. Run some simulation
pnpm qdbg step 120

# 3. Capture "after"
pnpm qdbg tree > /tmp/after-tree.txt
pnpm qdbg physics Player

# 4. Diff the trees
diff /tmp/before-tree.txt /tmp/after-tree.txt
```
