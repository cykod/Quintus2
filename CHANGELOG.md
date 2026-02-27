## Add @quintus/touch package with canvas scaling and touch utilities
*Friday, February 27th at 12pm*
Create the @quintus/touch package (Phase 1 of Mobile UI design) with core touch 
infrastructure: canvas scale: fit letterboxing in Game, cross-browser 
fullscreen helpers with Safari fallback, scroll/zoom prevention via 
lockScroll(), touch device detection with dynamic input method switching, and a 
TouchPlugin using the WeakMap plugin pattern with scroll lock, 
fullscreen-on-first-touch, and scene switch hooks. Includes 31 new tests across 
5 test files and wires the package into the quintus meta-package.

---

## Polish tower defense with ai-prefabs integration
*Friday, February 27th at 12pm*
Integrate Damageable mixin on PathFollower (replacing hand-rolled damage/death 
system) and replace the custom WaveManager with the ai-prefabs WaveSpawner, 
deleting wave-manager.ts entirely. Wave definitions move to a data array in 
config.ts. Add 7 edge-case tests covering path blocking, slow stacking, wave 
transition exits, equidistant targeting, wave overlap prevention, zero-gold 
placement, and projectile self-destruct. Targeted code comments added at 
architectural decision points across 8 files. Phase G marked complete in 
PREFABS_PROPOSAL.md.

---

## Polish space shooter and top-down shooter with ai-prefabs integration
*Friday, February 27th at 11am*
Integrate the four core ai-prefabs utilities (Damageable, Bullet, WaveSpawner, 
Pickup) into both shooter example games per Phases D and F of the prefabs 
proposal. The space shooter replaces hand-rolled health/invincibility, separate 
bullet classes, and inline wave logic with the shared utilities, while the 
top-down shooter similarly consolidates its bullet hierarchy into a single 
ShooterBullet class and delegates wave orchestration to WaveSpawner. Both games 
gain dedicated edge-case test suites and design-decision comments at key 
architectural points, with a net reduction of 116 lines of code.

---

## Fix Bullet scene-tree error and sideways sprite rotation
*Friday, February 27th at 11am*
Fix two bugs in the ai-prefabs Bullet base class introduced during Phase D 
space shooter polish. The scene-tree error occurred because _checkOffScreen() 
accessed this.game after the bullet was recycled during move() collision -- 
fixed by adding an isInsideTree guard after move(). The sideways sprite bug 
occurred because fire() set this.rotation to the movement angle, visually 
rotating pre-oriented sprites -- fixed by storing the angle in a private _angle 
field separate from visual rotation.

---

## Polish Sokoban with 7 edge-case tests and code comments
*Friday, February 27th at 11am*
Add edge-case test file for the Sokoban example game covering corner deadlocks, 
push-on/push-off target transitions, undo at move zero, partial-solve 
detection, rapid sequential input registration, and level-select rendering with 
mixed completion state. Add architectural decision comments to grid.ts 
(class-level separation rationale, MoveRecord undo stack design, tryMove atomic 
return struct) and player-sprite.tsx (grid-to-pixel coordinate mapping for 
center-anchored sprites). All 46 Sokoban tests pass with zero lint warnings.

---

## Polish dungeon and breakout games with ai-prefabs integration
*Friday, February 27th at 1am*
Integrate ai-prefabs utilities into two example games as part of Phase 9 
polish. Dungeon (8B): refactor Player and BaseEnemy to use the Damageable 
mixin, replace PotionPickup's hand-rolled bob/collection with the Pickup base 
class, and add 7 edge-case tests plus architectural comments at 4 decision 
points. Breakout (8C): refactor PowerUp to extend Pickup with falling-pickup 
pattern (bobAmount=0, collectTag="paddle"), add paddle tagging, and add 7 
edge-case tests covering ball physics corner cases (brick seam hits, paddle 
edge angles, multi-ball life deduction, narrow gap resolution) plus 
design-decision comments on ball reflection math, attachment state machine, and 
power-up timer management. All 1824 engine tests and 32 breakout-specific tests 
pass.

---

## Polish platformer edge-case tests and add design-decision comments
*Friday, February 27th at 12am*
Expands Phase 8A platformer polish with a reusable TestArena test helper, five 
focused test files (player, enemies, pickups, edge-cases, flow) totaling 31 
passing tests, and inline comments explaining why specific entities do or don't 
use the Damageable/Pickup ai-prefabs utilities. Also fixes a subtle double-jump 
reset ordering bug where the floor check now runs before the jump input check 
so a grounded jump can re-enable double-jump in the same frame.

---

