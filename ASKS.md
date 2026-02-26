# Asks

[Q2PL] thu 2/12 3pm - Create IMPLEMENTATION_PLAN.md for Quintus 2.0 game engine rewrite using modernization research, Godot-inspired architecture, and AI integration design docs

[PH0D] thu 2/12 4pm - Create PHASE_0_DESIGN.md from IMPLEMENTATION_PLAN.md with detailed steps for Phase 0 project bootstrap

[DVIL] thu 2/12 10pm - Run devil's advocate review on PHASE_0_DESIGN.md to identify blockers, design flaws, and testing gaps before implementation

[PH0B] fri 2/13 8am - Implement Phase 0 project bootstrap from PHASE_0_DESIGN.md — monorepo infrastructure, CI, empty packages, developer tooling

[PH1D] fri 2/13 10am - Create steering/PHASE_1_DESIGN.md detailed design document for Phase 1 (Core Engine) of the implementation plan

[DVLR] fri 2/13 11am - Play devil's advocate on PHASE_1_DESIGN.md, identifying architectural flaws, performance issues, type safety gaps, and lifecycle race conditions

[PH1I] fri 2/13 12pm - Implement Phase 1 core engine from PHASE_1_DESIGN.md including @quintus/math and @quintus/core packages

[APIR] fri 2/13 12pm - Play devil's advocate on the proposed Godot-inspired API design in Steering/ docs and challenge terminology and approaches that mirror Godot without good reason

[PH0B] fri 2/13 12pm - Implement Phase 0 project bootstrap and commit milestone with 19 packages and full toolchain

[SIMP] fri 2/13 1pm - Review IMPLEMENTATION_PLAN.md and PHASE_1_DESIGN.md for LLM implementation difficulty, comprehension issues, and potential simplifications

[3DPL] fri 2/13 1pm - Create steering/3D_IMPLEMENTATION_PLAN.md explaining how the 2D-first engine will be extended to support 3D games and any core changes needed

[PH1A] fri 2/13 2pm - Align Phase 1 implementation with PHASE_1_DESIGN.md: Vec2 mutability with frozen constants, lifecycle on-prefix renames, PauseMode, modulate-to-tint rename, and Proxy-based dirty flagging on Node2D

[SIMP] fri 2/13 2pm - Simplify Phase 1 core engine based on LLM-friendliness review and commit milestone

[3DRD] fri 2/13 2pm - Implement PHASE_1_3D_DESIGN.md 3D-readiness changes to core/math packages and update IMPLEMENTATION_PLAN.md for future phases

[3DRD] fri 2/13 3pm - Implement 3D-readiness changes: extract Renderer interface, make Game renderer pluggable, move onDraw from Node to Node2D

[PH2D] fri 2/13 4pm - Create a detailed steering/PHASE_2_DESIGN.md for the physics and collision phase from IMPLEMENTATION_PLAN.md

[NATV] fri 2/13 4pm - Create steering/NATIVE_IMPLEMENTATION_PLAN.md detailing how Quintus engine can wrap for native iOS/Android games with both 2D and 3D renderers

[PH1A] fri 2/13 4pm - Investigate 120→60fps regression in balls demo and add Vec2._set() bulk setter to eliminate redundant dirty notifications in Node2D

[DVLP] fri 2/13 5pm - Devil's advocate review of Phase 2 Subphase 1 design doc identifying 12 issues across type safety, collision groups, and build ordering

[PH2T] fri 2/13 9pm - Devil's advocate review of Phase 2 Subphase 1 and Design Core documents for transform-aware collision detection

[DVAD] fri 2/13 9pm - Implement devil's advocate fixes to Phase 2 design and core code: destroy queue bug, remove props from addChild, postFixedUpdate signal, epsilon-based isTranslationOnly, and design doc updates

[PH2A] fri 2/13 9pm - Implement Phase 2 Subphase 1: postFixedUpdate signal, remove props from addChild, Shape2D types, CollisionInfo, and CollisionGroups

