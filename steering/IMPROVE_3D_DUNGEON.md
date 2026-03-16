# 3D Dungeon: Turn-Based Combat — Detailed Design

> **Goal:** Add enemies, a turn manager, and melee combat to the 3D dungeon example so it plays like a classic dungeon crawler.
> **Outcome:** The player takes turns (move, turn, attack) and enemies respond with their own movement/attacks. Combat uses a sword with a directional attack. Enemies move every 2 player turns.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Turn manager & action system | Done |
| 2 | Player sword attack | Done |
| 3 | Enemy entity & AI | Done |
| 4 | Combat resolution & damage | Done |
| 5 | Level design & HUD updates | Done |
| 6 | Tests | Done |
| 7 | Sound effects | Done |

---

## Overview

The game currently has implicit turns — the player presses a key, an animation plays, and tiles are checked. This design formalizes that into a **Turn Manager** that coordinates player actions and enemy responses. Each player action (move, turn, attack) counts as one turn. Enemies act every 2nd player turn.

### Turn Flow

```
Player Input → Player Animation → Enemy Turn → Enemy Animation → Idle (await input)
                                   (only on even turns)
```

### Scene Tree (updated)

```
Scene (Level1)
├── DungeonGrid
├── TurnManager (Node)                   ← NEW
├── PlayerCharacter (GLTFModel)
│   ├── Camera3D
│   └── SwordModel (GLTFModel)           ← NEW (child, attached to hand)
├── Enemy (GLTFModel) ×N                 ← NEW
├── CoinItem ×N
├── TrapTile ×N
├── ExitStairs
├── AmbientLight
├── DirectionalLight
└── HUD
    ├── ScoreLabel
    ├── HealthLabel
    ├── LevelLabel
    └── TurnLabel                         ← NEW
```

---

## Phase 1: Turn Manager & Action System

The TurnManager is a Node that owns the turn lifecycle. It prevents player input during enemy turns and tracks the global turn counter.

- [ ] Create `entities/turn-manager.ts` with `TurnManager` class extending `Node`
- [ ] Add `turnCount` (number, starts at 0) and `phase` enum: `PlayerInput | PlayerAnim | EnemyTurn | EnemyAnim`
- [ ] Add signals: `playerTurnComplete`, `enemyTurnStart`, `enemyTurnComplete`, `turnComplete`
- [ ] Expose `isPlayerInputAllowed(): boolean` — true only when `phase === PlayerInput`
- [ ] Expose `commitPlayerAction()` — called by player after starting an action; increments `turnCount`, transitions to `PlayerAnim`
- [ ] Expose `playerAnimDone()` — called when player animation finishes; decides whether to run enemy turn (even turns) or go back to `PlayerInput`
- [ ] Expose `enemyAnimDone()` — transitions back to `PlayerInput`
- [ ] Add `ENEMY_TURN_INTERVAL = 2` to `config.ts`
- [ ] Modify `PlayerCharacter` to check `turnManager.isPlayerInputAllowed()` before accepting input
- [ ] Modify `PlayerCharacter` to call `turnManager.commitPlayerAction()` at start of move/turn/attack
- [ ] Modify `PlayerCharacter` to call `turnManager.playerAnimDone()` when animation completes
- [ ] Wire `TurnManager` into `DungeonLevel.onReady()` — add to scene, pass to player

### TurnManager Interface

```typescript
// entities/turn-manager.ts
import { Node, signal } from "@quintus/core";
import { ENEMY_TURN_INTERVAL } from "../config.js";

export enum TurnPhase {
	PlayerInput = "player-input",
	PlayerAnim = "player-anim",
	EnemyTurn = "enemy-turn",
	EnemyAnim = "enemy-anim",
}

export class TurnManager extends Node {
	turnCount = 0;
	phase = TurnPhase.PlayerInput;

	readonly playerTurnComplete = signal<number>(); // emits turnCount
	readonly enemyTurnStart = signal<void>();
	readonly enemyTurnComplete = signal<void>();

	isPlayerInputAllowed(): boolean {
		return this.phase === TurnPhase.PlayerInput;
	}

	commitPlayerAction(): void {
		this.turnCount++;
		this.phase = TurnPhase.PlayerAnim;
	}

	playerAnimDone(): void {
		this.playerTurnComplete.emit(this.turnCount);

		if (this.turnCount % ENEMY_TURN_INTERVAL === 0) {
			this.phase = TurnPhase.EnemyTurn;
			this.enemyTurnStart.emit();
			// Enemies listen and act, then call enemyAnimDone()
		} else {
			this.phase = TurnPhase.PlayerInput;
		}
	}

	enemyAnimDone(): void {
		this.phase = TurnPhase.PlayerInput;
		this.enemyTurnComplete.emit();
	}
}
```