## Make TMX a built-in asset type in AssetLoader
*Friday, February 27th at 12am*
Added "tmx" as a first-class asset type in AssetLoader alongside images, json, 
and xml. The TMX loader fetches text identically to the xml handler, 
eliminating the need for manual registerLoader("tmx", ...) calls. Removed the 
duplicated 5-line TMX loader registration from all four example games that used 
it (platformer, platformer-tsx, dungeon, tower-defense). Updated one test that 
was using "tmx" as a custom type name to use "csv" instead, since TMX is now 
built-in.

---

## Integrate ai-prefabs into platformer and add 24 edge-case tests
*Thursday, February 26th at 11pm*
Refactors the platformer-tsx example to use @quintus/ai-prefabs utilities: 
Player now uses the Damageable mixin for health/invincibility management, and 
Coin extends Pickup for bob animation and collection. Adds 24 integration tests 
across 5 test files covering player movement, enemy behavior, pickups, level 
flow, and 7 edge cases from the PREFABS_PROPOSAL. Also fixes a double-jump bug 
where _canDoubleJump was immediately reset on the jump frame because the 
isOnFloor() check ran after the jump assignment but before move(). 
Architectural decision comments explain why PatrolEnemy, FlyingEnemy, and 
HealthPickup intentionally do not use the prefab utilities.

---

## Remove deprecated addChild method in favor of add
*Thursday, February 26th at 9pm*
Fully removed the deprecated addChild() method from Node, replacing all 334 
call sites across 43 files with the canonical add() method. The two methods 
were identical — both delegated to the private _addChildNode() implementation 
— so this is a pure cleanup with no behavioral change. Updated test names, 
comments, and source code across all packages and example games. All 1824 tests 
pass.

---

## Add core game utilities to @quintus/ai-prefabs
*Thursday, February 26th at 7pm*
Implement 4 focused utilities in @quintus/ai-prefabs that extract common 
cross-game patterns identified during Phase 9: Damageable (mixin for health, 
damage, invincibility, death effects), Bullet (headless poolable Actor with 
fire/lifetime/off-screen recycling), WaveSpawner (signal-driven wave system 
with configurable intervals and per-entry delays), and Pickup (Sensor with 
tag-filtered collection, bob animation, and pop effect). All utilities 
gracefully degrade without @quintus/tween installed. Ships with 50 tests across 
4 test files, zero lint warnings, and full .d.ts generation.

---

## Add TMX maps, sound effects, and visual polish to tower defense
*Thursday, February 26th at 7pm*
Converted tower defense from programmatic map rendering to Tiled TMX files, 
with path/placement data read directly from the map's path layer (tile 
18=start, 17=end, 15=road, 16=placement). Added 10 CC0 sound effects for tower 
firing, enemy death, wave start, placement, UI clicks, victory, and game over. 
Visual improvements include turret rotation toward targets, enemies facing 
their movement direction with a walking shimmy animation, projectile rotation, 
correct sprite frames for all tower types (arrow 203, cannon 249, slow 226, 
missile 251, slow projectile 274), projectile z-ordering under towers, and the 
slow tower using the round base matching other weapons.

---

## Add gamepad support and audio effects to Sokoban
*Thursday, February 26th at 3pm*
Add full gamepad support to the Sokoban game with D-pad and left stick for 
movement, B for undo, Y for reset, and Start for menu navigation. Add seven CC0 
sound effects covering all gameplay actions: step (player move), push (crate 
push), place (crate on target), win (level complete), undo, reset, and click 
(UI buttons). A new menu input action allows returning to level select via 
Escape or gamepad Start. The title scene now displays gamepad control 
instructions.

---

## Fix Sokoban visual bugs and replace unsolvable levels
*Thursday, February 26th at 3pm*
Fixed three bugs in the Sokoban example game: wrong tile frame indices in 
sprites.ts caused walls to render as blue crates and floors as player sprites 
(fixed by visually identifying correct frames in the Kenney tileset using qdbg 
overlays), a position offset bug where snapTo() overwrote the grid centering 
offset (fixed by parenting all game entities to a Node2D container), and 
unsolvable levels 3 and 5 confirmed via exhaustive BFS search (replaced with 
verified-solvable designs requiring 16 and 19 optimal moves respectively). All 
39 sokoban tests pass. Includes debugging documentation with screenshots and 
Claude Code skill definitions.

---

## Fix qdbg screenshot command: use Playwright native canvas capture
*Thursday, February 26th at 1pm*
The qdbg screenshot command was broken because it used require('fs') inside a 
Playwright run-code snippet, which runs in an ESM context where require is not 
defined. Replaced the manual base64-decode-and-write approach with Playwright's 
native page.locator('canvas').screenshot({ path }), which handles file I/O 
internally and is both simpler and more robust.