[PH2A] fri 2/13 10pm - Implement Phase 2 Subphase 1 foundation types (shapes, collision-info, collision-groups) and commit milestone

[DVLP] fri 2/13 10pm - Devil's advocate review of Phase 2 Subphase 2 collision detection design document for correctness, performance, and integration issues

[COLL] sat 2/14 9am - Implement Phase 2 Subphase 2: SpatialHash broad phase, SAT narrow phase, and swept collision detection with tests

[COLL] sat 2/14 2pm - Implement Phase 2 Subphase 2 collision detection (SpatialHash, SAT, swept collision) and commit milestone

[SATX] sat 2/14 2pm - Review SAT collision detection test cases for exhaustiveness across all supported collision shapes with and without transforms

[DVLP] sat 2/14 2pm - Devil's advocate review of Phase 2 Subphase 3 physics infrastructure design document for registration timing, SAT gaps, and multi-shape collision issues

[SATX] sat 2/14 2pm - Dramatically increase SAT collision test coverage with 57 new tests across all shape pairs, transforms, and swept collision and commit milestone

[PH2C] sat 2/14 2pm - Implement Phase 2 Subphase 3: CollisionShape, CollisionObject, PhysicsWorld, PhysicsPlugin, and contact point computation with tests

[TCOV] sat 2/14 4pm - Review test coverage across the entire engine and identify gaps in testing

[PH2C] sat 2/14 4pm - Implement Phase 2 Subphase 3 physics infrastructure (CollisionShape, CollisionObject, PhysicsWorld, PhysicsPlugin, contact points) and commit milestone

[DEVL] sat 2/14 4pm - Review Phase 2 Subphase 4 (Actor, StaticCollider, Sensor) design for implementation gaps, missing edge cases, and codebase mismatches

[ASKS] sat 2/14 4pm - Create steering/PHASE_2_TEST_GAPS.md breaking down test coverage gaps into addressable subphases

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T1: physics integration tests for collision-object and physics-plugin

[MILE] sat 2/14 4pm - Added physics integration tests for CollisionObject and PhysicsPlugin, bringing coverage from 48%/0% to 100%/100%

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T2: Canvas2DRenderer draw method tests for Canvas2DDrawContext primitives

[MILE] sat 2/14 4pm - Added Canvas2DDrawContext and render pipeline tests, bringing canvas2d-renderer coverage from 44% to 100%

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T3: GameLoop RAF tick method tests for full coverage

[MILE] sat 2/14 4pm - Added GameLoop RAF tick tests for 100% game-loop coverage, completing Phase 2 test gap subphase T3

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T4: core edge cases for game.ts, node2d.ts, and asset-loader.ts

[MILE] sat 2/14 4pm - Added core edge case tests for game.ts, node2d.ts, and asset-loader.ts, completing Phase 2 test gap subphase T4

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T5: math micro-gaps for Vec2, Color, SeededRandom, and Matrix2D

[MILE] sat 2/14 4pm - Added math micro-gap tests for Vec2, Color, and Matrix2D, completing Phase 2 test gap subphase T5

[IMPL] sat 2/14 4pm - Implement Phase 2 test gap subphase T6: Physics World & SAT micro-gap tests for uncovered edge-case paths

[MILE] sat 2/14 8pm - Added physics world and SAT micro-gap tests covering all uncovered edge-case paths in T6, achieving 100% line coverage

[IMPL] sat 2/14 8pm - Implement Phase 2 Subphase 4: Actor with move(), StaticCollider, and Sensor physics bodies

[MILE] sat 2/14 9pm - Added Actor, StaticCollider, and Sensor physics bodies with move() slide loop, one-way platforms, and sensor signals

[DEVL] sat 2/14 9pm - Review Phase 2 Subphase 5 integration tests & demo design for potential issues and risks

[MILE] sat 2/14 9pm - Refactored scenes from callback-based to class-based API, eliminating defineScene/SceneDefinition in favor of SceneConstructor

