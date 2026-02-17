## Add pixel art sprites, spike hazard, and renderer pixelArt mode
*Tuesday, February 17th at 8am*
Replace all procedural onDraw rendering in the platformer with 
AnimatedSprite-based pixel art using the Kenney Pico-8 tileset. Add a shared 
SpriteSheet definition for all entities (player, enemies, coin, health, flag, 
spike), a new Spike hazard entity, heart-icon HUD replacing the health bar, and 
edge-detection patrol AI. On the engine side, add pixelArt mode to 
Canvas2DRenderer (disables image smoothing), fix flip rendering to always zero 
drawX/drawY after translate, and set camera zoom to 2x for the crispy pixel 
look.

---

## Add scene query API: raycast, area queries, shape cast, DDA tilemap raycast
*Monday, February 16th at 6pm*
Implement the complete Scene Query API across 5 phases as specified in 
QUERY_API.md. Adds raycast/raycastAll, 
queryPoint/queryRect/queryCircle/queryShape, and shapeCast to PhysicsWorld with 
composable QueryOptions filtering (tags, groups, sensors, exclude, custom 
predicate). Extracts findShapePairTOI to a standalone function for reuse. Adds 
Actor convenience methods (raycast, isEdgeAhead, hasLineOfSight, findNearest) 
for common gameplay patterns like patrol AI edge detection and line-of-sight 
checks. Implements DDA grid raycast on TileMap for fast tile-level 
line-of-sight queries. Includes 47 new tests across 4 test files, all passing 
with clean build and lint.

---

## Add complete platformer game and fix bidirectional onContact dispatch
*Monday, February 16th at 4pm*
Implements the Phase 6 complete platformer with title screen, two levels, 
enemies, coins, HUD, and game-over/victory scenes. Fixes three engine bugs 
discovered during gameplay testing: onContact callbacks now fire 
bidirectionally (when either body is the mover), the depenetration path in 
Actor.move() now emits onCollided signals for overlapping bodies, and patrol 
enemies use edge detection to stay on one-way platforms. Also adds 
click/clickButton commands to the debug bridge for UI testing.

---

## Fix stderr warnings in game error-handling tests
*Monday, February 16th at 2pm*
Added game.stop() calls to two error-handling tests in game.test.ts that were 
leaving the rAF loop running after assertions. The pending 
requestAnimationFrame callbacks would fire after the test completed (and after 
console.error spy was restored), producing spurious stderr output in the test 
runner. All 1196 tests continue to pass, now with zero warnings.

---