---

## Add Sokoban puzzle game with 39 tests
*Thursday, February 26th at 1pm*
Implement a classic Sokoban box-pushing puzzle as a Phase 9 example game. This 
is the only example that uses no physics engine — purely grid-based logic 
with Node2D, tweened movement, and a pure TypeScript SokobanGrid class for 
puzzle state. Features 5 levels of increasing difficulty, undo/reset, level 
select with completion tracking, and a reactive HUD. Includes 39 tests across 6 
files covering pure grid logic, movement, crate pushing, undo, level 
validation, and game flow determinism.

---

## Fix tower defense UI: click placement, visual buttons, enemy sprite
*Thursday, February 26th at 1am*
Fix three tower defense UI issues: mouse click placement was broken because the 
input binding used the invalid name "PointerButton1" instead of "mouse:left"; 
the tower selection bar was plain text labels with no icons or click support, 
now replaced with styled TowerSelectButton components showing turret sprites, 
costs, keyboard shortcuts, and gold selection borders with hover/press states; 
and the basic creep used wrong tileset frame 244 (a terrain tile) instead of 
the correct enemy sprite at frame 245. Also enables the tower defense card on 
the examples index page.

---

## Add tower defense example game with 29 tests
*Wednesday, February 25th at 11pm*
Implement the tower defense example game for Phase 9.5, featuring grid-based 
tower placement, waypoint path following, three enemy types (basic, fast, 
tank), three tower types (arrow, cannon with splash, slow), homing projectiles, 
a 5-wave manager with escalating difficulty, reactive HUD, and two levels with 
different path layouts. Includes 32 new files and 29 integration tests covering 
path following, enemy behavior, tower targeting, placement validation, wave 
progression, and deterministic replay. All 1774 tests pass with zero type 
errors.

---

## Make collisionGroup and solid forced-choice with clear errors
*Wednesday, February 25th at 10pm*
Changed CollisionObject.collisionGroup and Actor.solid defaults from 
"default"/false to null. PhysicsWorld.register() now throws actionable errors 
if either property is unset, preventing the common footgun where collision 
silently doesn't work. Updated the pool system's ClassDefaultsSnapshot to 
handle null types, added as-string casts in internal methods that operate on 
registered bodies, and updated all 13 test files and 5 example games to 
explicitly set both properties.

---

## Add SFX, animated explosions, and convex hitboxes to space shooter
*Wednesday, February 25th at 10pm*
Added 7 CC0 sound effects (player/enemy shoot, hit, die, boss die, powerup) and 
animated particle explosions to the space shooter example. Built a particle 
spritesheet (576x128, 9x2 grid) from Kenney smoke-particle PNGs using a sharp 
build script, with flash animations for non-lethal hits and size-matched 
explosions for kills. Replaced undersized rectangular collision shapes with 
convex polygons (pentagons for the player ship, hexagons for enemies, circle 
for the boss UFO) and widened bullet hitboxes to better match the visual 
sprites. Hit flashes are attached as children of the struck enemy so they track 
with movement, positioned at the bullet impact point via a lerp between bullet 
position and enemy center.

---

## Add space shooter example game with pooled bullets and wave spawning
*Wednesday, February 25th at 8pm*
Implement Phase 9.4 space shooter — a vertical-scrolling shmup with player 
ship, three enemy types (basic, weaver, bomber), boss fights every 3 waves, 
NodePool-based bullet recycling, power-ups (shield, rapid fire, spread shot), 
parallax starfield, and full scene flow (title, gameplay, game over). All 
entities use solid Actor collisions with self-contained bullet→enemy and 
bullet→player routing via the collided signal. Enemies wrap to the top of the 
screen when they pass the bottom, keeping waves persistent until cleared. Ships 
with 24 integration tests covering player movement, enemy behavior, bullet 
pooling, wave progression, power-ups, and deterministic replay.

---

## Remove pool workarounds from top-down shooter example
*Wednesday, February 25th at 8pm*
With the engine-level NodePool class defaults snapshot (Phase 1) and 
Actor.move() slide-loop re-entrancy guard (Phase 2) now in place, the top-down 
shooter no longer needs manual workarounds. Removed _recycled and 
_collisionConnected guard flags from PlayerBullet, EnemyBullet, WeaponPickup, 
and MuzzleFlash. Removed override-restoration boilerplate from all reset() 
methods (collisionGroup, solid, applyGravity, upDirection) — NodePool now 
handles this automatically. Replaced _recycled double-release guards with 
isInsideTree checks. Added 3 tests verifying pool properties survive 
acquire/release cycles. All three SHOOTER_ISSUES.md phases are now marked Done.