[IMPL] sat 2/14 9pm - Implement Phase 2 Subphase 5: integration tests and platformer demo for the physics system

[IMPL] sun 2/15 6am - Debug platformer demo where player falls through ground, coins mispositioned, and collision objects not visible

[IMPL] sun 2/15 6am - Debug platformer demo where player falls through ground, coins render at wrong position, and collision objects appear missing

[MILE] sun 2/15 7am - Fixed physics spatial hash registration, jump velocity clobbering, render list staleness, and added working platformer demo

[ASKS] sun 2/15 8am - Design Phase 4 (Tilemap & Camera) detailed design document for the Quintus 2.0 game engine rewrite

[MILE] sun 2/15 8am - Closed test coverage gaps across core, math, and physics packages with 120 new tests

[ASKS] sun 2/15 9am - Design AI debug protocol with event log system, align with CLI/skills approach (not MCP), and note Phase 3 input dependency

[ASKS] sun 2/15 9am - Design and write the Phase 3 (Sprites & Input) detailed design document for the Quintus 2.0 game engine rewrite

[DEVL] sun 2/15 9am - Review Phase 3 input subsystem design for AI debug compatibility issues

[IMPL] sun 2/15 10am - Implement Phase 3 (Sprites & Input) — SpriteSheet, Sprite, AnimatedSprite, Input system with action maps, gamepad, mouse, injection, and InputEvent propagation

[MILE] sun 2/15 11am - Added sprites and input packages completing Phase 3 with SpriteSheet, AnimatedSprite, action-map input system, and design docs

[IMPL] sun 2/15 11am - Implement the AI Debug Protocol (Phase 8): node serialization, debug log, debug bridge, and auto-instrumentation

[DEVL] sun 2/15 11am - Review Phase 4 tilemap & camera design for potential issues and risks

[IMPL] sun 2/15 12pm - Implement Phase 8 AI Debug Protocol: node serialization, DebugLog, debug bridge, auto-instrumentation hooks, and formatters

[IMPL] sun 2/15 12pm - Review and fix TypeScript strictness across the monorepo, ensuring no anys and no warnings in the core engine

[MILE] sun 2/15 12pm - Added AI debug protocol with node serialization, debug log, debug bridge, auto-instrumentation, and Phase 4 design refinements

[MILE] sun 2/15 1pm - Added /debug-game skill with quintus-debug CLI wrapper, formatters exposure, reference docs, and debug session demo

[MILE] sun 2/15 1pm - Added node IDs and collision shape details to debug tree output for better scene inspection

[MILE] sun 2/15 1pm - Added move-to and nearby commands to debug-game skill with ceiling collision docs and updated recipes

[IMPL] sun 2/15 1pm - Implement Phase 4 (Tilemap & Camera) from PHASE_4_DESIGN.md with exhaustive test coverage and debug-game verification

[IMPL] sun 2/15 2pm - Implement Phase 4 (Tilemap and Camera) with exhaustive tests and a working scrolling platformer demo

[ASKS] sun 2/15 2pm - Design Phase 5 (Audio, Tween, UI) by reviewing the implementation plan and creating steering/PHASE_5_DESIGN.md

[MILE] sun 2/15 3pm - Added tilemap and camera packages (Phase 4) with Tiled map loading, collision generation, camera system, and scrolling platformer demo

[DEVL] sun 2/15 3pm - Review Phase 5 design document for potential issues and risks

[IMPL] sun 2/15 4pm - Implement Phase 5 (Audio, Tween, UI) packages following the detailed design in PHASE_5_DESIGN.md

[IMPL] sun 2/15 4pm - Implement Phase 5 (Audio, Tween, UI packages) with core changes, 3 new packages, and all tests passing

[MILE] sun 2/15 6pm - Added tween, audio, and UI packages with core changes, demo, and 1143 passing tests (Phase 5)