### Player Modifications

The key changes to `PlayerCharacter`:

```typescript
// In onFixedUpdate, guard input:
if (!this.turnManager.isPlayerInputAllowed()) return;

// In _startTurn / _startMove, signal the turn:
this.turnManager.commitPlayerAction();

// When move/turn animation completes (t >= 1):
this.turnManager.playerAnimDone();
```

---

## Phase 2: Player Sword Attack

The player can attack the tile directly in front of them. Attack costs 1 turn. Uses the existing `interact` input action (E / Space / gamepad:a).

- [ ] Add `ATTACK_DURATION = 0.25` to `config.ts` (sword swing time)
- [ ] Add `PLAYER_ATTACK_DAMAGE = 1` to `config.ts`
- [ ] Add `_attacking` state to `PlayerCharacter` (mutually exclusive with `_moving` and `_turning`)
- [ ] Add `_attackElapsed` timer, similar to move/turn
- [ ] Handle `interact` input in `onFixedUpdate` → calls `_startAttack()`
- [ ] `_startAttack()`: calculate target tile (grid cell in front of player), emit `attacked` signal with `{ gridX, gridZ }`, start attack animation
- [ ] Add `readonly attacked = signal<{ gridX: number; gridZ: number }>()` to `PlayerCharacter`
- [ ] During attack animation: play "attack" anim if available, otherwise tilt/thrust the model briefly
- [ ] After attack completes: call `turnManager.playerAnimDone()`
- [ ] Add sword visual: child `GLTFModel` or simple `MeshNode` (box geometry) parented to player
- [ ] Sword visual: small rectangular mesh, positioned at player's right side, hidden by default, visible during attack with rotation animation

### Sword Visual (simple approach — no extra model needed)

```typescript
// In PlayerCharacter.onReady():
const sword = new THREE.Mesh(
	new THREE.BoxGeometry(0.08, 0.5, 0.08),
	new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 })
);
sword.position.set(0.3, 0.5, -0.3); // right side, forward
sword.visible = false;
this.object3d.add(sword);
this._swordMesh = sword;
```

During attack animation, make sword visible and rotate it forward (a quick 90-degree arc over `ATTACK_DURATION`).

### Attack Flow

```
Player presses interact →
  Calculate target tile (gridX + DIR_DX[facing], gridZ + DIR_DZ[facing]) →
  commitPlayerAction() →
  Show sword, play swing animation →
  Emit attacked({ gridX, gridZ }) →
  After ATTACK_DURATION: hide sword, playerAnimDone()
```

The `attacked` signal is consumed by the DungeonLevel to check if an enemy occupies the target tile.

---

## Phase 3: Enemy Entity & AI

