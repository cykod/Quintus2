# Phase 2: Test Coverage Gaps

Comprehensive breakdown of test coverage gaps across all implemented packages (`@quintus/math`, `@quintus/core`, `@quintus/physics`). Each subphase is a self-contained unit of work that can be addressed independently.

**Current state:** 554 tests, 24 test files, 90.51% overall line coverage.

---

## Subphase T1: Physics Integration Tests (collision-object + physics-plugin)

**Priority: P0** | **Estimated tests: 20-25** | **Coverage impact: HIGH**

These two files are the most critical gap. `collision-object.ts` is at 48% coverage and `physics-plugin.ts` is at 0%. Together they form the integration layer between physics bodies and the world — bugs here are invisible without dedicated tests.

### T1a: PhysicsPlugin factory and wiring (`physics-plugin.ts` — 0% → 90%+)

Create `physics-plugin.test.ts`:

- **Plugin creation with defaults** — `PhysicsPlugin()` creates a world with gravity `Vec2(0, 800)` and default collision groups
- **Custom gravity** — `PhysicsPlugin({ gravity: new Vec2(0, 400) })` applies correctly
- **Custom cell size** — `PhysicsPlugin({ cellSize: 128 })` passes through to PhysicsWorld
- **Custom collision groups** — groups config propagates to CollisionGroups
- **`getPhysicsWorld()`** — returns the world after plugin install, null before
- **Double-install** — installing PhysicsPlugin twice warns but doesn't crash (inherits from `definePlugin`)
- **`postFixedUpdate` hook** — `world.stepSensors()` is called each fixed update frame
- **WeakMap isolation** — two separate Game instances get independent PhysicsWorlds

### T1b: CollisionObject lifecycle and registration (`collision-object.ts` — 48% → 90%+)

Create `collision-object.test.ts`:

- **`getShapes()`** — returns enabled CollisionShape children, excludes disabled ones
- **`getShapes()` with no shapes** — returns empty array
- **`getShapeTransforms()`** — returns shape + world transform pairs
- **`getWorldAABB()`** — computes merged AABB across all shapes
- **`getWorldAABB()` with no shapes** — returns null
- **`getWorldAABB()` with multiple shapes** — merges correctly
- **Auto-registration on `onReady()`** — body registers in PhysicsWorld when added to tree
- **Auto-unregistration on `onExitTree()`** — body unregisters when removed
- **Auto-install of PhysicsPlugin** — if no plugin installed, `_registerInWorld()` auto-installs with defaults and warns
- **`_registerPhysicsAccessors()`** — module-level wiring works correctly
- **`collisionGroup` default** — defaults to `"default"`
- **`_monitoring` default** — returns false on base CollisionObject
- **`_onBodyEntered` / `_onBodyExited`** — no-op on base class (tests confirm no throw)

### Dependencies
- None (can be done first)

### Test strategy
Create concrete subclasses (e.g., `class TestActor extends CollisionObject { bodyType = "actor" as const; }`) since CollisionObject is abstract. Tests need a Game + Scene setup with PhysicsPlugin installed.

---

## Subphase T2: Canvas2DRenderer Draw Methods

**Priority: P1** | **Estimated tests: 12-15** | **Coverage impact: MEDIUM**

`canvas2d-renderer.ts` is at 44.62%. The existing 8 tests cover the render pipeline (visibility, z-sorting, render list caching) well, but the `Canvas2DDrawContext` drawing primitives are completely untested.

### T2a: Canvas2DDrawContext primitives

Add to `canvas2d-renderer.test.ts`:

- **`line()`** — calls ctx.beginPath/moveTo/lineTo/stroke with correct coordinates
- **`line()` with custom style** — applies color and width
- **`rect()` with fill** — calls fillRect with fill color
- **`rect()` with stroke** — calls strokeRect with stroke color and width
- **`rect()` with fill + stroke** — applies both
- **`circle()` with fill** — calls arc + fill
- **`circle()` with stroke** — calls arc + stroke
- **`polygon()`** — calls moveTo + lineTo for each point, closePath
- **`polygon()` with < 2 points** — early return, no draw calls
- **`text()`** — sets font, fillStyle, textAlign, textBaseline, calls fillText
- **`measureText()`** — returns Vec2 with measured width and font size height
- **`image()` basic** — calls drawImage with position
- **`image()` with sourceRect** — calls 9-arg drawImage
- **`image()` with flipH** — applies negative x-scale transform
- **`image()` with flipV** — applies negative y-scale transform
- **`image()` with flipH + flipV** — combined flip
- **`image()` with unknown asset** — early return, no drawImage call
- **`save()` / `restore()`** — delegates to ctx
- **`setAlpha()`** — sets ctx.globalAlpha

### T2b: Render pipeline edge cases

- **`render()` applies globalTransform via setTransform** — verify ctx.setTransform receives Matrix2D components
- **`render()` error in onDraw** — exception is caught, other nodes still render
- **Empty scene render** — clears canvas, no errors

### Test strategy
Spy on `CanvasRenderingContext2D` methods using `vi.spyOn()` or create a mock context. The jsdom environment provides a canvas element but the context methods are mostly stubs — verify they were called with expected arguments.

### Dependencies
- None (independent of T1)

---

## Subphase T3: GameLoop RAF Tick

**Priority: P1** | **Estimated tests: 8-10** | **Coverage impact: MEDIUM**