[IMPL] sun 2/15 6pm - Refactor examples so each demo lives in its own subdirectory with index linking to all demos

[ASKS] sun 2/15 6pm - Design Phase 6 (meta-package and first complete platformer game) by reviewing the implementation plan and creating PHASE_6_DESIGN.md

[DEVL] sun 2/15 6pm - Review Phase 6 meta-package and platformer design for potential issues and risks

[ASKS] sun 2/15 9pm - Design a plan to add collision events and actor-to-actor collisions to the physics system, writing to steering/FIX_COLLISION_DESIGN.md

[DEVL] mon 2/16 7am - Review FIX_COLLISION_DESIGN.md for potential issues and risks

[MILE] mon 2/16 10am - Refactored examples into subdirectories with styled landing page linking to all demos

[IMPL] mon 2/16 11am - Implement FIX_COLLISION_DESIGN.md: collision events, actor-to-actor collisions, onContact/onOverlap APIs, and game.physics accessor

[MILE] mon 2/16 12pm - Implemented actor-to-actor collision, onOverlap/onContact APIs, and fixed Sensor signal emission in @quintus/physics

[IMPL] mon 2/16 12pm - Implement Phase 6: quintus meta-package and complete platformer example game per PHASE_6_DESIGN.md

[MILE] mon 2/16 1pm - Copied platformer example to basic_platformer and updated index before Phase 6 rewrite

[IMPL] mon 2/16 1pm - Ensure all tests pass and there are no warnings across the monorepo

[MILE] mon 2/16 1pm - Added quintus meta-package bundling all 10 engine packages with tests and augmentation verification

[IMPL] mon 2/16 1pm - Implement Phase 6 Step 2: update CLAUDE.md to mark Phase 5 done, update Phase 6 status, and verify build/test/lint

[MILE] mon 2/16 2pm - Fixed stderr warnings in game error-handling tests by stopping rAF loop after assertions

[IMPL] mon 2/16 2pm - Implement the complete platformer game from Phase 6 design - entities, scenes, HUD, audio, and full game loop

[DSGN] mon 2/16 3pm - Design scene query API for actors — raycasting, edge detection, overlap queries, pathfinding

[DEVL] mon 2/16 3pm - Review QUERY_API.md for potential issues and risks

[IMPL] mon 2/16 4pm - Implement scene query API — raycasting, point/area queries, shape cast, actor convenience methods, and tilemap DDA raycast

[MILE] mon 2/16 4pm - Added complete platformer game with title screen, levels, enemies, HUD, and fixed bidirectional onContact dispatch and depenetration signals

[MILE] mon 2/16 6pm - Added complete scene query API with raycast, area queries, shape cast, actor convenience methods, and DDA tilemap raycast

[DSGN] tue 2/17 8am - Design first-class Tiled .tmx/.tsx file support for level editing interoperability

[MILE] tue 2/17 8am - Added pixel art sprites, spike hazard entity, heart HUD icons, and renderer pixelArt mode to the platformer

[DEVL] tue 2/17 8am - Review TILED_SUPPORT.md Phase 1 for potential issues and risks

[MILE] tue 2/17 10am - Added Node.set() and addChild props API for bulk property assignment with type safety

[IMPL] tue 2/17 10am - Implement Phase 1 TMX/TSX XML parser for Tiled support

[MILE] tue 2/17 12pm - Added TMX/TSX XML parser and converted platformer to native Tiled format with auto-detection

[IMPL] tue 2/17 12pm - Update the example list to include the full-featured platformer game

[ASKS] tue 2/17 12pm - Review test coverage gaps across all quintus packages and create a plan to address them

[DSGN] tue 2/17 12pm - Design Phase 7 deterministic simulation and AI testing framework

[MILE] tue 2/17 12pm - Added platformer game to examples index page as Phase 6 entry

[MILE] tue 2/17 12pm - Added comprehensive test coverage across all engine packages, raising statement coverage from 91.67% to 95.38% with 107 new tests

