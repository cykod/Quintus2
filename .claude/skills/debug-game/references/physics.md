# Physics Debugging Reference

## The `move()` Algorithm

Each frame when `actor.move(dt)` is called:

1. **Apply gravity** (if `applyGravity` is true):
   ```
   velocity.y += gravity * dt
   ```
2. **Compute motion vector**:
   ```
   motion = velocity * dt
   ```
3. **Shape cast** along motion vector for collisions
4. **On collision**:
   - Separate actor from collider
   - Compute slide direction (motion projected along collision surface)
   - Repeat with remaining motion, up to `maxSlides` (default 4) iterations
5. **Update contact flags** from collision normals:
   - Floor: normal angle vs `upDirection` < `floorMaxAngle` (default 45°)
   - Ceiling: opposite of floor direction
   - Wall: everything else
6. **Zero velocity** into collision surfaces (e.g., hitting floor zeros `velocity.y` if positive)
7. **Moving platform carry**: if standing on a collider with `constantVelocity`, add its velocity

## Key Formulas

### Jump Height
```
height = |jumpForce|² / (2 × gravity)
```

Example: jumpForce=-350, gravity=800 → height = 350²/(2×800) = 76.56 px

### Air Time (total frames)
```
air_frames = 2 × |jumpForce| / gravity × 60
```

Example: 2 × 350 / 800 × 60 = 52.5 frames

### Horizontal Reach
```
reach = horizontal_speed × air_time_seconds
air_time_seconds = air_frames / 60
```

Example: speed=150, air_time=52.5/60=0.875s → reach = 150 × 0.875 = 131.25 px

### Terminal Velocity
There is no built-in terminal velocity. Gravity accumulates indefinitely. If you need clamping, do it in `onFixedUpdate`:
```typescript
if (this.velocity.y > maxFallSpeed) this.velocity.y = maxFallSpeed;
```

## Contact Flag Semantics

| Flag | Meaning | Check |
|------|---------|-------|
| `isOnFloor` | Standing on a surface | Normal within `floorMaxAngle` of `upDirection` |
| `isOnWall` | Touching a wall | Normal perpendicular to `upDirection` |
| `isOnCeiling` | Hitting ceiling | Normal opposite to `upDirection` |

Flags are updated **only** during `move()`. They reflect the state from the most recent move call.

### Floor Normal
`getFloorNormal()` returns the surface normal of the floor. For flat ground this is `(0, -1)`. For slopes, it's the perpendicular to the surface.

### Wall Normal
`getWallNormal()` returns the surface normal of the wall contact. `(-1, 0)` means touching a wall to the right, `(1, 0)` means to the left.

## Collision Groups

Actors and colliders have a `collisionGroup` string (e.g., "player", "world", "coins"). The physics plugin determines which groups collide with which via the collision matrix.

In the platformer demo:
- `player` collides with `world` and `coins`
- `world` and `coins` don't collide with each other

## Common Physics Debugging Scenarios

### Actor falls through platform
1. Check velocity: `quintus-debug physics Player` — large `Vy` values can tunnel
2. Check platform thickness: thin platforms (<1px effective) are easy to miss
3. Check collision groups: actor's group must be configured to collide with platform's group
4. Check shape: `quintus-debug inspect Floor` — verify shape dimensions

### Jump doesn't trigger
1. Check floor contact: `quintus-debug physics Player` — `OnFloor` must be `true`
2. Check input: `quintus-debug actions` — verify jump action exists
3. Step-and-check: `quintus-debug tap jump 1` then `quintus-debug physics Player` — check if Vy changed

### Actor slides off platform
1. Check `floorMaxAngle` — slopes steeper than this cause sliding
2. Check platform collision shape — misaligned shapes cause angled contacts
3. Use `track` to watch the slide: `quintus-debug track Player 60`

### Ceiling collision when jumping
1. **Cause:** Jumping from directly under a platform hits its underside, zeroing upward velocity
2. Check events: `quintus-debug events --category=physics --search=ceiling` — look for `ceiling_contact entered`
3. **Fix:** Position the actor beside the platform edge (outside its x-range + actor half-width), jump straight up, then drift sideways over the platform edge once above it
4. Use `quintus-debug nearby Player 150` to see what platforms are overhead before jumping

### Sensor not detecting overlap
1. Sensors only detect, they don't block. Verify the sensor's collision group is set to interact with the target.
2. Check position: `quintus-debug physics CoinSensor` vs `quintus-debug physics Player`
3. Check shapes overlap: compare positions and shape dimensions

## Platform Geometry

Positions are **center-based**. A platform at `(200, 280)` with a rect shape `400×20`:
- Left edge: `200 - 400/2 = 0`
- Right edge: `200 + 400/2 = 400`
- Top edge: `280 - 20/2 = 270`
- Bottom edge: `280 + 20/2 = 290`

An actor standing on this platform will have its center position at:
```
y = platform_top - actor_height/2
y = 270 - 24/2 = 258
```
