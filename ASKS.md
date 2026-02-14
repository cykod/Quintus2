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