[DEVL] tue 2/17 1pm - Review Phase 7 design for potential issues and risks

[IMPL] tue 2/17 1pm - Implement Phase 7: Deterministic Testing & AI Infrastructure (headless, test, snapshot packages)

[MILE] tue 2/17 2pm - Implemented Phase 7: deterministic testing and AI infrastructure with @quintus/headless, @quintus/test, and @quintus/snapshot packages

[DSGN] tue 2/17 2pm - Design Phase 8: Debug CLI & AI Skills

[IMPL] tue 2/17 3pm - Implement Phase 8 remaining work: promote CLI to qdbg, input/audio instrumentation, signal watching

[DSGN] tue 2/17 3pm - Design top-down 2D dungeon crawler — engine gaps analysis and demo game plan

[IMPL] tue 2/17 4pm - Implement Phase A engine enhancements (Y-sort rendering + Timer node) for dungeon crawler

[MILE] tue 2/17 8pm - Added Y-Sort rendering mode, Timer node, and resolved all 377 Biome lint warnings across the codebase

[IMPL] tue 2/17 8pm - Implement Phase B dungeon crawler demo game from RPG 2D design

[IMPL] wed 2/18 11am - Fix dungeon crawler sprites to match tile descriptions and design

[ASKS] wed 2/18 12pm - Propose a scene registry pattern so games can reference scenes by name instead of passing class references around

[MILE] wed 2/18 1pm - Fixed dungeon crawler sprite mappings and added complete dungeon example with tile catalog CSV

[DSGN] wed 2/18 1pm - Design scene registry pattern for string-based scene switching

[IMPL] wed 2/18 1pm - Implement scene registry for string-based scene transitions

[MILE] wed 2/18 7pm - Added scene registry for string-based scene transitions, eliminating circular import hacks

[IMPL] wed 2/18 7pm - Implement pixel-snapping in the renderer and tilemap to fix sub-pixel tile banding/seam artifacts

[ASKS] wed 2/18 7pm - Review current examples for syntax and code smells before building more examples off the engine

[DSGN] wed 2/18 9pm - Design API ergonomics improvements addressing code smells found in examples review

[MILE] thu 2/19 7am - Added pixel-snap rendering to Canvas2DRenderer to fix sub-pixel tile banding artifacts

[ASKS] thu 2/19 8am - Brainstorm what a TSX/JSX-style syntax for composing game engine nodes (UI and scene nodes) might look like

[IMPL] thu 2/19 8am - Implement API ergonomics code smell fixes (type narrowing, unified add(), type guards, tilemap physics bridge, convenience methods, reactive state, constants registry, tween polish)

[DSGN] thu 2/19 8am - Design JSX-based declarative node composition pattern for scenes, UI, and components

[MILE] thu 2/19 9am - Implemented 9-phase API ergonomics overhaul with unified add() API, reactive state, type guards, timer convenience methods, constants registry, and updated all 6 examples

[DEVL] thu 2/19 10am - Review JSX declarative build pattern design for potential issues and risks

[IMPL] thu 2/19 2pm - Implement @quintus/jsx package Phase 1: core JSX runtime (h, jsx, Fragment, ref, coercion)

[IMPL] thu 2/19 3pm - Implement @quintus/jsx Phase 1 — Core JSX Runtime (h, jsx, Fragment, ref, applyProp with coercion)

[MILE] thu 2/19 4pm - Added @quintus/jsx package Phase 1 with core JSX runtime, ref system, smart prop coercion, and 46 tests

[IMPL] thu 2/19 4pm - Implement Phase 2 JSX TypeScript type definitions for @quintus/jsx

[IMPL] thu 2/19 5pm - Implement Phase 2 JSX TypeScript type definitions (WritableKeys, CoercedPropType, SignalProps, NodeJSXProps, JSX namespace)

[MILE] thu 2/19 6pm - Added JSX type definitions with auto-derived props, WritableKeys, CoercedPropType, SignalProps, and 31 type-level tests (Phase 2)