---

## Add slide-loop re-entrancy guard to Actor.move()
*Wednesday, February 25th at 6pm*
When Actor.move() fires onCollided() mid-slide-loop, collision handlers may 
remove the node from the tree (e.g., via removeSelf() or pool release). 
Previously the slide loop would continue executing on a detached node, 
requiring users to work around this with manual _recycled flags. This adds 
three isInsideTree checks in actor.ts: one after each of the two onCollided() 
call sites to break from the loop, and an early return after the loop to skip 
position writes, contact flag updates, platform carry, and rehash on detached 
nodes. Three tests verify the guard works correctly, partial slides stop early, 
and normal collisions are unaffected.

---

## Add class defaults snapshot to NodePool
*Wednesday, February 25th at 6pm*
NodePool now automatically captures class-level property overrides 
(collisionGroup, applyGravity, upDirection, solid, etc.) from a 
freshly-constructed exemplar and restores them after _poolReset() on every 
acquire. This eliminates the need for users to manually restore subclass 
override declarations in their reset() method. Also changes the auto-created 
default collision group to mask=0 (collides with nothing) to encourage explicit 
group configuration, with a console.warn when bodies use the unconfigured 
default group.

---

## Add sound effects to the top-down shooter
*Wednesday, February 25th at 4pm*
Added 9 CC0-licensed sound effects to the top-down shooter: per-weapon firing 
sounds (pistol, machine gun, silencer), player hit, enemy hit and death, weapon 
pickup, weapon switch, and wave start. Each WeaponDef now includes a sound 
field so the correct firing sound plays automatically. Sounds are loaded via 
the asset pipeline and played through the sfx audio bus.

---

## Polish top-down shooter and extend debug bridge API
*Wednesday, February 25th at 4pm*
Overhauled the top-down shooter example: replaced circular collision shapes 
with capsules for better character fit, added mouse-click and scroll-wheel 
firing/weapon-switching, fixed contact damage so enemies hurt a stationary 
player (enemy-side collided signal), introduced a weapon unlock system where 
only the pistol is available at start and other weapons drop from killed 
enemies as timed pickups with labels, fixed the ammo HUD display ordering bug, 
and added per-weapon ammo tracking across switches. Extended the debug bridge 
with destroy, mouse, and mouse-get commands, and fixed a crash in Actor where 
game.debugLog could throw if a node was destroyed during onCollided.

---

## Add top-down shooter game with pooled bullets and enemies
*Wednesday, February 25th at 3pm*
Implement Phase 3 of the object pooling system: a twin-stick top-down arena 
shooter in examples/top-down-shooter/ that validates NodePool at scale. The 
game features a WASD+mouse player, 3 weapon types (pistol, machine gun, 
silencer), 3 pooled enemy types (zombie, robot, soldier) with distinct AI, wave 
spawning, weapon pickups, muzzle flash effects, and a HUD with real-time pool 
stats. Includes 19 tests covering game flow, player movement/damage, bullet 
pool reuse across 100 spawn/recycle cycles, enemy waves, and weapon switching. 
Also adds a headless benchmark (3600 frames) and updates the examples index 
page. Discovered that poolable actors must use new Vec2(0, 0) instead of frozen 
Vec2.ZERO for upDirection to avoid crashes in _poolReset().

---

## Implement object pooling system (Phase 9.3)
*Wednesday, February 25th at 1pm*
Implements the two-tier object pooling system from POOLING_PLAN.md. Phase 1 
eliminates per-frame garbage in physics hot paths: Actor.move() and 
castMotion() now use scalar math instead of allocating Vec2/AABB objects, SAT 
functions accept Matrix2DLike plain objects instead of requiring Matrix2D 
instances, and stepMonitoring() reuses scratch Set/Map instead of allocating 
per frame. Phase 2 adds NodePool<T> with the Poolable interface and a 
_poolReset() chain across the full Node hierarchy (Node, Node2D, 
CollisionObject, Actor, Sensor, StaticCollider), enabling zero-GC entity 
recycling for bullet-hell scenarios. All 1747 tests pass including 21 new pool 
unit tests and integration tests verifying acquire/release lifecycle, physics 
re-registration, and deterministic ID assignment.

---

