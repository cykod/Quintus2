# 3D Dungeon Polish — Detailed Design

> **Goal:** Add visual juice, audio atmosphere, and gameplay improvements to the 3D dungeon crawler
> **Outcome:** The game *feels* great — hits land with weight, the dungeon is atmospheric, and transitions are smooth

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Camera shake on hit | Done |
| 2 | Blood/damage particles | Done |
| 3 | Enemy death animation | Done |
| 4 | Screen flash on damage | Done |
| 5 | Coin collect burst | Done |
| 6 | Footstep dust | Done |
| 7 | Health pickup | Done |
| 8 | Enemy hit stagger (red flash) | Done |
| 9 | Torch/light flicker | Done |
| 10 | Fog of war | Pending |
| 11 | Player death animation | Pending |
| 12 | Level transition effect | Pending |

---

## Phase 1: Camera Shake on Hit

Camera3D has no built-in shake. The camera lives under CameraOrbit, which lives under the player. We add a `CameraShake` node between CameraOrbit and Camera3D that applies random offset each frame.

- [ ] Create `examples/3d-dungeon/entities/camera-shake.ts`
- [ ] Wire shake triggers in `dungeon-level.ts`
- [ ] Write tests in `__tests__/camera-shake.test.ts`

### `CameraShake` (Node3D)

```typescript
// examples/3d-dungeon/entities/camera-shake.ts
import { Node3D } from "@quintus/three";

export class CameraShake extends Node3D {
	private _intensity = 0;
	private _decay = 0;
	private _timer = 0;

	/** Trigger a shake. intensity = max offset in world units, duration in seconds. */
	shake(intensity: number, duration: number): void {
		this._intensity = intensity;
		this._decay = intensity / duration;
		this._timer = duration;
	}

	override onFixedUpdate(dt: number): void {
		if (this._timer <= 0) return;

		this._timer -= dt;
		this._intensity = Math.max(0, this._intensity - this._decay * dt);

		const rx = (Math.random() - 0.5) * 2 * this._intensity;
		const ry = (Math.random() - 0.5) * 2 * this._intensity;
		const rz = (Math.random() - 0.5) * 2 * this._intensity;
		this.position.set(rx, ry, rz);

		if (this._timer <= 0) {
			this.position.set(0, 0, 0);
		}
	}
}
```

### Scene Tree Change

```
PlayerCharacter
└── CameraOrbit
    └── CameraShake          ← NEW
        └── Camera3D
```

### Wiring in `dungeon-level.ts`

```typescript
// Insert shake node between orbit and camera
const shake = orbit.add(CameraShake);
const cam = shake.add(Camera3D, { fov: 50 });

// Enemy attacks player → shake
enemy.attackedPlayer.connect(() => {
	shake.shake(0.08, 0.15);
});

// Trap damage → lighter shake
player._takeDamage  // (called internally, so we hook gameState instead)
gameState.on("health").connect(({ value, previous }) => {
	if (value < previous) shake.shake(0.06, 0.12);
});

// Player death → heavy shake
player.died.connect(() => {
	shake.shake(0.15, 0.3);
});
```

**Tuning values:**
| Event | Intensity | Duration |
|-------|-----------|----------|
| Enemy hit | 0.08 | 0.15s |
| Trap damage | 0.06 | 0.12s |
| Player death | 0.15 | 0.3s |

### Tests

**`__tests__/camera-shake.test.ts`:**
- `shake()` sets position offset during timer
- Position returns to (0,0,0) after duration expires
- Multiple shakes: latest shake overrides previous

---

## Phase 2: Blood/Damage Particles

Use `ParticleEmitter3D` from `@quintus/particles` for hit effects. Particles burst at the enemy's world position when the player lands a hit. Red particles spray in a hemisphere away from the player's attack direction.

- [ ] Add `@quintus/particles` dependency to example
- [ ] Create `examples/3d-dungeon/entities/effects.ts` with particle factory functions
- [ ] Spawn blood burst on enemy hit in `dungeon-level.ts`
- [ ] Spawn blood burst when player takes damage
- [ ] Write tests

### Particle Configs

```typescript
// examples/3d-dungeon/entities/effects.ts
import { ParticleEmitter3D } from "@quintus/particles";
import type { ParticleConfig3D } from "@quintus/particles";

/** Blood spray when an enemy is hit. Spawned at enemy position, oneShot. */
export const BLOOD_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 30,
	emissionRate: 0,        // burst only
	emissionShape3D: "point",
	initialSpeed: [60, 150],
	initialTheta: [0, 60],  // upward hemisphere
	initialPhi: [0, 360],
	gravityY: -200,         // fall quickly
	drag: 0.03,
	size: [2, 5],
	sizeOverLife: [1, 0],
	colorStart: "#cc0000",
	colorEnd: "#66000000",  // fade to transparent dark red
	blendMode: "normal",
	lifetime: [0.3, 0.6],
};

/** Spawn a blood burst at a world position, auto-destroys. */
export function spawnBloodBurst(parent: Node3D, x: number, y: number, z: number): void {
	const emitter = parent.add(ParticleEmitter3D, {
		config: BLOOD_BURST_CONFIG,
		oneShot: true,
		emitting: false,
	});
	emitter.position.set(x, y, z);
	emitter.burst(20);
}
```