[IMPL] thu 2/19 6pm - Implement JSX build() lifecycle integration (Phase 3 of REACT_BUILD_PATTERN)

[MILE] thu 2/19 8pm - Added build() lifecycle method to Node for declarative JSX node tree composition (Phase 3)

[ASKS] fri 2/20 9am - Rewrite Phase 4 of REACT_BUILD_PATTERN.md to focus on converting platformer and dungeon examples to use JSX/TSX

[IMPL] fri 2/20 9am - Reimplement JSX phases 1-3 with type-safe refs and runtime typo checks

[MILE] fri 2/20 10am - Added type-safe string refs, callback refs, and dollar refs to JSX with runtime validation and build owner tracking

[IMPL] fri 2/20 10am - Implement Phase 4: Convert platformer example to TSX with JSX build() pattern

[DSGN] fri 2/20 12pm - Design phased dungeon game rebuild with testable components, weapons, inventory, and TSX

[MILE] fri 2/20 12pm - Fixed input edge flag timing bug where isJustPressed was lost on high-refresh-rate displays, added preventDefault for bound keys

[MILE] fri 2/20 12pm - Fixed Layer renderFixed propagation via _onChildAdded hook, resolving HUD hearts scrolling off-screen in platformer examples

[IMPL] fri 2/20 12pm - Rebuild platformer example level 2 with correct tiles from level 1, and convert platforms to one-way jump-through tiles

[DEVL] fri 2/20 12pm - Review DUNGEON_REBUILD.md for potential issues and risks

[MILE] fri 2/20 1pm - Added TSX platformer example completing JSX Phase 4 with declarative build() pattern for all entities, scenes, and HUD

[MILE] fri 2/20 1pm - Added one-way platform support with per-layer collision tracking and fixed level tile IDs in both TMX files

[IMPL] fri 2/20 1pm - Add an objects tile layer to the platformer tileset for coins and spikes, and migrate entity-based placement to tile-based instantiation

[ASKS] fri 2/20 2pm - Propose consolidating platformer's 3 tileset layers into 1 layer with tile-ID-based routing for one-way platforms, coins, and spikes

[IMPL] fri 2/20 3pm - Update the platformer-jsx example to be at functional parity with the platformer example, using JSX syntax

[MILE] fri 2/20 3pm - Consolidated tilemap layers with tile-based entity spawning and oneWayTileIds support

<<<<<<< HEAD
[MILE] fri 2/20 4pm - Fixed all Biome linting warnings with definite assignment assertions, formatting fixes, and worktree config exclusion

[IMPL] fri 2/20 6pm - Review and fix patrolling enemy edge detection tolerance in platformer example — enemies turn around too early before reaching ledge edges
=======
[IMPL] fri 2/20 1pm - Implement Phase 1: Sprite audit & correction for dungeon crawler rebuild

[IMPL] fri 2/20 2pm - Implement Phase 2: Test infrastructure & basic scene for dungeon crawler rebuild

[IMPL] fri 2/20 4pm - Implement Phase 3: Player movement & collision with TSX conversion

[IMPL] fri 2/20 4pm - Implement Phase 4: Equipment system (Weapon/Shield base classes) for dungeon crawler

[IMPL] fri 2/20 5pm - Implement Phase 5: Combat system (attack, defend, hitboxes) for dungeon crawler

[IMPL] fri 2/20 5pm - Implement Phase 6: Enemy AI (BaseEnemy, Dwarf, Barbarian) with TSX build(), visible equipment, and AI tests

[IMPL] fri 2/20 5pm - Implement Phase 7: Interactables (Chest, Door, HealthPickup) for dungeon crawler rebuild

[IMPL] fri 2/20 6pm - Implement Phase 8 inventory and potion system for dungeon crawler

[ASKS] fri 2/20 6pm - Review dungeon rebuild design and update level approach to use single tilemap with object-to-node extraction like the platformer example

