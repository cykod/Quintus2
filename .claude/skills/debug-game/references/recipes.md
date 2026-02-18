# Debugging Recipes

Step-by-step recipes for common debugging tasks.

---

## Recipe: Debug Player Falling Through Floor

**Symptom:** Player passes through a platform instead of landing on it.

```bash
# 1. Connect and check initial state
qdbg connect platformer-demo
qdbg physics Player

# 2. Check the platform exists and has correct geometry
qdbg query StaticCollider
qdbg inspect Floor

# 3. Watch the player approach the floor frame-by-frame
qdbg track Player 60

# 4. Look for velocity spikes or missing floor flags
# If Vy is very large (>500), tunneling is likely
# If Floor never becomes true, check collision groups

# 5. Check physics events for collision details
qdbg events --category=physics
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
qdbg nearby Player 200

# 2. Get player physics parameters
qdbg physics Player
# Note: jumpForce (from Vy after jump), gravity, speed

# 3. Calculate theoretical reach
# height = |jumpForce|² / (2 × gravity)
# air_time_frames = 2 × |jumpForce| / gravity × 60
# horiz_reach = speed × air_time_frames / 60

# 4. Or test it empirically:
# Position beside the target platform (NOT under it — ceiling collision!)
# Platform edge = center_x ± width/2, then add player_half_width margin
qdbg move-to Player move_right 145 -

# 5. Jump and drift toward target
qdbg tap jump 1
qdbg step 10
qdbg move-to Player move_left 100 -
qdbg step 20

# 6. Check if we made it
qdbg physics Player
```

**Important:** Always position beside a platform before jumping, never directly underneath — jumping from below hits the platform's underside (ceiling collision), canceling your upward velocity.

---

## Recipe: Simulate Full Input Sequence

**Goal:** Run a scripted input sequence and see the result.

```bash
# Walk right for 30 frames, jump, continue right for 20 frames, wait to land
qdbg run '[
  {"press":"move_right","frames":30},
  {"press":"jump","frames":1},
  {"press":"move_right","frames":20},
  {"wait":30}
]'

# Check final state
qdbg physics Player
qdbg tree
```

---

## Recipe: Find and Collect Items

**Goal:** Navigate to a sensor (coin/pickup) and verify collection.

```bash
# 1. Find all sensors and check surroundings
qdbg query Sensor
qdbg nearby Player 200

# 2. If coin is on the same level (same Y), just walk to it
qdbg move-to Player move_right 250 -

# 3. If coin is above (on a platform), use the platform-reaching workflow:
#    a. Position beside the platform (clear of its X range)
qdbg move-to Player move_left 45 -
#    b. Jump and arc over the platform edge
qdbg tap jump 1
qdbg step 11
qdbg move-to Player move_right 100 -
qdbg step 20

# 4. Check if collected (sensor should be destroyed)
qdbg query Sensor
# Coin should be gone from the list

# 5. Verify via events
qdbg events --search=bodyEntered
```

---

## Recipe: Debug Sensor Overlap Detection

**Symptom:** Walking through a sensor doesn't trigger it.

```bash
# 1. Check sensor exists and has a shape
qdbg inspect TriggerZone
qdbg nearby Player 200

# 2. Check collision groups — sensor must interact with actor
# Review the group assignments in inspect output

# 3. Move actor into sensor range
qdbg move-to Player move_right 250 -

# 4. Check events for sensor overlap
qdbg events --category=physics --search=bodyEntered

# 5. If no event, verify positions actually overlap
qdbg physics Player
qdbg physics TriggerZone
# Compare positions + shape dimensions to confirm geometric overlap
```

---

## Recipe: Full Jump Arc Analysis

**Goal:** Get complete metrics on a jump.

```bash
# 1. Make sure player is on the floor
qdbg physics Player
# Must show OnFloor: true

# 2. Clear events to get clean data
qdbg clear-events

# 3. Run automated analysis
qdbg jump-analysis Player

# 4. Review physics events during the jump
qdbg events --category=physics
```

---

## Recipe: Run Scripted Test Sequence

**Goal:** Reproduce a bug with a specific input sequence.

```bash
# 1. Connect fresh
qdbg connect platformer-demo

# 2. Clear initial events
qdbg clear-events

# 3. Run the reproduction script
qdbg run '[
  {"wait":10},
  {"press":"move_right","frames":60},
  {"press":"jump","frames":1},
  {"wait":10},
  {"press":"move_left","frames":20},
  {"wait":30}
]'

# 4. Capture state
qdbg physics Player
qdbg tree
qdbg screenshot /tmp/bug-repro.png

# 5. Review all events
qdbg peek --category=physics
```

---

## Recipe: Compare Before/After State

**Goal:** See how a sequence of frames changes the game state.

```bash
# 1. Capture "before"
qdbg tree > /tmp/before-tree.txt
qdbg physics Player

# 2. Run some simulation
qdbg step 120

# 3. Capture "after"
qdbg tree > /tmp/after-tree.txt
qdbg physics Player

# 4. Diff the trees
diff /tmp/before-tree.txt /tmp/after-tree.txt
```