## Add quintus meta-package bundling all 10 engine packages
*Monday, February 16th at 1pm*
Create the quintus npm meta-package (Phase 6, Step 1) that re-exports all 10 
@quintus/* packages via a single entry point. The package uses sideEffects: 
true to ensure module augmentations (game.physics, game.input, game.audio, 
node.tween()) aren't tree-shaken. Includes 14 tests verifying all major classes 
are accessible and all augmentations work correctly. Zero export name conflicts 
across all packages. Gzipped barrel is 153 bytes; actual code bundled at 
consume-time from dependencies.

---

## Copy platformer to basic_platformer before Phase 6 rewrite
*Monday, February 16th at 1pm*
Copied the existing Phase 2 platformer example to examples/basic_platformer/ to 
preserve it as a simple reference demo before it gets replaced with a 
full-featured Phase 6 platformer. Updated the examples index page to link to 
the new basic_platformer path with an updated title. Also includes minor 
updates to PHASE_6_DESIGN.md steering doc and ASKS.md log entries.

---

## Add actor-to-actor collision, onOverlap/onContact APIs
*Monday, February 16th at 12pm*
Implement FIX_COLLISION_DESIGN.md for @quintus/physics: add solid property to 
Actor for actor-to-actor physical collision in castMotion(), replace 
onCollision() with onOverlap() (enter/exit callbacks, auto-monitoring) and add 
onContact() API for physics contact detection via collided signal. Rename 
internal _onBodyEntered/_onBodyExited to public virtual methods, fix Sensor 
signal bug where sensor-to-sensor overlaps swallowed bodyEntered, and fix 
monitoring toggle stale overlap cleanup. All 382 tests pass across 14 test 
files with comprehensive new coverage for solid actors, virtual methods, 
overlap/contact APIs, and edge cases.

---

## Refactor examples into subdirectories with landing page
*Monday, February 16th at 10am*
Moved each demo (bouncing-balls, platformer, tilemap, tween-ui) into its own 
subdirectory with a dedicated index.html and main.ts. The root index.html is 
now a styled landing page with cards linking to each demo. Assets moved into 
the tilemap subdirectory. Old flat HTML files removed. All routes verified 
serving 200.

---

## Add tween, audio, and UI packages (Phase 5)
*Sunday, February 15th at 6pm*
Implement Phase 5 of the engine rewrite: three new packages (@quintus/tween, 
@quintus/audio, @quintus/ui) plus core changes. Tween adds a builder-pattern 
animation system with 16 easing functions, sequential/parallel groups, repeat, 
and Node.tween() augmentation. Audio provides Web Audio API integration with 
bus routing (music/sfx/ui), autoplay gate, and AudioPlayer node. UI adds 
screen-fixed widgets (Label, Button, ProgressBar, Panel, Container, Layer) with 
pointer dispatch for hit testing. Core gains postUpdate signal, 
Node2D.alpha/renderFixed, and AssetLoader.registerLoader for custom asset 
types. Includes a Phase 5 demo showcasing interactive tweened animations with 
UI controls. All 1143 tests pass across 62 files.

---

## Add tilemap and camera packages (Phase 4)
*Sunday, February 15th at 3pm*
Implement Phase 4 of the Quintus 2.0 engine rewrite: @quintus/tilemap for Tiled 
JSON map loading with greedy-merge tile collision generation and 
viewport-culled rendering, and @quintus/camera for smooth follow, bounds 
clamping, dead zones, zoom, pixel-perfect mode, deterministic shake, and 
coordinate conversion. Core changes include Scene.viewTransform for camera 
rendering, markRenderDirty propagation, and CameraSnapshot serialization with 
informative debug tree output. Adds a scrolling platformer demo (tilemap-demo) 
with Player, Coins, TileMap, and Camera. All 999 tests pass across 49 test 
files.

---

## Add move-to and nearby commands to debug-game skill
*Sunday, February 15th at 1pm*
Adds two new commands to the quintus-debug CLI based on lessons from a live 
platformer debugging session. move-to holds input actions until a node crosses 
an x/y threshold, replacing the repetitive press/step/release cycle (reducing 
coin collection from ~15 commands to 4). nearby shows nodes within a radius 
with distance, delta, shape, and group info for spatial awareness. Also 
documents the ceiling collision trap (jumping under platforms), the 
isJustPressed caveat with move-to, and updates all recipes to use the new 
commands.

---

## Add node IDs and shape info to debug tree output
*Sunday, February 15th at 1pm*
Enhance the debug tree formatter to include node IDs as [id] prefixes on every 
line and collision shape details (type, dimensions) in angle brackets. 
CollisionShape now serializes its shape data via a new CollisionShapeSnapshot 
type with shapeType, shapeDesc, and disabled fields. The tree output changes 
from CollisionShape (0, 0) to [3] CollisionShape (0, 0) <rect 16x32>, making 
the debug view immediately useful for understanding scene geometry.

---

## Add /debug-game skill with quintus-debug CLI wrapper
*Sunday, February 15th at 1pm*
Add the /debug-game Claude Code skill for ergonomic runtime debugging of 
Quintus games. The core engine change exposes formatTree and formatEvents on 
window.__quintusFormatters so the CLI can use the engine's own pretty-printers 
from the browser context. The quintus-debug bash wrapper provides 24 commands 
(connect, tree, layout, physics, step, tap, track, jump-analysis, events, etc.) 
that wrap playwright-cli session calls into one-liners. Includes SKILL.md with 
methodology and decision tree, plus reference docs for the full API, physics 
debugging formulas, and step-by-step recipes. Also fixes a null-safety issue in 
the platformer demo's input access and applies biome formatting cleanups to 
tests.

---

## Add AI debug protocol with serialization and instrumentation
*Sunday, February 15th at 12pm*
Implement the AI Debug Protocol infrastructure: node serialization (Node, 
Node2D, Actor, StaticCollider, Sensor snapshots), a ring-buffer DebugLog for 
structured events, a window.__quintusDebug bridge for 
pause/resume/step/inspect/inject/screenshot, and auto-instrumentation hooks 
throughout the engine (lifecycle events, collisions, contact flag changes, 
sensor overlaps, scene transitions, errors). Game gains a debug option with URL 
param detection (?debug, ?seed=N, ?step=N) for deterministic AI-driven testing. 
Also refines the Phase 4 design doc with markRenderDirty fix for dynamic scene 
changes, physics as optional peer dependency for tilemap, Camera inverse 
transform caching, destroyed-target polling, and InputPlugin integration in the 
demo.

---

## Add sprites and input packages (Phase 3)
*Sunday, February 15th at 11am*
Implement Phase 3 of the Quintus 2.0 rewrite: @quintus/sprites (SpriteSheet, 
Sprite, AnimatedSprite with frame-based animation) and @quintus/input 
(action-map input system with keyboard bindings, 
isPressed/isJustPressed/isJustReleased queries, InputEvent propagation through 
the scene tree, InputReceiver interface, and deterministic input injection via 
inject()/injectAnalog()). Adds preFrame signal to core Game for input polling 
before fixedUpdate. Updates the platformer demo to use the new input system 
instead of raw keyboard listeners. Also adds Phase 3, Phase 4, and AI Debug 
design documents, and updates the implementation plan to replace the MCP server 
approach with a lighter Playwright-based debug CLI.

---

## Close test coverage gaps across core, math, and physics
*Sunday, February 15th at 8am*
Added 120 new tests across 13 test files to close branch coverage gaps 
identified by a systematic coverage audit. Overall branch coverage improved 
from 94.79% to 97.19%. Key improvements include full 100% branch coverage for 
actor.ts, sensor.ts, collision-groups.ts, contact-point.ts, node2d.ts, 
utils.ts, and static-collider.ts. Tests cover edge cases like null-return paths 
in tree queries, error handling in onFixedUpdate, physics operations without a 
world attached, sweptAABB near-zero motion branches, and Color.fromHSL hue 
conversion branches.

---

## Fix physics registration, jump, rendering and add platformer demo
*Sunday, February 15th at 7am*
Fix four critical physics engine bugs and add the Phase 2.5 platformer demo 
with integration tests. CollisionShape now notifies its parent CollisionObject 
via _onShapeChanged() when the shape property is set, fixing the root cause 
where bodies registered in the spatial hash before their shapes existed. 
Actor.move() no longer clobbers jump velocity with floor snap gravity when 
velocity.y is negative. Scene._processDestroyQueue() now returns a boolean so 
Game can mark the render list dirty, fixing ghost nodes that persisted after 
destroy(). The platformer demo includes a player with gravity/jumping, three 
collectible coins with bobbing animation, stair-stepped platforms, and walls.

---

## Refactor scenes from callbacks to class-based API
*Saturday, February 14th at 9pm*
Replaced the callback-based scene registration pattern (game.scene("name", fn) 
/ game.start("name")) with a class-based approach (class Level extends Scene { 
onReady() {} } / game.start(Level)). This eliminates the _scenes map, 
SceneSetupFn, SceneDefinition, and defineScene() in favor of a single 
SceneConstructor type, making scenes consistent with the rest of the engine's 
inheritance model. All 713 tests across 14 modified files pass, including 
converted helpers in core and physics packages.

---

## Add Actor, StaticCollider, and Sensor physics bodies (Phase 2.4)
*Saturday, February 14th at 9pm*
Implement Phase 2 Subphase 4: the three concrete physics body types. Actor 
provides the core move() slide loop with gravity, floor/wall/ceiling detection, 
safe margin depenetration, velocity zeroing, collided signal, and moving 
platform carry. StaticCollider adds constantVelocity for moving platforms and 
oneWay/oneWayDirection for jump-through platforms. Sensor provides 
bodyEntered/bodyExited/sensorEntered/sensorExited signals with monitoring 
toggle and overlap queries. PhysicsWorld.castMotion gains bodyOffset for 
batched displacement, actor-vs-actor filtering, and one-way normal alignment 
filtering. 54 new tests (719 total), all passing.

---

## Add physics world & SAT micro-gap tests (T6)
*Saturday, February 14th at 8pm*
Added 11 tests covering uncovered edge-case paths in physics-world.ts, sat.ts, 
and spatial-hash.ts as part of Phase 2 test gap subphase T6. Tests exercise the 
general binary-search TOI path for non-rect shapes (circles, polygons), 
closestPointsSegments endpoint clamping for capsule-vs-capsule collisions (t<0, 
t>1, degenerate segments), sweptAABB Y-axis normal selection for 
already-overlapping rects, rectVsCircle Y-axis fallback, and queryPairs reverse 
ID ordering in the spatial hash. All three files now have 100% line coverage, 
bringing the total to 665 passing tests.

---

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