[IMPL] fri 2/20 6pm - Implement Phase 9 HUD with TSX declarative patterns for dungeon crawler

[IMPL] fri 2/20 6pm - Fix dungeon crawler weapon positioning and rotation so weapons attach to the player and rotate correctly by their base during attacks

[IMPL] fri 2/20 7pm - Implement Phase 10: Level rebuild & scene flow for dungeon crawler

[IMPL] sat 2/21 2pm - Review and fix dungeon game inventory/shield visibility, chest loot display, and potion effect descriptions, with a test level for debugging

[IMPL] sat 2/21 3pm - Add RPG sound effects from Kenney audio pack to the dungeon example game at appropriate interaction points

[MILE] sat 2/21 4pm - Rebuilt dungeon example with JSX entity declarations, equipment system, sound effects, and comprehensive test suite

[MILE] sun 2/22 8am - Fixed isEdgeAhead default probe distance from actorWidth/2+4 to 2px so patrol enemies walk closer to ledge edges before turning

[MILE] sun 2/22 8am - Fixed dungeon and tween test failures with missing AudioPlugin and @quintus/physics dependencies

[DSGN] sun 2/22 8am - Design Phase 9 — AI prefabs and example games with incremental game builds and prefabs proposal

[DSGN] sun 2/22 8am - Design Phase 10 Three.js integration as optional plugin

[DSGN] sun 2/22 6pm - Design Phase 9 AI prefabs & example games with incremental game-by-game approach and Kenney asset review

[DSGN] sun 2/22 6pm - Design Phase 10 Three.js integration as optional plugin

[DEVL] sun 2/22 6pm - Review Phase 9 AI Prefabs & Example Games design for potential issues and risks

[DEVL] sun 2/22 6pm - Review Phase 10 Three.js integration design for potential issues and risks

[DSGN] mon 2/23 10am - Design object pooling system to prevent GC pressure for bullet-hell style games

[IMPL] mon 2/23 3pm - Implement Phase 9 Phase 1: Asset preparation (download Kenney packs, create tile CSVs)

[IMPL] mon 2/23 3pm - Implement Phase 9 Phase 1: Asset preparation - download Kenney asset packs and create tile description CSVs

[IMPL] tue 2/24 2pm - Update PHASE_9_DESIGN.md to add a Phase 1.5 for XML tileset support in the engine, replacing hardcoded rects/IDs with XML-based sprite definitions

[IMPL] tue 2/24 2pm - Implement Phase 1.5 XML Texture Atlas support in @quintus/sprites

[MILE] tue 2/24 3pm - Added TextureAtlas XML parser to @quintus/sprites with name-based frame lookup and 10 tests

[MILE] tue 2/24 3pm - Prepared Phase 9 assets, design docs, and fixed non-null assertion warnings across dungeon example

[IMPL] tue 2/24 3pm - Implement Phase 2 Breakout example game

[MILE] tue 2/24 3pm - Fixed all remaining dungeon lint warnings with null guards and formatting fixes

[IMPL] tue 2/24 9pm - Implement Phase 2 Breakout example game

[MILE] wed 2/25 1am - Added Breakout game with JSX build pattern, fixed spatial hash auto-rehash on position change, and promoted XML to built-in asset type

[IMPL] wed 2/25 1am - Implement object pooling system (Phase 3 of Phase 9) — physics pipeline temp pools, NodePool<T>, and _poolReset chain

[IMPL] wed 2/25 2am - Implement Phase 3 of pooling plan - top-down shooter example game with object pooling integration

[MILE] wed 2/25 1pm - Implemented object pooling system (Phase 9.3) with physics pipeline scalar optimizations and NodePool<T> acquire/release lifecycle

[IMPL] wed 2/25 1pm - Implement Phase 3 pooling integration: top-down shooter example and benchmarks

[IMPL] wed 2/25 2pm - Implement Phase 4 Space Shooter example game with pooled bullets, wave system, and 3 enemy types

