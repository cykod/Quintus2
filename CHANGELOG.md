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