### Wiring

```typescript
// dungeon-level.ts — on player hitting enemy
player.attacked.connect(({ gridX, gridZ }) => {
	const enemy = findEnemyAt(gridX, gridZ);
	if (enemy) {
		const pos = enemy.position;
		spawnBloodBurst(this, pos.x, 0.5, pos.z);
	}
});

// Enemy hits player — smaller burst at player position
enemy.attackedPlayer.connect(() => {
	spawnBloodBurst(this, player.position.x, 0.5, player.position.z);
});
```

### Tests

**`__tests__/effects.test.ts`:**
- Blood burst emitter is created as oneShot
- Emitter auto-destroys after particles expire
- Particle count is within expected range after burst

---

## Phase 3: Enemy Death Animation

Currently `enemy.destroy()` is called immediately on death. Instead, play a shrink + sink animation before destroying.

- [ ] Add death animation state to `Enemy`
- [ ] Delay `destroy()` until animation completes
- [ ] Spawn blood burst on death
- [ ] Write tests

### Implementation in `enemy.ts`

```typescript
// New state fields
private _dying = false;
private _deathElapsed = 0;
private _deathDuration = 0.5; // seconds

/** Begin death animation. Called instead of immediate destroy. */
playDeath(): void {
	this._dying = true;
	this._deathElapsed = 0;
	this._tryPlay("idle"); // freeze in idle pose
}

// In onFixedUpdate, add before existing animation logic:
if (this._dying) {
	this._deathElapsed += dt;
	const t = Math.min(this._deathElapsed / this._deathDuration, 1);
	// Shrink and sink into floor
	const scale = 1 - t;
	this.scale.set(scale, scale, scale);
	this.position.y = -t * 0.5; // sink down
	this.rotation.y += dt * 8;  // spin
	if (t >= 1) {
		this.destroy();
	}
	return;
}
```

### Scene Wiring Change

```typescript
// dungeon-level.ts — enemy.died handler
enemy.died.connect(() => {
	enemies.delete(enemy);
	grid.clearOccupied(enemy.gridX, enemy.gridZ);
	gameState.score += ENEMY_KILL_SCORE;
	gameState.kills++;
	this.game.audio.play(SFX.enemyDeath(), { bus: "sfx" });
	// Spawn death particles at enemy position before shrink
	spawnBloodBurst(this, enemy.position.x, 0.5, enemy.position.z);
	enemy.playDeath();  // replaces enemy.destroy()
});
```

### Tests

**`__tests__/enemy.test.ts` (additions):**
- `playDeath()` starts shrink animation
- Enemy scale decreases over time during death
- Enemy auto-destroys after death duration
- Enemy does not process AI while dying

---

## Phase 4: Screen Flash on Damage

A full-screen red overlay that flashes when the player takes damage. Uses a `Panel` on a fixed `Layer` with alpha animation.

- [ ] Create `examples/3d-dungeon/hud/damage-overlay.ts`
- [ ] Add to HUD or as sibling in `dungeon-level.ts`
- [ ] Wire to damage events
- [ ] Write tests

### `DamageOverlay`

```typescript
// examples/3d-dungeon/hud/damage-overlay.ts
import { Color, Vec2 } from "@quintus/math";
import { Layer, Panel } from "@quintus/ui";

export class DamageOverlay extends Layer {
	private _panel!: Panel;
	private _timer = 0;
	private _duration = 0.2;

	override onReady(): void {
		this.fixed = true;
		this.zIndex = 99; // below HUD text (100) but above everything else

		this._panel = this.add(Panel, {
			position: new Vec2(0, 0),
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#ff0000").withAlpha(0),
		});
		this._panel.visible = false;
	}

	/** Flash the red overlay. */
	flash(): void {
		this._panel.visible = true;
		this._panel.backgroundColor = Color.fromHex("#ff0000").withAlpha(0.35);
		this._timer = this._duration;
	}

	override onUpdate(dt: number): void {
		if (this._timer <= 0) return;
		this._timer -= dt;
		const alpha = Math.max(0, (this._timer / this._duration) * 0.35);
		this._panel.backgroundColor = Color.fromHex("#ff0000").withAlpha(alpha);
		if (this._timer <= 0) {
			this._panel.visible = false;
		}
	}
}
```

### Wiring

```typescript
// dungeon-level.ts
const damageOverlay = this.add(DamageOverlay);

enemy.attackedPlayer.connect(() => {
	damageOverlay.flash();
});

// Also flash on trap damage — hook health decrease
gameState.on("health").connect(({ value, previous }) => {
	if (value < previous) damageOverlay.flash();
});
```