## Add Breakout game, auto-rehash spatial hash, and built-in XML assets
*Wednesday, February 25th at 1am*
Adds the complete Breakout example game (3 levels, paddle/ball/brick/power-up 
entities, HUD, title/game-over/victory scenes) using the JSX build() pattern 
throughout. Fixes a critical engine bug where setting position on a 
CollisionObject after add() did not update the spatial hash — StaticColliders 
and Sensors were permanently registered at their initial position. The fix adds 
a _onTransformDirty() hook in Node2D that CollisionObject overrides to 
auto-rehash, with suppression in Actor.move() to avoid double-rehash. Also 
promotes XML to a built-in asset type in AssetLoader alongside images and JSON, 
eliminating per-game boilerplate for sprite atlas loading.

---

## Add Breakout game, auto-rehash spatial hash, and built-in XML assets
*Wednesday, February 25th at 1am*
Adds the complete Breakout example game (3 levels, paddle/ball/brick/power-up 
entities, HUD, title/game-over/victory scenes) using the JSX build() pattern 
throughout. Fixes a critical engine bug where setting position on a 
CollisionObject after add() did not update the spatial hash — StaticColliders 
and Sensors were permanently registered at their initial position. The fix adds 
a _onTransformDirty() hook in Node2D that CollisionObject overrides to 
auto-rehash, with suppression in Actor.move() to avoid double-rehash. Also 
promotes XML to a built-in asset type in AssetLoader alongside images and JSON, 
eliminating per-game boilerplate for sprite atlas loading.

---

## Fix remaining dungeon lint warnings across all files
*Tuesday, February 24th at 3pm*
Eliminate all noNonNullAssertion lint warnings from the dungeon example. In 
entity classes (player, chest, potion-pickup), replaced this.scene! and 
this.sprite! patterns with guarded local variables. In HUD, wrapped signal 
handler property accesses with null checks. In test files, added if (!x) return 
guards after expect assertions and switched to optional chaining for nullable 
values. Also fixed import ordering and formatting (spaces to tabs) in door.tsx 
and toast.tsx. All 69 dungeon tests pass and pnpm lint reports zero warnings.

---

## Prepare Phase 9 assets, designs, and fix non-null assertions
*Tuesday, February 24th at 3pm*
Downloaded Kenney asset packs (sprite sheets + XML atlases) for four upcoming 
Phase 9 example games: Breakout, Space Shooter, Tower Defense, and Sokoban. 
Added placeholder cards to the examples index page. Created Phase 10 Three.js 
design and object pooling plan. Cleaned up non-null assertion warnings across 
dungeon tests and chest entity by replacing ! with proper null checks and 
optional chaining. Updated Phase 9 design to mark Phase 1.5 (TextureAtlas XML) 
as Done.

---

## Add TextureAtlas XML parser to @quintus/sprites
*Tuesday, February 24th at 3pm*
Add a TextureAtlas class to @quintus/sprites that parses Kenney-style XML atlas 
files and provides name-based frame lookup. This enables example games to 
reference sprites by name (e.g., "paddle_01.png") instead of hardcoding pixel 
coordinates. The class supports getFrame, getFrameOrThrow, hasFrame, 
getFramesByPrefix, and fromXml static constructor. Includes 10 unit/integration 
tests covering XML parsing, error handling, prefix grouping, and validation 
against a real Kenney breakout atlas file.

---

## Fix dungeon and tween test failures with missing dependencies
*Sunday, February 22nd at 8am*
Fixed all failing tests across the dungeon example and main test suite. The 
tween package's actor-child-tween test was missing @quintus/physics as a 
devDependency. The dungeon tests had two issues: a stale build of @quintus/test 
that was missing the recently-added hold() method, and a missing AudioPlugin in 
the test helper configuration that caused all game entities (Player, Dwarf, 
Door) to crash when calling game.audio.play(). Also includes a minor level2.tmx 
tweak repositioning a health pickup and adding a second one.

---