`game-loop.ts` is at 67.3%. The `step()` method is well-tested, but the RAF-based `tick()` method (lines 61-82) is completely uncovered. This is the real-time game loop that runs in browsers.

### Tests to add

Add to `game-loop.test.ts`:

- **`start()` sets running to true** — verify `loop.running === true` after start
- **`start()` while running is a no-op** — calling start twice doesn't double-schedule
- **`stop()` sets running to false** — verify running flag
- **`stop()` cancels RAF** — no further ticks after stop
- **`tick()` calls fixedUpdate correct number of times** — simulate 2x fixedDt elapsed, expect 2 fixedUpdate calls
- **`tick()` accumulator clamping** — simulate huge dt (> maxAccumulator), verify capped
- **`tick()` frameDt → update** — update receives clamped frameDt, not raw
- **`tick()` schedules next frame** — after tick, RAF is requested again
- **`tick()` does nothing if stopped mid-frame** — stop during callback, no further processing

### Test strategy
Use `vi.useFakeTimers()` and manually fire `requestAnimationFrame` callbacks. Alternatively, test `tick()` as a public method by temporarily making it accessible or by driving it through start/stop with fake timers. The jsdom environment provides `requestAnimationFrame`.

### Dependencies
- None (independent of T1 and T2)

---

## Subphase T4: Core Edge Cases (game.ts, node2d.ts, asset-loader.ts)

**Priority: P2** | **Estimated tests: 12-15** | **Coverage impact: LOW-MEDIUM**

These files are already at 87-89% coverage. The gaps are specific edge-case paths.

### T4a: Game.ts gaps (87.79% → 95%+)

Lines 172-173, 214-215 and general gaps:

- **`pause()` and `resume()`** — verify loop stops and restarts
- **`start()` with SceneDefinition object** — `game.start({ name: "inline", setup: fn })` registers and loads
- **`_switchScene()` with inline setup** — passing a setup function to switchTo registers it
- **`_switchScene()` destroys old scene** — `_destroyAll()` called on previous scene
- **Canvas resolution via string selector** — `canvas: "#my-canvas"` finds existing element
- **Canvas auto-created** — when no canvas option, creates and appends to body
- **`backgroundColor`** — defaults and custom values

### T4b: Node2D.ts gaps (89.62% → 95%+)

Lines 113-114, 140-143:

- **`lookAt()`** — sets rotation toward target point
- **`moveToward()`** — moves position toward target at speed * dt
- **`_markGlobalTransformDirty()` early return** — when already dirty, doesn't recurse (line 137)
- **Deep nesting dirty propagation** — 3+ levels of Node2D, changing grandparent marks all descendants dirty

### T4c: AssetLoader.ts gaps (89.04% → 95%+)

Lines 68-74, 93-94:

- **`retry()`** — retries a failed asset, re-adds to loaded map on success
- **`retry()` with image extension** — detects image type from extension
- **`retry()` with JSON extension** — detects JSON type from extension
- **`allLoaded`** — returns true when no failures, false when failures exist
- **Network error (fetch throws)** — handles non-response errors (e.g., network down)

### Dependencies
- None (independent of T1-T3)

---

## Subphase T5: Math Micro-Gaps

**Priority: P3** | **Estimated tests: 5-8** | **Coverage impact: LOW**

The math package is at 97.84% — nearly complete. These are very minor gaps.

### Tests to add

- **`Vec2._set()`** — bulk set with no change does not fire `_onChange`
- **`Vec2._set()`** — bulk set with change fires `_onChange` exactly once
- **`Color.fromHex()` with 4-char hex** — `#RGBA` format (lines 83-84)
- **`SeededRandom` edge case** — line 93, likely a boundary condition
- **`Matrix2D` uncovered branches** — lines 104, 120, 126 (short-circuit optimizations in multiply/invert)

### Dependencies
- None (independent of all other subphases)

---

## Subphase T6: Physics World & SAT Micro-Gaps

**Priority: P3** | **Estimated tests: 5-8** | **Coverage impact: LOW**

These files are already at 97%+ but have a few specific uncovered paths.

### Tests to add

- **`PhysicsWorld` general TOI path** — lines 345-352: the binary-search TOI fallback (non-AABB-vs-AABB case). Create a polygon-vs-polygon swept collision that doesn't hit the AABB fast path
- **`SAT` closest-point edge cases** — lines 393, 395-397: segment-vs-segment closest point clamping when `t < 0` or `t > 1`
- **`SAT` AABB sweep already-overlapping** — line 696: tEntry < 0 path in `sweepAABBvsAABB()`
- **`SpatialHash` boundary conditions** — lines 171-172: edge cases in query bounds

### Dependencies
- None (independent of all other subphases)

---

## Execution Order

Recommended order optimizes for risk reduction:

```
T1 (P0) → T2 (P1) → T3 (P1) → T4 (P2) → T5/T6 (P3, parallel)
```

T1 should be done first as it covers the most critical integration gap. T2 and T3 are independent and can be done in either order or in parallel. T4-T6 are polish.

## Expected Final Coverage

| Package | Current | After T1-T6 |
|---------|---------|-------------|
| `@quintus/math` | 97.84% | ~99% |
| `@quintus/core` | 81.74% | ~93% |
| `@quintus/physics` | 92.89% | ~97% |
| **Overall** | **90.51%** | **~96%** |

Note: `canvas2d-renderer.ts` will remain below 100% due to the difficulty of fully testing Canvas2D API interactions in jsdom, but the critical render pipeline logic will be covered.