### Tests

**`__tests__/damage-overlay.test.ts`:**
- `flash()` makes panel visible with red alpha
- Alpha fades to 0 over duration
- Panel hidden after timer expires

---

## Phase 5: Coin Collect Burst

Gold particle explosion when a coin is collected. Particles fly upward with sparkle effect.

- [ ] Add gold burst config to `effects.ts`
- [ ] Spawn on coin collect in `dungeon-level.ts`
- [ ] Write tests

### Particle Config

```typescript
// effects.ts
export const COIN_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 40,
	emissionRate: 0,
	emissionShape3D: "point",
	initialSpeed: [40, 120],
	initialTheta: [0, 70],   // mostly upward
	initialPhi: [0, 360],
	gravityY: -60,
	drag: 0.02,
	size: [2, 5],
	sizeOverLife: [1, 0],
	colorStart: "#ffd700",    // gold
	colorEnd: "#ffaa0000",    // transparent orange
	blendMode: "additive",
	lifetime: [0.3, 0.7],
};

export function spawnCoinBurst(parent: Node3D, x: number, y: number, z: number): void {
	const emitter = parent.add(ParticleEmitter3D, {
		config: COIN_BURST_CONFIG,
		oneShot: true,
		emitting: false,
	});
	emitter.position.set(x, y, z);
	emitter.burst(30);
}
```

### Wiring

```typescript
// dungeon-level.ts — coin collect
player.collected.connect(({ gridX, gridZ }) => {
	const coin = coins.get(`${gridX},${gridZ}`);
	if (coin) {
		spawnCoinBurst(this, coin.position.x, 0.3, coin.position.z);
		// ... existing collect logic ...
	}
});
```

### Tests

- Coin burst spawns particles at coin position
- Emitter auto-destroys after particles expire

---

## Phase 6: Footstep Dust

Small dust puffs at the player's feet on each grid move. Subtle environmental detail.

- [ ] Add dust config to `effects.ts`
- [ ] Spawn when player starts a move in `dungeon-level.ts`
- [ ] Write tests

### Particle Config

```typescript
// effects.ts
export const DUST_PUFF_CONFIG: ParticleConfig3D = {
	maxParticles: 15,
	emissionRate: 0,
	emissionShape3D: "sphere",
	emissionRadius: 0.15,
	initialSpeed: [10, 30],
	initialTheta: [60, 120],  // horizontal spread
	initialPhi: [0, 360],
	gravityY: 5,              // slight upward drift
	drag: 0.06,
	size: [1, 3],
	sizeOverLife: [0.5, 0],
	colorStart: "#aa997744",  // semi-transparent tan
	colorEnd: "#aa997700",    // fade out
	blendMode: "normal",
	lifetime: [0.2, 0.4],
};

export function spawnDustPuff(parent: Node3D, x: number, y: number, z: number): void {
	const emitter = parent.add(ParticleEmitter3D, {
		config: DUST_PUFF_CONFIG,
		oneShot: true,
		emitting: false,
	});
	emitter.position.set(x, y, z);
	emitter.burst(8);
}
```

### Trigger

We need a signal from the player when movement starts. Add a `moved` signal to `PlayerCharacter`:

```typescript
// player.ts — add signal
readonly moved = signal<{ fromX: number; fromZ: number }>();

// In _startMove(), emit before animation:
this.moved.emit({ fromX: this.gridX - dx, fromZ: this.gridZ - dz });
// (emit the old position, not the new one — dust comes from where you were)
```

```typescript
// dungeon-level.ts
player.moved.connect(({ fromX, fromZ }) => {
	const pos = grid.gridToWorld(fromX, fromZ);
	spawnDustPuff(this, pos.x, 0.02, pos.z);
});
```

### Tests

- Dust spawns at player's previous position on move
- No dust on turn or attack

---

## Phase 7: Health Pickup

A potion item that restores 1 HP. Uses a new level character `H`. Placed once per level.

- [ ] Add `H` to level data and `CHAR_MAP`
- [ ] Create `examples/3d-dungeon/entities/health-potion.ts`
- [ ] Add potion GLTF model or reuse barrel model with emissive tint
- [ ] Wire collection in `dungeon-level.ts`
- [ ] Add `healPlayer` SFX
- [ ] Update level layouts
- [ ] Write tests

### Level Data Changes

```typescript
// config.ts — update levels to include H
export const LEVELS: string[][] = [
	// Level 1 (8×8)
	["########", "#P....E#", "#..C...#", "#.G....#", "#...T..#", "#.....H#", "#....C.#", "########"],
	// Level 2 (10×10) — add H at a dead-end
	[
		"##########",
		"#P.......#",
		"#..##.C..#",
		"#..##..G.#",
		"#...T....#",
		"#....##..#",
		"#.C..##.E#",
		"#..G...H.#",
		"##########",
	],
	// Level 3 (12×12)
	[
		"############",
		"#P.........#",
		"#..###..C..#",
		"#..#.T..#..#",
		"#....C..#..#",
		"#.####..G..#",
		"#......T...#",
		"#..##.##.H.#",
		"#..##....G.#",
		"#.....C..T.#",
		"#.........E#",
		"############",
	],
];
```