## Fix isEdgeAhead probe distance so patrol enemies walk closer to edges
*Sunday, February 22nd at 8am*
Reduced the default probeDistance in Actor.isEdgeAhead() from actorWidth / 2 + 
4 to just 2 pixels beyond the front edge. The old formula caused patrol enemies 
to detect floor edges far too early — for a 7px wide enemy, the probe fired 
7.5px past the front edge (more than the enemy's own width), making them turn 
around well before reaching the actual ledge. The new default of 2px gives 
natural-looking patrol behavior while still allowing custom values via the 
probeDistance parameter.

---

## Rebuild dungeon example with JSX entities, equipment system, and tests
*Saturday, February 21st at 4pm*
Major overhaul of the dungeon crawl example game. Migrated all entities and 
scenes to JSX-based build() declarations, added a full equipment system 
(weapons, shields, potions, buff manager), renamed enemies (orc to barbarian, 
skeleton to dwarf), and added 12 sound effects. Built a comprehensive test 
suite with 11 test files covering combat, enemies, equipment, HUD, 
interactables, inventory, player, scene setup, and game flow. Also enhanced 
@quintus/test InputScript with new capabilities, added actor-child-tween tests, 
and updated the debug bridge and canvas2d renderer.

---

## Fix all linting warnings across the codebase
*Friday, February 20th at 4pm*
Fixed all Biome linting warnings by replacing non-null assertion operators with 
definite assignment assertions on JSX ref-bound properties across the 
platformer-tsx example (coin, flying-enemy, health-pickup, patrol-enemy, 
player, hud, level), fixing indentation from spaces to tabs in the platformer 
level scene, reformatting long JSX attribute lines in title-scene, 
game-over-scene, victory-scene, and hud, and excluding the worktrees directory 
from Biome's scan to prevent nested config conflicts.

---

## Consolidate tilemap layers with tile-based entity spawning
*Friday, February 20th at 3pm*
Merged the separate ground and platforms layers in both platformer levels into 
a single tiles layer by adding oneWayTileIds support to generateCollision(), 
which splits collision into solid and one-way passes from a single layer. Added 
spawnFromTiles() to TileMap for spawning nodes (coins, spikes) directly from 
tile IDs instead of object-layer placement, clearing matched tiles after 
spawning. Updated both the platformer and platformer-tsx examples to use the 
consolidated approach, added excludeTileIds parameter to buildSolidGrid(), and 
included tests for all new functionality.

---

## Add one-way platform support and fix level tile IDs
*Friday, February 20th at 1pm*
Extended TileMap.generateCollision() to support per-layer collision tracking 
and one-way platforms. Changed the internal _collisionGenerated boolean to a 
per-layer Set so generateCollision() can be called for multiple layers (e.g., 
"ground" and "platforms"). Added oneWay option that passes through to created 
StaticColliders. Rebuilt level2.tmx to fix wrong auto-tiled IDs from wangsets 
(replacing tiles 11/12/26 with correct 56/57/58 for platforms, and fixing 
right-side ground islands). Split platform tiles (56/57/58) into a separate 
"platforms" layer in both level1.tmx and level2.tmx so they generate one-way 
collision — players can jump through from below and land on top.

---

## Add TSX platformer example and complete JSX Phase 4
*Friday, February 20th at 1pm*
Converts the complete platformer example to JSX/TSX declarative syntax, 
validating the @quintus/jsx build() pattern against a real game. All entities 
(Player, enemies, pickups), scenes (Title, GameOver, Victory, Level1/2), and 
HUD use build() with typed refs. Also fixes JSX children type to support nested 
arrays, adds @quintus/jsx to the examples workspace with Vite aliases, and 
updates the REACT_BUILD_PATTERN Phase 4 checklist to Done.

---

## Fix Layer renderFixed propagation via _onChildAdded hook
*Friday, February 20th at 12pm*
Layer's addChild() override for propagating renderFixed to children was never 
called because Node.add() (the recommended API) routes through _addChildNode() 
directly, bypassing addChild(). The JSX build() path also bypasses it via 
direct array push. Added a protected _onChildAdded() hook to Node, called from 
both _addChildNode() and the build() path. Layer now overrides this hook 
instead of addChild(), fixing HUD hearts and labels that were scrolling 
off-screen with the camera in both imperative and JSX platformer examples.

---

## Fix input edge flag timing for high-refresh-rate displays
*Friday, February 20th at 12pm*
Fixed a bug where jump presses (and other isJustPressed actions) were 
intermittently lost on high-refresh-rate displays (120Hz+). The root cause was 
that _beginFrame() cleared justPressed/justReleased edge flags every browser 
frame, but fixedUpdate only runs when the physics accumulator has enough time. 
On faster displays, browser frames without a corresponding fixedUpdate would 
clear the flag before any game code could see it. Edge flag clearing is now 
done via postFixedUpdate after each physics step, ensuring presses are never 
lost. Also added preventDefault for bound keys (fixes Space scrolling the page) 
and newlyTransitioned tracking for correct InputEvent propagation.

---

## Add type-safe string refs, callback refs, and dollar refs to JSX
*Friday, February 20th at 10am*
Reimplements JSX phases 1-3 ref system with three ref forms: string refs 
(ref="sprite") that assign to the build owner with runtime typo detection, 
callback refs (ref={n => ...}) for edge cases, and dollar refs ("$player") for 
order-independent cross-node references. Build owner tracking via Symbol.for in 
core's _enterTreeRecursive and _loadScene enables string ref assignment with 
save/restore for nested builds. The ref-scope module registers a resolver on 
globalThis so core can trigger dollar ref resolution after each build() without 
importing @quintus/jsx. Runtime validation throws actionable errors for refs 
used outside build(), typos in property names, and unresolved dollar refs 
listing available names.

---

## Add build() lifecycle for declarative JSX node trees (Phase 3)
*Thursday, February 19th at 8pm*
Adds the build() virtual method to Node that returns JSX-created children 
during tree entry. When a node enters the scene tree, build() runs before child 
recursion, so all built children are in-tree and ready by onReady() time. 
Modified _enterTreeRecursive to process build results with direct _children 
push (avoiding nested recursion), and _loadScene to handle Scene root builds. 
Includes 9 integration tests covering nested builds, refs, fragments, 
composition coexistence, and correct bottom-up ready ordering.

---

## Add JSX type definitions with auto-derived props (Phase 2)
*Thursday, February 19th at 6pm*
Add TypeScript JSX type definitions to @quintus/jsx that automatically derive 
prop types from any Node subclass via LibraryManagedAttributes. Implements 
WritableKeys to exclude readonly, methods, and underscore-prefixed properties; 
CoercedPropType for Vec2 tuple and Color string ergonomics; SignalProps for 
auto-connecting signal handlers. Includes module-scoped JSX namespace in both 
jsx-runtime and jsx-dev-runtime, vitest typecheck configuration, and 31 
type-level tests covering writable props, readonly exclusion, coercion, 
signals, and Scene guard.

---

## Add @quintus/jsx package with core JSX runtime (Phase 1)
*Thursday, February 19th at 4pm*
Implements Phase 1 of the React-style JSX build pattern for Quintus. Creates 
the new @quintus/jsx package with h() and jsx() element creation, Fragment 
support, ref() for node references, and applyProp() with smart coercion (tuples 
to Vec2, hex strings to Color, numbers to uniform scale, functions to Signal 
connections, Ref unwrapping). Adds IS_NODE_CLASS symbol to @quintus/core Node 
class for distinguishing class components from functional components. Includes 
46 tests covering all creation paths, coercion rules, tree nesting, and Scene 
exclusion guard. The package exports three entry points: main index, 
jsx-runtime for TypeScript auto-import, and jsx-dev-runtime for dev mode.

---

## Implement API ergonomics overhaul (9-phase code smell fixes)
*Thursday, February 19th at 9am*
Implement all 9 phases of API ergonomics improvements identified in 
CODE_SMELLS.md. Core engine changes: node.game/node.scene now throw outside 
tree with gameOrNull/sceneOrNull escape hatches; unified add() API on Node 
(addChild deprecated); is() type guard and typed findFirst/findAll queries; 
@quintus/tilemap/physics side-effect import replacing unsafe casts; 
node.after()/every() timer convenience methods; reactiveState() with 
Proxy-based change signals and per-key subscriptions; game.consts 
ConstantsRegistry for tweakable values; removed andThen() from tween API. All 6 
examples updated to use new APIs — null-check boilerplate eliminated, 
signal-driven HUDs replace polling, duck-typing replaced with type-safe is() 
guards. Build, 1589 tests, platformer integration tests, and lint all pass 
clean.

---

## Add pixel-snap rendering to fix sub-pixel tile seams
*Thursday, February 19th at 7am*
Add a pixelSnap property to Canvas2DRenderer that rounds transform translation 
components (e, f) to integers via Math.round() before ctx.setTransform() calls. 
This eliminates the 1px banding/seam artifacts visible between tiles when 
camera smoothing or fractional positions produce sub-pixel offsets. The 
property defaults to true when pixelArt mode is enabled, matching the old 
Quintus engine's strategy of sub-pixel physics with integer-snapped rendering. 
Uses Math.round() over Math.floor() following Godot's PR #43813 findings (less 
jitter at integer boundaries, no systematic bias).