Enemies are grid-based GLTFModel nodes with simple AI. They use the existing `barrel.glb` model (re-skinned as an enemy — it's available and unused).

- [ ] Create `entities/enemy.ts` with `Enemy` class extending `GLTFModel`
- [ ] Properties: `gridX`, `gridZ`, `health` (default 2), `maxHealth`, `damage` (default 1)
- [ ] Add `readonly died = signal<Enemy>()`
- [ ] Add `readonly attackedPlayer = signal<Enemy>()`
- [ ] Add `takeTurn(grid: DungeonGrid, playerX: number, playerZ: number): EnemyAction` — AI decision
- [ ] Add `executeAction(action: EnemyAction)` — starts animation for chosen action
- [ ] Add animation states: `_moving` (same lerp pattern as player), `_attacking`
- [ ] Add `takeDamage(amount: number)` — decrements health, emits `died` if <= 0
- [ ] Add `ENEMY_HEALTH = 2` and `ENEMY_DAMAGE = 1` to `config.ts`
- [ ] Add `ENEMY_MOVE_DURATION = 0.3` to `config.ts` (slightly slower than player)
- [ ] Add `ENEMY_ATTACK_DURATION = 0.3` to `config.ts`
- [ ] Add `'G'` (goblin) character to `CHAR_MAP` in `dungeon-grid.ts` (maps to `TILE_FLOOR`)
- [ ] Add enemy placement in `DungeonLevel.onReady()` — find all `'G'` chars, create `Enemy` nodes

### Enemy AI

Simple AI with two behaviors:
1. **Adjacent to player** → Attack (face player, swing)
2. **Not adjacent** → Move one step toward player (Manhattan distance greedy, avoiding walls and other enemies)

```typescript
type EnemyAction =
	| { type: "idle" }
	| { type: "move"; targetX: number; targetZ: number }
	| { type: "attack"; targetX: number; targetZ: number };

takeTurn(grid: DungeonGrid, playerX: number, playerZ: number): EnemyAction {
	const dx = playerX - this.gridX;
	const dz = playerZ - this.gridZ;

	// Adjacent? (Manhattan distance = 1)
	if (Math.abs(dx) + Math.abs(dz) === 1) {
		return { type: "attack", targetX: playerX, targetZ: playerZ };
	}

	// Move toward player — try the axis with larger distance first
	const candidates: Array<{ x: number; z: number; dist: number }> = [];
	for (let i = 0; i < 4; i++) {
		const nx = this.gridX + DIR_DX[i];
		const nz = this.gridZ + DIR_DZ[i];
		if (grid.isWalkable(nx, nz) && !grid.isOccupied(nx, nz)) {
			const dist = Math.abs(playerX - nx) + Math.abs(playerZ - nz);
			candidates.push({ x: nx, z: nz, dist });
		}
	}

	if (candidates.length === 0) return { type: "idle" };

	candidates.sort((a, b) => a.dist - b.dist);
	return { type: "move", targetX: candidates[0].x, targetZ: candidates[0].z };
}
```

### Occupancy Tracking

`DungeonGrid` needs to know which tiles are occupied by enemies (to prevent stacking):

- [ ] Add `isOccupied(gx, gz): boolean` to `DungeonGrid` — checks if any enemy is at that position
- [ ] Add `enemies: Set<Enemy>` to `DungeonGrid` for occupancy queries
- [ ] `registerEnemy(enemy)` / `unregisterEnemy(enemy)` methods
- [ ] Also block player movement into enemy-occupied tiles (player must attack, not walk through)

### Enemy Visual

Use `barrel.glb` with a red-tinted material override to make it look hostile:

```typescript
export class Enemy extends GLTFModel {
	override src = "barrel"; // reuse barrel model as enemy placeholder
	override modelScale = 1;
}
```

Alternatively, if we want to be more creative, we can create a simple enemy from primitives (a sphere body + cone hat), but the barrel model is already loaded and works.

---

## Phase 4: Combat Resolution & Damage

Wire up the attack signals and enemy turn execution in `DungeonLevel`.

- [ ] In `DungeonLevel.onReady()`: connect `player.attacked` signal to check for enemies at target tile
- [ ] If enemy found at attacked tile: call `enemy.takeDamage(PLAYER_ATTACK_DAMAGE)`
- [ ] If enemy dies: increment score by `ENEMY_KILL_SCORE`, destroy enemy, unregister from grid
- [ ] Add `ENEMY_KILL_SCORE = 25` to `config.ts`
- [ ] Connect `turnManager.enemyTurnStart` to iterate all living enemies, call `takeTurn()`, then `executeAction()`
- [ ] Enemies execute sequentially (stagger animations) or simultaneously — simultaneous is simpler
- [ ] After all enemy animations complete: call `turnManager.enemyAnimDone()`
- [ ] Enemy attacks: when enemy action is `attack`, deal `ENEMY_DAMAGE` to player (reuse `_takeDamage` pattern)
- [ ] Player takes damage from enemy: reduce health, flash invincibility (but shorter — 0.3s since it's turn-based)

### Enemy Turn Orchestration

```typescript
// In DungeonLevel.onReady():
turnManager.enemyTurnStart.connect(() => {
	const livingEnemies = enemies.filter((e) => !e.isDestroyed);

	if (livingEnemies.length === 0) {
		turnManager.enemyAnimDone();
		return;
	}

	let completedCount = 0;
	for (const enemy of livingEnemies) {
		const action = enemy.takeTurn(grid, player.gridX, player.gridZ);
		enemy.executeAction(action);

		if (action.type === "attack") {
			// Damage player when attack animation plays
			player.takeDamageFrom(enemy);
		}
	}

	// Wait for all enemy animations to finish (use longest duration)
	// Simple approach: setTimeout-like with frame counting
	// Or: each enemy emits actionComplete, count them
});
```

### Animation Completion Tracking

Each enemy's `executeAction()` returns or emits when its animation is done. The simplest approach: track a counter in `DungeonLevel`:

```typescript
let pending = livingEnemies.length;
const onEnemyDone = () => {
	pending--;
	if (pending <= 0) {
		turnManager.enemyAnimDone();
	}
};
for (const enemy of livingEnemies) {
	const action = enemy.takeTurn(grid, player.gridX, player.gridZ);
	enemy.executeAction(action, onEnemyDone);
}
```

---

## Phase 5: Level Design & HUD Updates

Update level data with enemy placements and add combat info to the HUD.

- [ ] Update `LEVELS` in `config.ts` with `'G'` markers for enemy positions
- [ ] Level 1: 1 enemy (tutorial — learn to attack)
- [ ] Level 2: 2 enemies (corridor combat)
- [ ] Level 3: 3–4 enemies (tactical positioning required)
- [ ] Add turn counter display to HUD (`Turn: N`)
- [ ] Add combat log or flash text for hits ("Hit!" / "Ouch!" — simple Label that fades)
- [ ] Update `gameState` with `kills: 0` for tracking
- [ ] Connect `turnManager.turnComplete` or `playerTurnComplete` to update HUD turn counter

### Updated Level Data

```typescript
export const LEVELS: string[][] = [
	// Level 1 (8×8) — 1 enemy guarding the exit
	[
		"########",
		"#P....E#",
		"#..C...#",
		"#......#",
		"#...T..#",
		"#......#",
		"#..G.C.#",
		"########",
	],
	// Level 2 (10×10) — 2 enemies in corridors
	[
		"##########",
		"#P.......#",
		"#..##.C..#",
		"#..##..G.#",
		"#...T....#",
		"#....##..#",
		"#.C..##.E#",
		"#..G.....#",
		"##########",
	],
	// Level 3 (12×12) — 3 enemies, maze combat
	[
		"############",
		"#P.........#",
		"#..###..C..#",
		"#..#.T..#..#",
		"#..G.C..#..#",
		"#.####.....#",
		"#......T.G.#",
		"#..##.##...#",
		"#..##....G.#",
		"#.....C..T.#",
		"#.........E#",
		"############",
	],
];
```

### HUD Updates

```typescript
// In hud.ts, add turn counter:
const turnLabel = this.add(Label, { text: "Turn: 0" });
turnLabel.position = new Vec2(GAME_WIDTH - 120, 10);

// Connect to turn manager (passed via game state or direct reference)
gameState.onChange("turn", (val) => {
	turnLabel.text = `Turn: ${val}`;
});
```

Add `turn: 0` and `kills: 0` to `gameState` in `state.ts`:

```typescript
export const gameState = reactiveState({
	score: 0,
	health: 3,
	maxHealth: 3,
	level: 1,
	turn: 0,
	kills: 0,
});
```

---

## Phase 6: Tests

Tests for the turn system, combat, and enemy AI. All tests go in `examples/3d-dungeon/__tests__/`.

- [ ] Create `__tests__/combat.test.ts` for turn-based combat integration tests
- [ ] Create `__tests__/enemy.test.ts` for enemy AI unit tests
- [ ] Update `__tests__/player.test.ts` with attack tests

### Test: Turn Manager

```typescript
// combat.test.ts
// Test level with player and one enemy adjacent
const COMBAT_LEVEL = ["#####", "#PG.#", "#...#", "#####"];

it("turn counter increments on player action", ...);
it("enemy does not act on odd turns", ...);
it("enemy acts on even turns", ...);
it("player cannot input during enemy turn", ...);
```

### Test: Player Attack

```typescript
// player.test.ts additions
it("attack hits enemy in front tile", async () => {
	// Player faces east, enemy at (2,1)
	// Tap interact → enemy takes damage
	const input = InputScript.create()
		.tap("turn_left", 1).wait(12) // face east
		.tap("interact", 1).wait(18);
	// Verify enemy health reduced
});

it("attack misses when no enemy in front", async () => {
	// Player faces south, no enemy there
	const input = InputScript.create()
		.tap("interact", 1).wait(18);
	// No damage dealt, turn still consumed
});
```

### Test: Enemy AI

```typescript
// enemy.test.ts
it("enemy attacks when adjacent to player", ...);
it("enemy moves toward player when not adjacent", ...);
it("enemy does not walk through walls", ...);
it("enemy does not stack on other enemies", ...);
it("enemy dies after taking enough damage", ...);
it("dead enemy does not act on enemy turn", ...);
```

### Test: Full Combat Flow

```typescript
it("player can kill enemy and reach exit", async () => {
	// Level: #PE# — player faces east, enemy at (2,1), exit at (3,1)?
	// Actually needs more space. Use a custom level.
	const KILL_LEVEL = ["######", "#P.GE#", "######"];
	// Move forward twice to approach, attack twice to kill, move to exit
});
```

---

## Phase 7: Sound Effects

Add audio feedback for combat and movement using the **Kenney RPG Audio** pack (`tmp/kenney_rpg-audio /Audio/`). Note: the source directory has a trailing space in its name.

### Sound Mapping

| Event | Sound File(s) | Notes |
|-------|--------------|-------|
| Player footstep | `footstep00.ogg` – `footstep09.ogg` | Random pick per step |
| Player sword swing | `drawKnife1.ogg` / `drawKnife2.ogg` / `drawKnife3.ogg` | Random pick on attack start |
| Sword hit (enemy takes damage) | `knifeSlice.ogg` / `knifeSlice2.ogg` | On `attacked` signal when enemy present |
| Enemy death | `chop.ogg` | On `enemy.died` |
| Enemy attack (player takes damage) | `metalPot1.ogg` / `metalPot2.ogg` | On `enemy.attackedPlayer` |
| Coin collect | `handleCoins.ogg` / `handleCoins2.ogg` | On `player.collected` |
| Door/exit open | `doorOpen_1.ogg` / `doorOpen_2.ogg` | On `player.reachedExit` |
| Trap trigger | `metalClick.ogg` | On trap damage |

### Implementation Steps

- [ ] Copy selected `.ogg` files to `examples/3d-dungeon/assets/audio/`
- [ ] Add audio paths to `assets.ts` (new `AUDIO_PATHS` array or extend existing asset loading)
- [ ] Add `AudioPlugin` to the game setup in `main.ts`
- [ ] Create `audio.ts` helper that exposes `playSound(name)` using the engine's `AudioPlayer`
- [ ] Wire sounds to signals in `dungeon-level.ts`:
  - `player.attacked` → sword swing + hit (if enemy at target)
  - `player.collected` → coin sound
  - `player.reachedExit` → door sound
  - `enemy.attackedPlayer` → enemy hit sound
  - `enemy.died` → death sound
- [ ] Play footstep sound in `PlayerCharacter._startMove()`
- [ ] Play trap sound in `PlayerCharacter._takeDamage()`
- [ ] Randomize variant sounds (e.g., pick random footstep) for variety

### Available Audio Files

Full listing from `tmp/kenney_rpg-audio /Audio/`:

```
beltHandle1.ogg       bookPlace2.ogg      clothBelt2.ogg     doorClose_4.ogg
beltHandle2.ogg       bookPlace3.ogg      doorClose_1.ogg    doorOpen_1.ogg
bookClose.ogg         chop.ogg            doorClose_2.ogg    doorOpen_2.ogg
bookFlip1.ogg         cloth1.ogg          doorClose_3.ogg    drawKnife1.ogg
bookFlip2.ogg         cloth2.ogg          dropLeather.ogg    drawKnife2.ogg
bookFlip3.ogg         cloth3.ogg          footstep00.ogg     drawKnife3.ogg
bookOpen.ogg          cloth4.ogg          footstep01.ogg     handleCoins.ogg
bookPlace1.ogg        clothBelt.ogg       footstep02.ogg     handleCoins2.ogg
creak1.ogg            footstep03.ogg      footstep07.ogg     knifeSlice.ogg
creak2.ogg            footstep04.ogg      footstep08.ogg     knifeSlice2.ogg
creak3.ogg            footstep05.ogg      footstep09.ogg     metalClick.ogg
handleSmallLeather.ogg  footstep06.ogg    metalLatch.ogg     metalPot1.ogg
handleSmallLeather2.ogg                   metalPot2.ogg      metalPot3.ogg
```

---

## Key Design Decisions

### Why a TurnManager node instead of inline logic?

Separating turn state from the player keeps the system testable and extensible. The turn manager is the single source of truth for "whose turn is it" and can be queried by any entity.

### Why enemies move every 2 turns?

This gives the player agency. In classic dungeon crawlers (Shiren, DCSS), enemies often move at the same rate as the player, but since our player needs to spend turns on turning (not just moving), enemies at 1:1 pacing would be oppressive. Every 2 turns means the player can turn to face an enemy and then attack before the enemy gets another move.

### Why Manhattan-greedy AI instead of pathfinding?

A* is overkill for the small levels (8-12 tiles wide). Greedy Manhattan movement toward the player creates predictable, learnable enemy behavior that's perfect for a dungeon crawler. Enemies can get stuck behind walls, which creates tactical opportunities.

### Why reuse barrel.glb?

The barrel model is already loaded (it's in `assets.ts`). Using it avoids adding new assets and keeps the asset footprint small. A red tint or simple material swap makes it visually distinct.

### Why not block player turns during invincibility?

Turn-based invincibility doesn't make sense the same way real-time invincibility does. Instead, enemy attacks simply deal damage on their turn. The invincibility visual (flashing) is kept as brief feedback only.

---

## File Summary

| File | Change |
|------|--------|
| `entities/turn-manager.ts` | **New** — TurnManager class |
| `entities/enemy.ts` | **New** — Enemy class with AI |
| `entities/player.ts` | **Modify** — add attack action, integrate TurnManager |
| `entities/dungeon-grid.ts` | **Modify** — add occupancy tracking, 'G' char mapping |
| `scenes/dungeon-level.ts` | **Modify** — wire enemies, combat signals, turn manager |
| `config.ts` | **Modify** — add combat constants, update level data |
| `state.ts` | **Modify** — add `turn`, `kills` fields |
| `hud/hud.ts` | **Modify** — add turn counter display |
| `assets.ts` | **Modify** — add character-orc.glb + audio paths |
| `audio.ts` | **New** — sound effect helper |
| `__tests__/combat.test.ts` | **New** — turn system integration tests |
| `__tests__/enemy.test.ts` | **New** — enemy AI tests |
| `__tests__/player.test.ts` | **Modify** — add attack tests |

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] Turn manager controls game flow — player cannot act during enemy turns
- [ ] Player can attack with sword (interact key) — costs 1 turn
- [ ] Enemies spawn from level data ('G' markers)
- [ ] Enemies move toward player every 2 turns
- [ ] Enemies attack when adjacent to player
- [ ] Enemies can be killed (2 hits)
- [ ] All 3 levels have enemy placements
- [ ] HUD shows turn counter
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (new + existing tests)
- [ ] `pnpm lint` clean
- [ ] Demo runs in browser via `pnpm dev`
- [ ] Sound effects play for footsteps, attacks, hits, coins, exits, traps, and enemy death