### `HealthPotion` Node

```typescript
// examples/3d-dungeon/entities/health-potion.ts
import { Node3D, GLTFModel } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class HealthPotion extends Node3D {
	gridX = 0;
	gridZ = 0;
	private _elapsed = 0;

	override onReady(): void {
		// Reuse barrel model (or add a potion model later)
		this.add(GLTFModel, { src: "barrel", castShadow: true });
		this.position.set(this.gridX * TILE_SIZE, 0.0, this.gridZ * TILE_SIZE);
		this.scale.set(0.7, 0.7, 0.7); // slightly smaller than props
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		// Gentle bob to indicate interactable
		this.position.y = 0.05 + Math.sin(this._elapsed * 2) * 0.05;
	}
}
```

### Grid Changes

```typescript
// dungeon-grid.ts — add to CHAR_MAP
H: TILE_FLOOR,
```

### State Change

```typescript
// state.ts — no change needed, health and maxHealth already exist
```

### Scene Wiring

```typescript
// dungeon-level.ts — health potions
const potions = new Map<string, HealthPotion>();
for (const cell of grid.findAllChars("H")) {
	const potion = this.add(HealthPotion, {
		gridX: cell.gridX,
		gridZ: cell.gridZ,
	});
	potions.set(`${cell.gridX},${cell.gridZ}`, potion);
}
```

Collecting happens when the player steps on the tile. Add `H` case to `_checkTile()`:

```typescript
// player.ts — in _checkTile()
case "H":
	this.collectedPotion.emit({ gridX: this.gridX, gridZ: this.gridZ });
	break;
```

```typescript
// player.ts — new signal
readonly collectedPotion = signal<{ gridX: number; gridZ: number }>();
```

```typescript
// dungeon-level.ts
player.collectedPotion.connect(({ gridX, gridZ }) => {
	const key = `${gridX},${gridZ}`;
	const potion = potions.get(key);
	if (potion) {
		if (gameState.health < gameState.maxHealth) {
			gameState.health = Math.min(gameState.health + 1, gameState.maxHealth);
			hud.flash("+1 HP", "#4caf50"); // green flash
		} else {
			hud.flash("Full HP", "#4caf50");
		}
		// Green particle burst
		spawnHealBurst(this, potion.position.x, 0.3, potion.position.z);
		potion.destroy();
		potions.delete(key);
		grid.clearCell(gridX, gridZ);
		this.game.audio.play(SFX.healPickup(), { bus: "sfx" });
	}
});
```

### Heal Burst Particles

```typescript
// effects.ts
export const HEAL_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 25,
	emissionRate: 0,
	emissionShape3D: "point",
	initialSpeed: [30, 80],
	initialTheta: [0, 50],
	initialPhi: [0, 360],
	gravityY: 20,            // float upward
	drag: 0.03,
	size: [2, 4],
	sizeOverLife: [1, 0],
	colorStart: "#66ff66",
	colorEnd: "#00ff0000",
	blendMode: "additive",
	lifetime: [0.4, 0.8],
};

export function spawnHealBurst(parent: Node3D, x: number, y: number, z: number): void {
	const emitter = parent.add(ParticleEmitter3D, {
		config: HEAL_BURST_CONFIG,
		oneShot: true,
		emitting: false,
	});
	emitter.position.set(x, y, z);
	emitter.burst(20);
}
```

### Audio

```typescript
// audio.ts — add
healPickup: () => pickRandom(["handleCoins", "handleCoins2"]),
// Can reuse coin sounds or add dedicated heal sound later
```

### Tests

**`__tests__/health-potion.test.ts`:**
- Stepping on H tile at full health shows "Full HP", does not increase health
- Stepping on H tile with missing health restores 1 HP
- Potion removed from grid after collection
- Health never exceeds maxHealth

---

## Phase 8: Enemy Hit Stagger (Red Flash)

When an enemy takes damage but doesn't die, flash its mesh red for 0.2s. Uses Three.js emissive color on the model's materials.

- [ ] Add hit flash state to `Enemy`
- [ ] Apply emissive color to all mesh materials during flash
- [ ] Write tests

### Implementation in `enemy.ts`