---

## Add scene registry for string-based scene transitions
*Wednesday, February 18th at 7pm*
Add a scene registry to Game that allows scenes to be referenced by string 
names instead of class constructors, eliminating circular import issues. The 
registry adds registerScene(), registerScenes(), and a SceneTarget type (string 
| SceneConstructor) accepted by start(), switchTo(), and _switchScene(). Both 
platformer and dungeon examples are updated to use string-based transitions, 
removing the _Level1Ref/_setLevel1Ref mutable-reference hack. Ten new tests 
cover registration, resolution, chaining, error cases, and backwards 
compatibility.

---

## Fix dungeon crawler sprites and add complete dungeon example
*Wednesday, February 18th at 1pm*
Corrected all 16 tile mappings in the dungeon crawler sprites.ts and state.ts 
by visually cataloging every tile in the Kenney Tiny Dungeon tileset (132 
tiles). Created tile_description.csv for future reference. Added the complete 
dungeon crawler example game with player, enemies (skeleton, orc), items 
(chests, keys, health pickups, equipment), doors, HUD, procedural level 
generation, and multiple dungeon levels. Also updated debug-game skill 
references to use pnpm-based commands.

---

## Add Y-Sort rendering, Timer node, and fix all lint warnings
*Tuesday, February 17th at 8pm*
Implements Phase A engine enhancements for the dungeon crawler demo: 
ySortChildren property on Node2D for automatic Y-position-based render 
ordering, and a Timer node for deterministic one-shot/repeating delays using 
onFixedUpdate. Resolves all 377 Biome lint diagnostics across the codebase by 
replacing non-null assertions with type-safe alternatives (charAt for string 
indexing, as-assertions for array access in hot loops), removing unused 
imports, fixing import ordering, and eliminating useless constructors. Also 
includes Phase 8 design document, debug skill updates, and audio/input debug 
instrumentation.

