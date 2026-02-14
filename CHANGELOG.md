## Add math micro-gap tests for Vec2, Color, Matrix2D (T5)
*Saturday, February 14th at 4pm*
Implements Phase 2 test gap subphase T5 with 7 new tests covering math package 
micro-gaps: Vec2._set() onChange behavior (fire once on change, skip when 
unchanged), Color.fromHex() 4-char #RGBA format, SeededRandom.weighted() edge 
case, and Matrix2D negative determinant handling in decompose()/getScale() plus 
singular matrix inverse fallback. Coverage improved: vec2.ts 96% → 100%, 
matrix2d.ts branches 90% → 100%, color.ts line 83-84 now covered. Only 
seeded-random.ts line 93 remains uncovered (unreachable defensive fallback).

---

## Add core edge case tests for game, node2d, and asset-loader (T4)
*Saturday, February 14th at 4pm*
Implements Phase 2 test gap subphase T4 with 15 new tests covering previously 
uncovered edge cases in game.ts (pause/resume, SceneDefinition start, 
_switchScene with setup, canvas resolution paths, backgroundColor), node2d.ts 
(lookAt, moveToward with overshoot protection, _markGlobalTransformDirty early 
return, deep nesting dirty propagation), and asset-loader.ts (retry with 
image/JSON extensions, allLoaded getter, network error handling). Coverage 
improved: game.ts 87% → 100%, asset-loader.ts 89% → 100%, node2d.ts 89% → 98%.

---

## Add GameLoop RAF tick tests for 100% game-loop coverage (T3)
*Saturday, February 14th at 4pm*
Added 12 tests covering the GameLoop's RAF-based tick(), start(), and stop() 
methods, which were previously untested at 67% coverage. Tests mock 
requestAnimationFrame and performance.now to precisely control timestamps, 
verifying correct fixedUpdate call counts, accumulator clamping for 
spiral-of-death prevention, fixed-vs-variable update separation, RAF 
scheduling, and mid-frame stop behavior. This completes Phase 2 test gap 
subphase T3, bringing game-loop.ts from 67% to 100% line coverage.

---

## Add Canvas2DDrawContext and render pipeline tests (T2)
*Saturday, February 14th at 4pm*
Add 28 new tests covering the Canvas2DDrawContext drawing primitives (line, 
rect, circle, polygon, text, measureText, image with flip/sourceRect, 
save/restore, setAlpha) and render pipeline edge cases (globalTransform 
application, exception resilience, empty scene). Uses property setter spies to 
work around jsdom's color normalization behavior. Coverage for 
canvas2d-renderer.ts goes from 44.62% to 100% line coverage, bringing total 
tests to 613 across 26 files.

---

## Add physics integration tests for CollisionObject and PhysicsPlugin
*Saturday, February 14th at 4pm*
Implement T1 subphase from PHASE_2_TEST_GAPS.md: 31 new tests across two files 
covering PhysicsPlugin factory/wiring (defaults, custom config, WeakMap 
isolation, postFixedUpdate hook) and CollisionObject lifecycle (getShapes, 
getWorldAABB, auto-registration on tree enter, auto-unregistration on exit, 
auto-install with warning, full game loop sensor integration). Coverage for 
collision-object.ts goes from 48% to 100% and physics-plugin.ts from 0% to 
100%, bringing physics package statement coverage to 98%. Also adds the test 
gap analysis doc and refines the Phase 2 Subphase 4 design with depenetration, 
safe margin, batched displacement, and actor-vs-actor skip decisions.

---

## Implement Phase 2 Subphase 3 physics infrastructure
*Saturday, February 14th at 4pm*
Implement the physics infrastructure layer: CollisionShape node for defining 
collision geometry, CollisionObject abstract base class with auto-registration 
and shape queries, PhysicsWorld orchestrator with castMotion(), testOverlap(), 
and sensor overlap detection, PhysicsPlugin with WeakMap-based world storage 
and postFixedUpdate hook, and contact point computation via support point 
midpoint. Circular dependency between CollisionObject and PhysicsPlugin 
resolved via a registration pattern. Includes 55 new tests covering all 
modules. Updates collision-info.ts to use real CollisionObject/CollisionShape 
types instead of Node2D aliases.

---

## Dramatically increase SAT collision test coverage
*Saturday, February 14th at 2pm*
Add 57 new tests to SAT collision detection covering all previously untested 
shape pairs (Circle×Polygon, Capsule×Polygon), transform variations (rotation, 
scale, composed), swept collision for 7 additional shape combinations, argument 
order swap symmetry, and full containment scenarios. Test count grows from 46 
to 103, achieving 100% shape pair coverage for static tests and 90% for swept 
collision pairs. Includes new txrs helper for composed transforms and shared 
polygon shape constants.

---

## Implement Phase 2 Subphase 2 collision detection
*Saturday, February 14th at 2pm*
Add SpatialHash generic broad-phase with Cantor pairing and smart cell updates, 
SAT narrow-phase with fast paths for axis-aligned rect-vs-rect, 
circle-vs-circle, and rect-vs-circle, plus general SAT supporting rotated 
shapes, capsules, and convex polygons. Includes swept collision via analytical 
sweptAABB for rects and binary-search findTOI for arbitrary shape pairs. Normal 
convention is consistently A-toward-B across all code paths. 68 new tests (16 
spatial hash, 52 SAT/swept) all passing alongside existing 380 tests.

