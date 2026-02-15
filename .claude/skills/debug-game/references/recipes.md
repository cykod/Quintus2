# Debugging Recipes

Step-by-step recipes for common debugging tasks.

---

## Recipe: Debug Player Falling Through Floor

**Symptom:** Player passes through a platform instead of landing on it.

```bash
# 1. Connect and check initial state
quintus-debug connect platformer-demo
quintus-debug physics Player

# 2. Check the platform exists and has correct geometry
quintus-debug query StaticCollider
quintus-debug inspect Floor

# 3. Watch the player approach the floor frame-by-frame
quintus-debug track Player 60

# 4. Look for velocity spikes or missing floor flags
# If Vy is very large (>500), tunneling is likely
# If Floor never becomes true, check collision groups

# 5. Check physics events for collision details
quintus-debug events --category=physics
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
quintus-debug nearby Player 200

# 2. Get player physics parameters
quintus-debug physics Player
# Note: jumpForce (from Vy after jump), gravity, speed

# 3. Calculate theoretical reach
# height = |jumpForce|² / (2 × gravity)
# air_time_frames = 2 × |jumpForce| / gravity × 60
# horiz_reach = speed × air_time_frames / 60

# 4. Or test it empirically:
# Position beside the target platform (NOT under it — ceiling collision!)
# Platform edge = center_x ± width/2, then add player_half_width margin
quintus-debug move-to Player move_right 145 -

# 5. Jump and drift toward target
quintus-debug tap jump 1
quintus-debug step 10
quintus-debug move-to Player move_left 100 -
quintus-debug step 20

# 6. Check if we made it
quintus-debug physics Player
```

**Important:** Always position beside a platform before jumping, never directly underneath — jumping from below hits the platform's underside (ceiling collision), canceling your upward velocity.

---

## Recipe: Simulate Full Input Sequence

**Goal:** Run a scripted input sequence and see the result.

```bash
# Walk right for 30 frames, jump, continue right for 20 frames, wait to land
quintus-debug run '[
  {"press":"move_right","frames":30},
  {"press":"jump","frames":1},
  {"press":"move_right","frames":20},
  {"wait":30}
]'

# Check final state
quintus-debug physics Player
quintus-debug tree
```

---

## Recipe: Find and Collect Items

**Goal:** Navigate to a sensor (coin/pickup) and verify collection.

```bash
# 1. Find all sensors and check surroundings
quintus-debug query Sensor
quintus-debug nearby Player 200

# 2. If coin is on the same level (same Y), just walk to it
quintus-debug move-to Player move_right 250 -

# 3. If coin is above (on a platform), use the platform-reaching workflow:
#    a. Position beside the platform (clear of its X range)
quintus-debug move-to Player move_left 45 -
#    b. Jump and arc over the platform edge
quintus-debug tap jump 1
quintus-debug step 11
quintus-debug move-to Player move_right 100 -
quintus-debug step 20

# 4. Check if collected (sensor should be destroyed)
quintus-debug query Sensor
# Coin should be gone from the list

# 5. Verify via events
quintus-debug events --search=bodyEntered
```

---

## Recipe: Debug Sensor Overlap Detection

**Symptom:** Walking through a sensor doesn't trigger it.

```bash
# 1. Check sensor exists and has a shape
quintus-debug inspect TriggerZone
quintus-debug nearby Player 200

# 2. Check collision groups — sensor must interact with actor
# Review the group assignments in inspect output

# 3. Move actor into sensor range
quintus-debug move-to Player move_right 250 -

# 4. Check events for sensor overlap
quintus-debug events --category=physics --search=bodyEntered

# 5. If no event, verify positions actually overlap
quintus-debug physics Player
quintus-debug physics TriggerZone
# Compare positions + shape dimensions to confirm geometric overlap
```

---

## Recipe: Full Jump Arc Analysis

**Goal:** Get complete metrics on a jump.

```bash
# 1. Make sure player is on the floor
quintus-debug physics Player
# Must show OnFloor: true

# 2. Clear events to get clean data
quintus-debug clear-events

# 3. Run automated analysis
quintus-debug jump-analysis Player

# 4. Review physics events during the jump
quintus-debug events --category=physics
```

---

## Recipe: Run Scripted Test Sequence

**Goal:** Reproduce a bug with a specific input sequence.

```bash
# 1. Connect fresh
quintus-debug connect platformer-demo

# 2. Clear initial events
quintus-debug clear-events

# 3. Run the reproduction script
quintus-debug run '[
  {"wait":10},
  {"press":"move_right","frames":60},
  {"press":"jump","frames":1},
  {"wait":10},
  {"press":"move_left","frames":20},
  {"wait":30}
]'

# 4. Capture state
quintus-debug physics Player
quintus-debug tree
quintus-debug screenshot /tmp/bug-repro.png

# 5. Review all events
quintus-debug peek --category=physics
```

---

## Recipe: Compare Before/After State

**Goal:** See how a sequence of frames changes the game state.

```bash
# 1. Capture "before"
quintus-debug tree > /tmp/before-tree.txt
quintus-debug physics Player

# 2. Run some simulation
quintus-debug step 120

# 3. Capture "after"
quintus-debug tree > /tmp/after-tree.txt
quintus-debug physics Player

# 4. Diff the trees
diff /tmp/before-tree.txt /tmp/after-tree.txt
```