[MILE] wed 2/25 3pm - Added top-down shooter game with pooled bullets, enemies, wave spawning, and 19 tests validating NodePool at scale

[IMPL] wed 2/25 3pm - Debug top-down shooter example using qdbg — fix player rotation, bullet-enemy collision, and stray collision rects; document engine gotchas

[IMPL] wed 2/25 4pm - Debug top-down shooter using qdbg: fix rotation, bullet pool reset for collision groups and signal handlers, and document engine gotchas

[DSGN] wed 2/25 4pm - Design pool reset improvements to prevent _poolReset() from clobbering subclass overrides

[IMPL] wed 2/25 4pm - Fix top-down-shooter collision shapes to capsules and add mouse-click firing alongside spacebar

[IMPL] wed 2/25 4pm - Implement class defaults snapshot in NodePool (Phase 1 pool reset improvements)

[MILE] wed 2/25 4pm - Polished top-down shooter with capsule collisions, mouse firing, weapon unlock/pickup system, contact damage fix, ammo tracking, and extended debug bridge API

[MILE] wed 2/25 4pm - Added 9 CC0 sound effects to the top-down shooter with per-weapon firing sounds and game event audio

[MILE] wed 2/25 6pm - Added class defaults snapshot to NodePool for automatic preservation of subclass override declarations through pool cycles

[IMPL] wed 2/25 6pm - Implement Phase 2: Slide-loop re-entrancy guard for Actor.move()

[MILE] wed 2/25 6pm - Added slide-loop re-entrancy guard to Actor.move() with isInsideTree checks and three tests

[IMPL] wed 2/25 6pm - Implement Phase 3: Update shooter example to remove pool workarounds

[MILE] wed 2/25 8pm - Removed pool workarounds from top-down shooter example after engine-level NodePool and Actor.move() fixes

[ASKS] wed 2/25 8pm - Investigate the recurring collision detection footgun where nothing collides correctly on first implementation pass

[MILE] wed 2/25 8pm - Added space shooter example game with pooled bullets, wave spawning, enemy recycling, and collision routing

[IMPL] wed 2/25 9pm - Add sound effects and animated explosions to space shooter using CC0 SFX and Kenney smoke particles with size-matched hit/destroy effects

[MILE] wed 2/25 10pm - Added SFX, animated explosions, and convex polygon hitboxes to the space shooter example

[MILE] wed 2/25 10pm - Made collisionGroup and solid forced-choice with clear registration errors to prevent silent collision failures

[IMPL] wed 2/25 10pm - Implement Phase 5 Tower Defense example game from PHASE_9_DESIGN.md

[MILE] wed 2/25 11pm - Added tower defense example game with grid-based placement, waypoint enemies, three tower types, wave manager, and 29 integration tests

[IMPL] wed 2/25 11pm - Add the tower defense game to the examples page

[MILE] thu 2/26 12pm - Fixed tower defense UI with click-to-place, visual tower selection buttons, and corrected basic creep sprite

[IMPL] thu 2/26 12pm - Implement Phase 6 Sokoban puzzle game with grid-based movement, undo system, and level progression

[MILE] thu 2/26 1pm - Added Sokoban puzzle game with pure grid logic, 5 levels, undo/reset, level select, and 39 tests

[IMPL] thu 2/26 1pm - Debug and fix the qdbg screenshot command which is not working correctly

[MILE] thu 2/26 1pm - Fixed qdbg screenshot command by replacing broken require('fs') with Playwright native canvas capture

[MILE] thu 2/26 3pm - Fixed Sokoban visual bugs (wrong tile frames, position offset) and replaced unsolvable levels 3 and 5 with BFS-verified solvable designs

[IMPL] thu 2/26 3pm - Implement Phase 7: Cross-game review and prefabs proposal

[IMPL] thu 2/26 3pm - Add gamepad support and audio effects to the Sokoban game using CC0 sound effects