---

## Implement Phase 2 Subphase 1 foundation types for physics
*Friday, February 13th at 10pm*
Add Shape2D types (rect, circle, capsule, polygon) with Shape factory and 
transform-aware shapeAABB() computation including a fast path for 
translation-only transforms. Add CollisionInfo interface for collision response 
data and CollisionGroups class that compiles named string groups to bitmasks 
for O(1) shouldCollide() checks. Includes 34 new tests covering all shape 
types, AABB computation across identity/translate/rotate/scale/composed 
transforms, and collision group compilation with asymmetric collision and 
validation. Step 1 core changes (postFixedUpdate signal, props removal from 
addChild) were already completed in prior commits.

---

## Apply devil's advocate fixes to core, math, and Phase 2 design
*Friday, February 13th at 9pm*
Fix 14 issues from devil's advocate review of Phase 2 design. In code: fix 
Node.destroy() to queue for deferred processing via scene._queueDestroy(), 
remove the type-unsafe props parameter from addChild() and Scene.add() (delete 
applyNodeProps/applyNode2DProps), add postFixedUpdate signal to Game that fires 
after each fixed step, and fix Matrix2D.isTranslationOnly() to use 
epsilon-based comparison instead of exact equality. Updates tests, examples, 
CLAUDE.md, and Phase 2 steering docs (shapeAABB rewritten with zero-allocation 
inline math, SAT helper functions for pool temporaries, collision direction 
documented as unidirectional).

---

## Add Vec2._set() to reduce redundant dirty notifications
*Friday, February 13th at 4pm*
Add a bulk _set(x, y) method to Vec2 that writes both components and fires the 
_onChange callback at most once. Node2D's position, scale, and globalPosition 
setters now use _set() instead of writing x/y individually through setters, 
which previously triggered _markTransformDirty() up to three times per 
assignment (once per component via _onChange, plus once explicitly). This 
reduces dirty-propagation overhead from 3x to 1x per vector assignment.

---

## Extract Renderer interface and make Game renderer pluggable
*Friday, February 13th at 3pm*
Extract a Renderer interface from Canvas2DRenderer and make the Game class 
accept pluggable renderers via GameOptions. This enables headless mode 
(renderer: null), custom renderers, and runtime renderer swapping via 
_setRenderer() for future plugins like ThreePlugin. Also moves onDraw from Node 
to Node2D, making the base Node class dimension-agnostic with zero 
math/rendering imports — a key architectural invariant for future 3D support. 
Includes 6 new tests for renderer pluggability.

---

## Simplify Phase 1: remove Proxy, tinting, and boilerplate
*Friday, February 13th at 2pm*
Simplify Phase 1 core engine based on LLM-friendliness review. Replace 
Proxy-based Vec2 dirty flagging with getter/setter + _onChange callback. 
Simplify Signal emission to snapshot-only iteration, removing mid-emit 
disconnect tracking. Remove entire tint system (tint/selfTint/effectiveTint and 
offscreen canvas compositing) from Phase 1, deferring to a later phase. Drop 
third addChild overload (constructor args) keeping only instance and 
class+props variants. Replace hasVisualContent boolean flag with prototype 
comparison (node.onDraw !== baseOnDraw) for automatic render list inclusion.

---

## Implement Phase 1: math and core packages with design-aligned API
*Friday, February 13th at 2pm*
Implement the @quintus/math and @quintus/core packages for Phase 1 of the 
engine rewrite. Math package includes Vec2 (mutable with frozen static 
constants), Matrix2D, Color, Rect, AABB, SeededRandom, and Vec2Pool. Core 
package includes Node/Node2D scene tree, Signal system, Game/GameLoop, Scene 
management, Canvas2D renderer, asset loader, and plugin system. API follows the 
PHASE_1_DESIGN.md conventions: lifecycle methods use the on-prefix pattern 
(onReady, onUpdate, onDraw, onDestroy), PauseMode replaces ProcessMode with 
simplified inherit/independent values, modulate is renamed to tint, and Vec2 
position/scale on Node2D use Proxy-based dirty flagging for automatic transform 
invalidation. All 333 tests pass with clean builds.

---

## Phase 0: Bootstrap monorepo with 19 packages and tooling
*Friday, February 13th at 12pm*
Set up the Quintus 2.0 monorepo infrastructure from PHASE_0_DESIGN.md. 
Scaffolded 19 empty packages under packages/ with pnpm workspace, tsup builds 
(ESM + CJS + DTS), TypeScript strict mode, Vitest testing, Biome 
linting/formatting, Vite dev server for examples, and TypeDoc API generation. 
All commands pass: pnpm install, build, test, lint, and docs. Fixed several 
issues from the design doc including the correct tsconfig option name 
(forceConsistentCasingInFileNames), pnpm --if-present flag ordering, and Biome 
2.3.15 schema migration.

---
