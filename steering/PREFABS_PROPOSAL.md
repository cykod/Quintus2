# Game Utilities & Example Polish Plan

> **Purpose:** Add 4 core game utilities to the engine, then systematically polish each example game to integrate them, improve edge-case testing, and strengthen code comments — making the examples the definitive pattern library for LLMs and developers.
>
> **Rationale:** The original 31-prefab proposal was reviewed and deemed over-specified. Most proposed prefabs were 15–80 line wrappers around existing engine primitives. The 7 example games already score 8.5–9.5/10 for LLM pattern extraction. Instead of a large abstraction layer, we invest in 4 utilities that fill genuine gaps, then make the examples rock-solid.

---

## Table of Contents

1. [Decision Record](#1-decision-record)
2. [Core Game Utilities (4 new additions)](#2-core-game-utilities)
3. [Game Polish Phases](#3-game-polish-phases)
4. [Implementation Order](#4-implementation-order)

---

## 1. Decision Record

### What We're Building

4 engine-level utilities in `@quintus/ai-prefabs` that fill real gaps:

| Utility | Why It Belongs in the Engine |
|---------|------------------------------|
| **Damageable** | Duplicated in 4 games with subtle variation. Invincibility timing, death signaling, and health tracking are error-prone to reimplement. |
| **Bullet** | 4 near-identical pooled projectile classes across 2 games. Directional movement + lifetime + auto-recycle is boilerplate-heavy. |
| **WaveSpawner** | 3 implementations across games. Signal-based spawn orchestration is non-obvious to design correctly. |
| **Pickup** | Common collect-animate-destroy pattern across 5 games. The bob + pop + signal + self-destruct sequence is easy to get subtly wrong. |

### What We're NOT Building

The remaining 27 prefabs from the original proposal. Specifically:

- **3 Player classes** — Too opinionated. 30 lines of game-specific code is better than learning a parameterized class.
- **7 Enemy classes** — Mix-and-match behavior doesn't map to fixed class hierarchies. Examples show the patterns clearly.
- **2 Specialized projectiles** (HomingProjectile, BouncingBall) — Game-specific. One appearance each.
- **3 Pickup subclasses** — Trivial extensions of the Pickup base. Examples show the pattern.
- **4 Environment prefabs** — BoundaryWalls is 15 lines. DamageZone is 10 lines. Not worth abstracting.
- **5 System prefabs** (TimedBuffManager, GridPlacement, Starfield, BulletManager) — Each appears in 1–2 games. Better as example code.
- **3 UI prefabs** (GameHUD, MenuScene, GameOverScene) — Every game needs different layouts. A template is more constraining than helpful.

### What We're Polishing Instead

Each example game gets a dedicated polish phase:
- Integrate the 4 core utilities where they reduce duplication
- Add edge-case tests for untested scenarios
- Add code comments at architectural decision points
- Ensure every game is a clear, extractable reference for its genre

---

## 2. Core Game Utilities

All 4 utilities live in `packages/ai-prefabs/src/` and are exported from `@quintus/ai-prefabs`.

### 2.1 Damageable — Health, Damage, and Invincibility Mixin

The most duplicated pattern across all games. Every implementation has the same structure with subtle bugs around invincibility timing and death-during-invincibility edge cases.

```typescript
// Usage: compose with any Actor subclass
class MyEnemy extends Damageable(Actor, { maxHealth: 3 }) { ... }
class MyPlayer extends Damageable(Actor, { maxHealth: 5, invincibilityDuration: 2 }) { ... }
```

**API:**

```typescript
interface DamageableConfig {
	maxHealth: number;              // default: 3
	invincibilityDuration: number;  // default: 1.5 (seconds, 0 = no invincibility)
	deathTween: boolean;            // default: true (shrink + fade on death)
}

function Damageable<T extends Constructor<Actor>>(Base: T, config?: Partial<DamageableConfig>) {
	return class extends Base {
		health: number;
		maxHealth: number;

		readonly damaged = signal<number>();   // emits damage amount
		readonly died = signal<void>();

		takeDamage(amount: number): void;   // respects invincibility, emits damaged/died
		heal(amount: number): void;         // clamps to maxHealth
		isInvincible(): boolean;
		isDead(): boolean;
	};
}
```

**What it handles that games currently get wrong or inconsistent:**
- Invincibility window after damage (prevents double-hit in same frame)
- Death check only fires once (no re-entrant death)
- Optional death tween (shrink + fade → destroy) with signal emission before animation
- `heal()` clamped to maxHealth
- Reset-friendly for pooling (`_poolReset` restores health + clears invincibility)

**Tests (~15):**
- Take damage reduces health, emits `damaged`
- Die at 0 health, emits `died`
- Invincibility prevents damage during window
- Invincibility expires after duration
- No invincibility when duration = 0
- Heal clamps to maxHealth
- Heal does not trigger on dead entity
- Death tween plays when enabled
- No death tween when disabled
- Pool reset restores full health
- Cannot take damage when already dead
- Multiple damage in same frame (only first applies during invincibility)
- Mixin composes with Actor subclasses
- Mixin composes with poolable classes
- Signals disconnect on destroy

---

### 2.2 Bullet — Pooled Directional Projectile

4 near-identical classes exist across Space Shooter and Top-Down Shooter. The pool lifecycle + lifetime tracking + collision group setup is error-prone boilerplate.

```typescript
// Usage
const pool = new NodePool(Bullet, 100);
const b = pool.acquire();
b.fire(position, angle, { speed: 400, damage: 25, lifetime: 3 });
scene.add(b);
```

**API:**

```typescript
class Bullet extends Actor implements Poolable {
	speed: number;       // default: 400
	damage: number;      // default: 25
	lifetime: number;    // default: 3 (seconds, 0 = infinite)
	group: string;       // collision group (set before adding to scene)

	readonly hit = signal<CollisionObject>();  // emitted on collision

	fire(position: Vec2, angle: number, overrides?: Partial<BulletConfig>): void;
	reset(): void;       // Poolable — restores defaults
}
```

**What it handles:**
- Directional movement at configurable speed and angle
- Lifetime countdown with auto-destroy/release
- Collision group assignment for player vs. enemy bullets
- `hit` signal emitted on first collision, then auto-recycles
- Off-screen detection (auto-recycles when outside game bounds)
- Pool-friendly: `reset()` clears velocity, position, lifetime

**Tests (~12):**
- Fires in correct direction at correct speed
- Lifetime countdown destroys bullet
- Lifetime 0 means no auto-destroy
- Collision emits `hit` signal
- Auto-recycles after hit
- Off-screen detection recycles bullet
- Pool acquire/release lifecycle
- `fire()` overrides apply correctly
- Collision group is respected
- Multiple bullets in pool don't interfere
- Reset clears all state
- Works with both NodePool and manual add/destroy

---

### 2.3 WaveSpawner — Signal-Driven Wave Orchestration

3 implementations exist (Space Shooter, Tower Defense, Top-Down Shooter). The signal-based design — where the spawner emits requests rather than creating entities — is architecturally non-obvious but critical for decoupling.

```typescript
// Usage: define waves, connect spawn signal, start
const spawner = scene.add(WaveSpawner);
spawner.defineWaves([
	[{ type: "zombie", count: 5 }, { type: "robot", count: 2 }],
	[{ type: "zombie", count: 8 }, { type: "soldier", count: 3 }],
]);
spawner.spawnRequested.connect(({ type, wave, index }) => {
	// Scene creates the actual entity — spawner stays decoupled
	const enemy = createEnemy(type);
	scene.add(enemy);
});
spawner.start();
```

**API:**

```typescript
interface WaveEntry {
	type: string;        // entity type name (opaque to WaveSpawner)
	count: number;       // how many to spawn
	delay?: number;      // override spawn interval for this entry
}

class WaveSpawner extends Node {
	spawnInterval: number;    // default: 0.6 (seconds between spawns)
	wavePause: number;        // default: 2.0 (seconds between waves)
	autoStart: boolean;       // default: false

	readonly spawnRequested = signal<{ type: string; wave: number; index: number }>();
	readonly waveStarted = signal<number>();    // wave number (0-indexed)
	readonly waveCleared = signal<number>();    // wave number
	readonly allCleared = signal<void>();

	currentWave: number;
	totalWaves: number;
	activeCount: number;      // entities still alive in current wave

	defineWaves(waves: WaveEntry[][]): void;
	start(): void;
	notifyDeath(): void;      // call when a spawned entity dies
	isComplete(): boolean;
}
```

**Key design decision:** WaveSpawner emits `spawnRequested` signals rather than instantiating entities. The scene connects the signal and creates the appropriate class. This keeps WaveSpawner completely decoupled from entity types.

**What it handles:**
- Timed spawn intervals within a wave
- Pause between waves (configurable)
- Wave progression: next wave starts when all entities from current wave are dead
- `notifyDeath()` tracking for wave-clear detection
- `allCleared` signal when final wave is complete
- Per-entry delay overrides (e.g., boss spawns after a longer pause)

**Tests (~14):**
- Emits `waveStarted` at beginning of each wave
- Spawns at correct interval
- Pauses between waves
- `notifyDeath` decrements active count
- Wave clears when all entities dead
- `allCleared` fires after final wave
- Per-entry delay override works
- `autoStart` begins on ready
- Manual `start()` works
- Can define waves after construction
- Empty wave array doesn't crash
- Single-entry wave works
- activeCount is accurate
- `isComplete()` returns correctly at each stage

---

### 2.4 Pickup — Collectible Sensor with Animation

The collect-animate-destroy sequence appears in 5 games with the same pattern: bob idle animation → overlap detection → pop/fade tween → signal → self-destruct. Getting the tween timing and destruction ordering right is fiddly.

```typescript
// Usage: extend for custom collect behavior
class Coin extends Pickup {
	override onCollect(collector: Actor) {
		gameState.score += 10;
		this.game.audio.play("coin", { bus: "sfx" });
	}
}
```

**API:**

```typescript
class Pickup extends Sensor {
	collectTag: string;      // default: "player" — tag of collecting entity
	bobAmount: number;       // default: 4 (px, vertical oscillation, 0 = disabled)
	bobSpeed: number;        // default: 0.8 (seconds per cycle)
	popScale: number;        // default: 1.8 (scale-up on collect, 0 = no animation)
	popDuration: number;     // default: 0.2 (seconds)

	readonly collected = signal<Actor>();   // the collecting entity

	protected onCollect(collector: Actor): void;  // override for custom effect
}
```

**What it handles:**
- Idle bob animation (sine wave vertical oscillation)
- Overlap detection filtered by tag
- Collect-once guard (prevents double-collection in same frame)
- Pop-up scale + fade-out tween on collection
- `collected` signal emission (before animation, so listeners get it immediately)
- `onCollect()` hook for subclass behavior (score, health, power-up, etc.)
- Self-destruction after pop animation completes
- Pool-compatible: can implement `Poolable` in subclasses

**Tests (~10):**
- Collecting entity must have correct tag
- Non-matching tag doesn't collect
- `onCollect` called with collector reference
- `collected` signal emits
- Bob animation oscillates position
- Bob disabled when amount = 0
- Pop animation plays on collect
- Entity destroyed after pop completes
- Double-collection prevented
- Works without tween plugin (graceful fallback)

---

## 3. Game Polish Phases

Each game gets a dedicated phase. Every phase follows the same structure:

1. **Integrate utilities** — Replace hand-rolled health/damage, bullets, waves, and pickups with the 4 core utilities where they apply
2. **Edge-case testing** — Add tests for scenarios that aren't covered
3. **Code comments** — Add comments at architectural decision points (not obvious code)
4. **Review pass** — Ensure the game reads as a clear genre reference

### Phase A: Platformer Polish

**Utility integration:**
- `Damageable` mixin on Player (replaces hand-rolled `takeDamage` + invincibility blink)
- `Damageable` mixin on PatrolEnemy and FlyingEnemy (health + death signal)
- `Pickup` base for Coin (ScorePickup) and HealthPickup
- No bullets or waves in this game

**Edge-case tests to add:**
- Double-jump while falling off edge (coyote time interaction)
- Enemy stomped during player invincibility
- Health pickup when already at max health
- Spike damage during invincibility frames
- Level exit during damage animation
- Coin collection during death sequence
- Multiple enemies stomped in rapid succession

**Comment targets:**
- Coyote time implementation in Player
- Edge detection logic in PatrolEnemy
- Sine-wave calculation in FlyingEnemy
- Scene transition lifecycle in LevelExit

---

### Phase B: Dungeon Polish

**Utility integration:**
- `Damageable` mixin on Player (replaces health/invincibility/death)
- `Damageable` mixin on BaseEnemy / Dwarf / Barbarian
- `Pickup` base for HealthPickup and PotionPickup

**Edge-case tests to add:**
- Attack during knockback animation
- Shield block while moving
- Equipment persistence across scene transitions
- Buff expiration during combat
- Chest loot when inventory is full
- Door interaction without key
- Enemy attack during their hurt state
- Multiple enemies attacking same frame

**Comment targets:**
- State machine transitions in BaseEnemy (patrol → chase → attack → hurt)
- Knockback physics calculation
- Equipment attachment positioning (EquippedWeapon/Shield child node offset)
- Buff timer tick logic in BuffManager

---

### Phase C: Breakout Polish

**Utility integration:**
- `Pickup` base for PowerUp (FallingPickup pattern)
- No Damageable (bricks use a different damage model — type-based health)
- No bullets or waves

**Edge-case tests to add:**
- Ball hitting corner where two bricks meet
- Ball hitting paddle edge at extreme angle
- Multi-ball: all balls lost simultaneously
- Power-up collection while paddle is in wide mode
- Speed power-up combined with multi-ball
- Ball trapped in narrow gap between bricks
- Level clear with power-up still falling

**Comment targets:**
- Ball reflection math (dot product reflection + paddle angle mapping)
- Multi-bounce-per-frame resolution loop
- Power-up state management (which stack, which replace)
- Ball attachment-to-paddle state machine

---

### Phase D: Space Shooter Polish

**Utility integration:**
- `Damageable` mixin on Player (replaces hand-rolled shield/health)
- `Damageable` mixin on all enemy types (BasicEnemy, WeaverEnemy, BomberEnemy, Boss)
- `Bullet` class replaces PlayerBullet and EnemyBullet (2 classes → 1 configured differently)
- `WaveSpawner` replaces inline wave logic
- `Pickup` base for PowerUp

**Edge-case tests to add:**
- Boss defeat during spread-fire pattern
- Power-up collection during invincibility
- Bullet pool exhaustion (all 100 bullets active)
- Enemy spawning off-screen boundary
- Spread shot bullets — each should have independent collision
- Shield power-up while already shielded (extend vs. reset)
- Wave clear with enemies still off-screen

**Comment targets:**
- Spread shot angle calculation
- Boss attack pattern state machine
- Power-up timed buff implementation
- Starfield parallax layer speed calculation

---

### Phase E: Sokoban Polish

**Utility integration:**
- None — Sokoban uses no physics, no health, no bullets, no pickups. This is by design; it demonstrates the engine's flexibility for non-action games.

**Edge-case tests to add:**
- Push crate into corner (permanently stuck)
- Push crate onto target, then push it off
- Undo after pushing crate onto target (target state reverts)
- Undo at move 0 (no-op)
- Level complete detection with crates on wrong targets
- Rapid input during tween animation
- Level select with partially completed levels

**Comment targets:**
- `SokobanGrid` is pure logic with zero engine dependency — explain why
- `tryMove` return value semantics
- Undo stack design (MoveRecord)
- Grid-to-pixel coordinate mapping

---

### Phase F: Top-Down Shooter Polish

**Utility integration:**
- `Damageable` mixin on Player (replaces hand-rolled health/invincibility)
- `Damageable` mixin on BaseEnemy / Zombie / Robot / Soldier
- `Bullet` class replaces PlayerBullet and EnemyBullet
- `WaveSpawner` replaces EnemyManager wave logic
- `Pickup` base for WeaponPickup

**Edge-case tests to add:**
- Weapon switch during firing cooldown
- Ammo depletion mid-burst (Soldier enemy)
- Mouse aim at exact center of player (atan2 edge case)
- Enemy spawn at screen edge collision
- Weapon pickup collection while switching weapons
- Multiple enemies dying same frame (score accumulation)
- Pool exhaustion: all enemy slots filled

**Comment targets:**
- Mouse aim rotation calculation (`atan2`)
- Weapon definition config pattern (`WeaponDef` interface)
- Enemy pool management across types
- Muzzle flash lifecycle (pooled visual effect)

---

### Phase G: Tower Defense Polish (LAST — separate overhaul)

**Note:** This phase is intentionally last. The tower defense game is being overhauled separately and should be integrated after the other games are polished.

**Utility integration:**
- `Damageable` mixin on PathFollower / creep types (BasicCreep, FastCreep, TankCreep)
- `WaveSpawner` replaces WaveManager (or the existing WaveManager is updated to match the new API)
- `Pickup` base if any drop mechanics are added during overhaul
- `Bullet` is not a natural fit here — tower projectiles are homing, not directional

**Edge-case tests to add:**
- Tower placement blocking the only path
- Slow effect stacking from multiple SlowTowers
- Enemy reaching exit during wave transition
- Tower targeting when multiple enemies equidistant
- Wave spawn while previous wave enemies still alive
- Gold insufficient for cheapest tower
- Projectile target dies before projectile arrives

**Comment targets:**
- Waypoint pathfinding and interpolation
- Tower targeting algorithm (closest-to-exit)
- Grid placement validation logic
- Projectile homing math
- Wave scaling formula

---

## 4. Implementation Order

### Phase 0: Core Utilities (implement all 4)

| Step | What | Est. Lines | Depends On |
|------|------|-----------|------------|
| 0.1 | `Damageable` mixin + tests | ~120 + ~150 | Nothing |
| 0.2 | `Bullet` pooled projectile + tests | ~80 + ~120 | Nothing |
| 0.3 | `WaveSpawner` + tests | ~130 + ~160 | Nothing |
| 0.4 | `Pickup` base sensor + tests | ~90 + ~120 | Nothing |
| 0.5 | Package setup, exports, build | ~30 | 0.1–0.4 |

All 4 utilities are independent and could be built in parallel. Package total: ~450 source lines + ~550 test lines.

### Phases A–G: Game Polish (sequential)

| Phase | Game | Key Integrations | Order Rationale |
|-------|------|-----------------|-----------------|
| **A** | Platformer | Damageable, Pickup | Simplest game, good first integration test |
| **B** | Dungeon | Damageable, Pickup | Most complex game, exercises Damageable deeply |
| **C** | Breakout | Pickup | Minimal integration, mostly edge-case testing |
| **D** | Space Shooter | All 4 utilities | Heaviest integration — Damageable, Bullet, WaveSpawner, Pickup |
| **E** | Sokoban | None | No utility integration, purely tests + comments |
| **F** | Top-Down Shooter | All 4 utilities | Second-heaviest integration, validates Bullet + WaveSpawner patterns |
| **G** | Tower Defense | Damageable, WaveSpawner | Last — awaiting separate overhaul |

### Definition of Done

Each phase is complete when:

1. Utilities are integrated (where applicable) and hand-rolled versions removed
2. All new edge-case tests pass
3. All existing tests still pass
4. Code comments added at documented decision points
5. Game is playable end-to-end via `pnpm dev`
6. `pnpm test` passes for the game's test suite

---

## Appendix: Utility Coverage by Game

| Utility | Platformer | Dungeon | Breakout | Space Shooter | Sokoban | Top-Down Shooter | Tower Defense |
|---------|:----------:|:-------:|:--------:|:-------------:|:-------:|:----------------:|:-------------:|
| Damageable | x | x | | x | | x | x |
| Bullet | | | | x | | x | |
| WaveSpawner | | | | x | | x | x |
| Pickup | x | x | x | x | | x | |

**Coverage:** 5 of 7 games use at least one utility. Sokoban uses none (correct — it's a puzzle game). Tower Defense uses 2 (Damageable + WaveSpawner).