```typescript
// New fields
private _hitFlashTimer = 0;
private _originalEmissives: Map<THREE.Material, THREE.Color> = new Map();

/** Flash red on hit. */
flashHit(): void {
	this._hitFlashTimer = 0.2;
	this._setEmissive(new THREE.Color(0xff0000));
}

private _setEmissive(color: THREE.Color): void {
	this.object3d.traverse((child) => {
		if (child instanceof THREE.Mesh && child.material) {
			const mat = child.material as THREE.MeshStandardMaterial;
			if (mat.emissive) {
				if (!this._originalEmissives.has(mat)) {
					this._originalEmissives.set(mat, mat.emissive.clone());
				}
				mat.emissive.copy(color);
			}
		}
	});
}

private _clearEmissive(): void {
	for (const [mat, original] of this._originalEmissives) {
		(mat as THREE.MeshStandardMaterial).emissive.copy(original);
	}
}

// In onFixedUpdate, add after death check:
if (this._hitFlashTimer > 0) {
	this._hitFlashTimer -= dt;
	if (this._hitFlashTimer <= 0) {
		this._clearEmissive();
	}
}
```

### Wiring

```typescript
// dungeon-level.ts — on player hitting enemy (existing handler)
player.attacked.connect(({ gridX, gridZ }) => {
	const enemy = findEnemyAt(gridX, gridZ);
	if (enemy) {
		enemy.takeDamage(PLAYER_ATTACK_DAMAGE);
		enemy.flashHit();                                    // ← NEW
		spawnBloodBurst(this, enemy.position.x, 0.5, enemy.position.z);
		// ...
	}
});
```

### Tests

- `flashHit()` sets emissive to red on model materials
- Emissive resets to original after 0.2s
- Flash during death animation doesn't error

---

## Phase 9: Torch/Light Flicker

Add animated `PointLight` nodes to wall corners or dead-end tiles for atmosphere. Lights flicker with random intensity variation.

- [ ] Create `examples/3d-dungeon/entities/torch.ts`
- [ ] Place torches at selected wall-adjacent positions during level build
- [ ] Write tests

### `Torch` Node

```typescript
// examples/3d-dungeon/entities/torch.ts
import { PointLight, Node3D } from "@quintus/three";
import { ParticleEmitter3D } from "@quintus/particles";
import type { ParticleConfig3D } from "@quintus/particles";

const TORCH_FIRE_CONFIG: ParticleConfig3D = {
	maxParticles: 20,
	emissionRate: 15,
	emissionShape3D: "point",
	initialSpeed: [10, 30],
	initialTheta: [0, 20],    // tight upward cone
	initialPhi: [0, 360],
	gravityY: 10,
	drag: 0.02,
	turbulence: 8,
	size: [1, 3],
	sizeOverLife: [1, 0],
	colorStart: "#ffcc00",
	colorEnd: "#ff440000",
	blendMode: "additive",
	lifetime: [0.2, 0.5],
};

export class Torch extends Node3D {
	private _light!: PointLight;
	private _baseIntensity = 1.2;
	private _elapsed = 0;

	override onReady(): void {
		this._light = this.add(PointLight, {
			color: 0xff9933,
			intensity: this._baseIntensity,
			distance: 4,
			decay: 2,
		});
		this._light.position.set(0, 1.0, 0); // above floor

		// Small fire particle effect at torch position
		const fire = this.add(ParticleEmitter3D, {
			config: TORCH_FIRE_CONFIG,
		});
		fire.position.set(0, 0.9, 0);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		// Perlin-ish flicker: layered sine waves at different frequencies
		const flicker =
			Math.sin(this._elapsed * 12) * 0.15 +
			Math.sin(this._elapsed * 23.7) * 0.1 +
			Math.sin(this._elapsed * 37.3) * 0.05;
		this._light.intensity = this._baseIntensity + flicker;
	}
}
```

### Placement Strategy

Place torches next to walls at regular intervals. Scan the grid for floor tiles adjacent to walls:

```typescript
// dungeon-level.ts
function findTorchPositions(grid: DungeonGrid, lines: string[]): Array<{ x: number; z: number }> {
	const positions: Array<{ x: number; z: number }> = [];
	const height = lines.length;
	for (let z = 0; z < height; z++) {
		const width = lines[z].length;
		for (let x = 0; x < width; x++) {
			if (lines[z][x] === "#") continue; // skip walls
			// Place torch on floor tiles that touch a wall on at least 2 sides
			let wallCount = 0;
			if (grid.charAt(x - 1, z) === "#") wallCount++;
			if (grid.charAt(x + 1, z) === "#") wallCount++;
			if (grid.charAt(x, z - 1) === "#") wallCount++;
			if (grid.charAt(x, z + 1) === "#") wallCount++;
			if (wallCount >= 2) {
				positions.push({ x, z });
			}
		}
	}
	// Limit density — take every 3rd position to avoid light overload
	return positions.filter((_, i) => i % 3 === 0);
}

// In onReady():
for (const pos of findTorchPositions(grid, this.levelData)) {
	const worldPos = grid.gridToWorld(pos.x, pos.z);
	const torch = this.add(Torch);
	torch.position.set(worldPos.x, 0, worldPos.z);
}
```

### Ambient Light Reduction

With torches providing local light, reduce the ambient light for more contrast:

```typescript
// dungeon-level.ts
this.add(AmbientLight, { intensity: 0.15 }); // was 0.4
```

### Tests

