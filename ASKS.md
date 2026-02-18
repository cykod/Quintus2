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
