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
# 1. Find the platforms
quintus-debug layout

# 2. Get player physics parameters
quintus-debug physics Player
# Note: jumpForce (from Vy after jump), gravity, speed

# 3. Calculate theoretical reach
# height = |jumpForce|² / (2 × gravity)
# air_time_frames = 2 × |jumpForce| / gravity × 60
# horiz_reach = speed × air_time_frames / 60

# 4. Or just test it empirically:
# Move player to starting platform edge
quintus-debug press move_right
quintus-debug step 30
quintus-debug release move_right
quintus-debug physics Player

# 5. Jump and move toward target
quintus-debug press jump
quintus-debug step 1
quintus-debug release jump
quintus-debug press move_right
quintus-debug step 40
quintus-debug release move_right

# 6. Check if we made it
quintus-debug physics Player
```

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
# 1. Find all sensors
quintus-debug query Sensor

# 2. Get positions of player and target
quintus-debug physics Player
quintus-debug inspect Coin1

# 3. Calculate direction (compare X positions)
# If coin is to the right, move right. Estimate frames:
# frames = |distance_x| / speed × 60

# 4. Move to the coin
quintus-debug press move_right
quintus-debug step 30
quintus-debug release move_right

# 5. Check if collected (sensor should be destroyed)
quintus-debug query Sensor
# Coin1 should be gone from the list

# 6. Check collection events
quintus-debug events --search=collect
```

---

## Recipe: Debug Sensor Overlap Detection

**Symptom:** Walking through a sensor doesn't trigger it.

```bash
# 1. Check sensor exists and has a shape
quintus-debug inspect TriggerZone
quintus-debug physics TriggerZone

# 2. Check collision groups — sensor must interact with actor
# Review the group assignments

# 3. Move actor into sensor range and step
quintus-debug press move_right
quintus-debug step 10
quintus-debug release move_right

# 4. Check events for sensor overlap
quintus-debug events --category=physics --search=sensor

# 5. Verify positions actually overlap
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