**`__tests__/torch.test.ts`:**
- Torch light intensity varies over time (not constant)
- Light intensity stays within reasonable bounds (0.8 – 1.5)
- Torch placement algorithm finds corner positions

---

## Phase 10: Fog of War

Darken tiles beyond a certain distance from the player. Uses a large flat plane above the floor with per-tile opacity controlled by distance. Tiles the player has visited stay partially revealed.

- [x] Create `examples/3d-dungeon/entities/fog-of-war.ts`
- [x] Track visited tiles
- [x] Update fog each frame based on player position
- [x] Write tests

### Implementation Approach

Use a grid of semi-transparent dark planes. Each tile gets a fog quad that is:
- Fully transparent (removed) when the player is within `SIGHT_RANGE`
- Semi-transparent when previously visited but now out of range
- Fully opaque when never visited and out of range

```typescript
// examples/3d-dungeon/entities/fog-of-war.ts
import { Node3D } from "@quintus/three";
import * as THREE from "three";
import { TILE_SIZE } from "../config.js";

const SIGHT_RANGE = 3;         // tiles
const VISITED_OPACITY = 0.5;   // previously seen but not in range
const HIDDEN_OPACITY = 0.85;   // never visited

export class FogOfWar extends Node3D {
	private _width = 0;
	private _height = 0;
	private _visited: boolean[][] = [];
	private _fogMeshes: (THREE.Mesh | null)[][] = [];
	private _playerGridX = 0;
	private _playerGridZ = 0;

	/** Initialize fog grid. Call after level is parsed. */
	init(width: number, height: number, wallGrid: (gx: number, gz: number) => boolean): void {
		this._width = width;
		this._height = height;
		this._visited = Array.from({ length: height }, () => Array(width).fill(false));
		this._fogMeshes = Array.from({ length: height }, () => Array(width).fill(null));

		const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
		geometry.rotateX(-Math.PI / 2); // lay flat

		for (let z = 0; z < height; z++) {
			for (let x = 0; x < width; x++) {
				if (wallGrid(x, z)) continue; // no fog on walls (walls are opaque anyway)

				const material = new THREE.MeshBasicMaterial({
					color: 0x000000,
					transparent: true,
					opacity: HIDDEN_OPACITY,
					depthWrite: false,
				});
				const mesh = new THREE.Mesh(geometry, material);
				mesh.position.set(x * TILE_SIZE, 0.95, z * TILE_SIZE); // just below ceiling
				this.object3d.add(mesh);
				this._fogMeshes[z][x] = mesh;
			}
		}
	}

	/** Call each frame with the player's current grid position. */
	updatePlayerPosition(gridX: number, gridZ: number): void {
		this._playerGridX = gridX;
		this._playerGridZ = gridZ;

		// Mark tiles in sight as visited
		for (let dz = -SIGHT_RANGE; dz <= SIGHT_RANGE; dz++) {
			for (let dx = -SIGHT_RANGE; dx <= SIGHT_RANGE; dx++) {
				const dist = Math.abs(dx) + Math.abs(dz);
				if (dist > SIGHT_RANGE) continue;
				const tx = gridX + dx;
				const tz = gridZ + dz;
				if (tx >= 0 && tx < this._width && tz >= 0 && tz < this._height) {
					this._visited[tz][tx] = true;
				}
			}
		}

		// Update fog opacity
		for (let z = 0; z < this._height; z++) {
			for (let x = 0; x < this._width; x++) {
				const mesh = this._fogMeshes[z][x];
				if (!mesh) continue;
				const dist = Math.abs(x - gridX) + Math.abs(z - gridZ);
				const mat = mesh.material as THREE.MeshBasicMaterial;
				if (dist <= SIGHT_RANGE) {
					mat.opacity = 0; // fully visible
				} else if (this._visited[z][x]) {
					mat.opacity = VISITED_OPACITY; // seen before
				} else {
					mat.opacity = HIDDEN_OPACITY;  // unexplored
				}
			}
		}
	}

	override onDestroy(): void {
		// Dispose all fog meshes
		for (const row of this._fogMeshes) {
			for (const mesh of row) {
				if (mesh) {
					(mesh.material as THREE.Material).dispose();
				}
			}
		}
	}
}
```

### Wiring

```typescript
// dungeon-level.ts
const fog = this.add(FogOfWar);
fog.init(
	this.levelData[0].length,
	this.levelData.length,
	(x, z) => grid.charAt(x, z) === "#",
);
fog.updatePlayerPosition(player.gridX, player.gridZ);

// Update on player move
player.moved.connect(() => {
	fog.updatePlayerPosition(player.gridX, player.gridZ);
});
// Also update on turn (player sees different area)
// Actually, visibility is position-based in a grid game, so only on move.
```

### Config Constants

```typescript
// config.ts
export const FOG_SIGHT_RANGE = 3;
export const FOG_VISITED_OPACITY = 0.5;
export const FOG_HIDDEN_OPACITY = 0.85;
```