---

## Implement Phase 7: deterministic testing and AI infrastructure
*Tuesday, February 17th at 2pm*
Implement @quintus/headless (HeadlessGame with runFor/runUntil), @quintus/test 
(InputScript DSL, InputScriptPlayer, async TestRunner, Timeline, assertions, 
assertDeterministic), and @quintus/snapshot (StateSnapshot, captureState, 
recursive diffSnapshots with tolerance). Add shared snapshot-utils and 
_resetNodeIdCounter to @quintus/core. Include 97 new tests across all three 
packages plus 7 platformer integration tests verifying player movement, 
jumping, and 3-run determinism. AI agents and CI pipelines can now run, test, 
and inspect Quintus games headlessly without a browser.

---

## Add comprehensive test coverage across all engine packages
*Tuesday, February 17th at 12pm*
Add 107 new tests across 6 new test files and 5 expanded existing files, 
raising overall statement coverage from 91.67% to 95.38%. New test files cover 
UI panel drawing, audio augmentation and autoplay gate, audio plugin lifecycle, 
pointer event dispatch with coordinate conversion, and input plugin propagation 
with DOM event binding. Expanded tests add gamepad polling with dead zones and 
stick axes, moving platform carry, debug bridge click/clickButton and query 
helpers, asset loader custom loaders, TSX parser error paths and collision 
shapes, and tilemap edge cases including TMX loading.

---

## Add platformer to examples index page
*Tuesday, February 17th at 12pm*
Added the full-featured platformer game as a new entry on the examples index 
page. The card links to /platformer/ and is labeled as Phase 6, with a 
description highlighting its key features: 2 levels, enemies, double jump, 
health system, HUD, audio, camera follow, TMX maps, and pixel art sprites.

---

## Add TMX/TSX XML parser and convert platformer to native Tiled format
*Tuesday, February 17th at 12pm*
Add first-class Tiled TMX/TSX XML parsing to @quintus/tilemap with parseTmx() 
and parseTsx() functions that produce the same TiledMap objects as the existing 
JSON pipeline. The parser supports CSV tile data, inline and external tilesets, 
all object shapes (point, ellipse, polygon, polyline), tile objects with GID, 
per-tile collision and animation, custom properties of all types, and Tiled 
1.9+ class-to-type fallback. TileMap._loadMap() now auto-detects format, trying 
JSON first then falling back to TMX text. The platformer example is converted 
to load .tmx levels instead of .json, reducing level file sizes from ~7000 
lines to ~160 lines. Includes comprehensive test suites for both parsers (27 
test cases) and prerequisite type additions to tiled-types.ts.

---

## Add Node.set() and addChild props for bulk property assignment
*Tuesday, February 17th at 10am*
Added a set(props) method to the Node base class and an optional props second 
argument to addChild(Class, props) and Scene.add(Class, props), enabling bulk 
property assignment with full type safety via Partial<this> and Partial<T>. 
Updated Layer.addChild to forward props correctly. Refactored all platformer 
example UI scenes (title, game-over, victory, HUD) to use the new declarative 
props pattern, eliminating verbose per-property setter lines. Added 3 new tests 
covering addChild with props, set() standalone, and set() chaining.

---

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