### Tests

**`__tests__/fog-of-war.test.ts`:**
- Tiles within sight range have opacity 0
- Tiles outside range that were visited have partial opacity
- Tiles never visited have full opacity
- Moving reveals new tiles and dims old ones
- Wall tiles have no fog mesh

---

## Phase 11: Player Death Animation

Currently death immediately switches to game-over. Instead, play a collapse/fall animation, then fade to black, then scene switch.

- [ ] Add death animation state to `PlayerCharacter`
- [ ] Show death animation before scene transition
- [ ] Combine with camera shake (Phase 1) and screen flash (Phase 4)
- [ ] Write tests

### Implementation

```typescript
// player.ts — new fields
private _deathAnimating = false;
private _deathElapsed = 0;
private _deathDuration = 1.0; // seconds

/** Signal emitted after death animation completes, triggers scene switch. */
readonly deathComplete = signal<void>();

/** Start the death animation. */
playDeath(): void {
	this._deathAnimating = true;
	this._deathElapsed = 0;
	this._tryPlay("idle"); // freeze pose
}

// In onFixedUpdate, add at the very top (before other animation checks):
if (this._deathAnimating) {
	this._deathElapsed += dt;
	const t = Math.min(this._deathElapsed / this._deathDuration, 1);

	// Phase 1 (0–0.5s): collapse — tilt forward and shrink
	if (t < 0.5) {
		const p = t / 0.5;
		this.rotation.x = p * (Math.PI / 3); // tilt forward 60°
		this.position.y = -p * 0.3;           // sink slightly
		const s = 1 - p * 0.3;
		this.scale.set(s, s, s);
	}
	// Phase 2 (0.5–1.0s): hold collapsed position, overlay fades to black
	// (handled by DamageOverlay / transition overlay)

	if (t >= 1) {
		this._deathAnimating = false;
		this.deathComplete.emit();
	}
	return;
}
```

### Wiring

```typescript
// dungeon-level.ts — replace immediate scene switch
player.died.connect(() => {
	shake.shake(0.15, 0.3);           // heavy shake
	damageOverlay.flash();             // red flash
	spawnBloodBurst(this, player.position.x, 0.5, player.position.z);
	player.playDeath();
});

player.deathComplete.connect(() => {
	this.switchTo("game-over");
});
```

### Tests

**`__tests__/player.test.ts` (additions):**
- `playDeath()` starts collapse animation
- Player tilts and sinks during death
- `deathComplete` signal emitted after duration
- No input processing during death animation

---

## Phase 12: Level Transition Effect

Fade to black between levels. Also fix exit stairs to go **downward** (placed below the floor plane).

- [ ] Create `examples/3d-dungeon/hud/transition-overlay.ts`
- [ ] Fade out → switch scene → fade in
- [ ] Fix `ExitStairs` to position below floor
- [ ] Write tests

### Fix Exit Stairs (Downward)

```typescript
// examples/3d-dungeon/entities/exit-stairs.ts
import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class ExitStairs extends Node3D {
	gridX = 0;
	gridZ = 0;

	override onReady(): void {
		const model = this.add(GLTFModel, { src: "stairs" });
		// Place stairs below the floor — the staircase descends into the ground
		this.position.set(this.gridX * TILE_SIZE, -0.5, this.gridZ * TILE_SIZE);
		// Optionally rotate 180° so stairs face downward
		model.rotation.x = Math.PI;
	}
}
```

### `TransitionOverlay`

```typescript
// examples/3d-dungeon/hud/transition-overlay.ts
import { signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Layer, Panel } from "@quintus/ui";

export class TransitionOverlay extends Layer {
	private _panel!: Panel;
	private _state: "idle" | "fade-out" | "fade-in" = "idle";
	private _timer = 0;
	private _duration = 0;

	/** Emitted when fade-out completes (time to switch scene). */
	readonly fadeOutComplete = signal<void>();
	/** Emitted when fade-in completes (scene fully visible). */
	readonly fadeInComplete = signal<void>();

	override onReady(): void {
		this.fixed = true;
		this.zIndex = 200; // above everything

		this._panel = this.add(Panel, {
			position: new Vec2(0, 0),
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#000000").withAlpha(0),
		});
		this._panel.visible = false;
	}

	/** Start a fade-to-black over `duration` seconds. */
	fadeOut(duration = 0.4): void {
		this._panel.visible = true;
		this._state = "fade-out";
		this._timer = 0;
		this._duration = duration;
	}

	/** Start a fade-from-black over `duration` seconds. */
	fadeIn(duration = 0.4): void {
		this._panel.visible = true;
		this._panel.backgroundColor = Color.BLACK;
		this._state = "fade-in";
		this._timer = 0;
		this._duration = duration;
	}

	override onUpdate(dt: number): void {
		if (this._state === "idle") return;

		this._timer += dt;
		const t = Math.min(this._timer / this._duration, 1);

		if (this._state === "fade-out") {
			this._panel.backgroundColor = Color.fromHex("#000000").withAlpha(t);
			if (t >= 1) {
				this._state = "idle";
				this.fadeOutComplete.emit();
			}
		} else if (this._state === "fade-in") {
			this._panel.backgroundColor = Color.fromHex("#000000").withAlpha(1 - t);
			if (t >= 1) {
				this._panel.visible = false;
				this._state = "idle";
				this.fadeInComplete.emit();
			}
		}
	}
}
```

### Wiring for Level Exit

```typescript
// dungeon-level.ts
const transition = this.add(TransitionOverlay);

player.reachedExit.connect(() => {
	this.game.audio.play(SFX.exitDoor(), { bus: "sfx" });
	transition.fadeOut(0.4);
});

transition.fadeOutComplete.connect(() => {
	this.switchTo(this.nextScene);
});
```

### Wiring for Level Start (Fade In)

Each `DungeonLevel` scene should fade in when it starts. The `TransitionOverlay` needs to be started in fade-in state:

```typescript
// dungeon-level.ts — at end of onReady()
transition.fadeIn(0.3);
```

### Wiring for Death Transition

```typescript
player.deathComplete.connect(() => {
	transition.fadeOut(0.5);
});
transition.fadeOutComplete.connect(() => {
	this.switchTo("game-over");
});
```

This replaces the direct `this.switchTo("game-over")` from Phase 11.

### Tests

**`__tests__/transition-overlay.test.ts`:**
- `fadeOut()` increases alpha from 0 to 1 over duration
- `fadeOutComplete` signal fires at end of fade
- `fadeIn()` decreases alpha from 1 to 0
- `fadeInComplete` signal fires and hides panel

---

## Dependency Graph

```
Phase 1 (Camera Shake)     ─── standalone
Phase 2 (Blood Particles)  ─── standalone (needs @quintus/particles)
Phase 3 (Enemy Death)      ─── depends on Phase 2 (uses blood burst)
Phase 4 (Screen Flash)     ─── standalone
Phase 5 (Coin Burst)       ─── depends on Phase 2 (shares effects.ts)
Phase 6 (Footstep Dust)    ─── depends on Phase 2 (shares effects.ts)
Phase 7 (Health Pickup)    ─── depends on Phase 2 (uses heal burst), Phase 6 (moved signal)
Phase 8 (Enemy Hit Flash)  ─── standalone
Phase 9 (Torches)          ─── depends on Phase 2 (@quintus/particles)
Phase 10 (Fog of War)      ─── depends on Phase 6 (moved signal)
Phase 11 (Death Anim)      ─── depends on Phase 1, 4 (shake + flash)
Phase 12 (Level Transition) ─── depends on Phase 11 (death uses transition)
```

### Recommended Implementation Order

1. **Phase 2** — Blood particles + effects.ts (foundation for all particle effects)
2. **Phase 1** — Camera shake
3. **Phase 4** — Screen flash
4. **Phase 8** — Enemy hit stagger
5. **Phase 3** — Enemy death animation
6. **Phase 5** — Coin burst
7. **Phase 6** — Footstep dust + `moved` signal
8. **Phase 7** — Health pickup
9. **Phase 9** — Torches
10. **Phase 10** — Fog of war
11. **Phase 11** — Player death animation
12. **Phase 12** — Level transition + stairs fix

---

## New Files Summary

| File | Purpose |
|------|---------|
| `entities/camera-shake.ts` | Camera shake node |
| `entities/effects.ts` | Particle burst factory functions |
| `entities/health-potion.ts` | Health pickup node |
| `entities/torch.ts` | Flickering torch with point light + fire particles |
| `entities/fog-of-war.ts` | Tile-based fog of war overlay |
| `hud/damage-overlay.ts` | Full-screen red flash on damage |
| `hud/transition-overlay.ts` | Fade-to/from-black scene transition |

## Modified Files Summary

| File | Changes |
|------|---------|
| `config.ts` | Add `H` to level data, fog constants |
| `entities/player.ts` | Add `moved` signal, `collectedPotion` signal, death animation |
| `entities/enemy.ts` | Add death animation, hit flash |
| `entities/exit-stairs.ts` | Position stairs below floor |
| `entities/dungeon-grid.ts` | Add `H` to CHAR_MAP |
| `scenes/dungeon-level.ts` | Wire all new systems |
| `audio.ts` | Add `healPickup` SFX |
| `state.ts` | No changes needed |
| `main.ts` | No changes needed (particles auto-register via Node3D) |

---

## Definition of Done

- [ ] All 12 phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes — all existing 69 dungeon tests still pass
- [ ] New tests written for each phase
- [ ] `pnpm lint` clean
- [ ] Game runs in browser via `pnpm dev` → 3d-dungeon
- [ ] Each effect is visually verified via `pnpm qdbg connect 3d-dungeon`
- [ ] No performance regression (maintain 60fps with all effects active)
