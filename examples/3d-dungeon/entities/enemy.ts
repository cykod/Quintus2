import { signal } from "@quintus/core";
import { GLTFModel } from "@quintus/three";
import * as THREE from "three";
import { ENEMY_ATTACK_DURATION, ENEMY_HEALTH, ENEMY_MOVE_DURATION } from "../config.js";
import { Direction } from "../direction.js";
import type { DungeonGrid } from "./dungeon-grid.js";

export type EnemyAction =
	| { type: "idle" }
	| { type: "move"; toX: number; toZ: number }
	| { type: "attack"; targetX: number; targetZ: number };

export class Enemy extends GLTFModel {
	override src = "character-orc";
	override modelScale = 1;
	override castShadow = true;
	override receiveShadow = true;

	gridX = 0;
	gridZ = 0;
	health = ENEMY_HEALTH;
	damage = 1;
	dungeonGrid!: DungeonGrid;

	readonly died = signal<void>();
	readonly attackedPlayer = signal<void>();
	readonly actionComplete = signal<void>();

	private _dying = false;
	private _deathElapsed = 0;
	private _deathDuration = 0.5;

	private _hitFlashTimer = 0;
	private _originalEmissives: Map<THREE.Material, THREE.Color> = new Map();

	private _animating = false;
	private _animElapsed = 0;
	private _animDuration = 0;
	private _animStart = new THREE.Vector3();
	private _animEnd = new THREE.Vector3();
	private _animType: "move" | "attack" | null = null;
	private _animMidpoint = false;

	override onReady(): void {
		super.onReady();

		// GLTF models face +Z; rotate to face -Z (Three.js forward)
		if (this.object3d.children.length > 0) {
			this.object3d.children[0].rotation.y = Math.PI;
		}

		// Place at grid position, face south by default
		const worldPos = this.dungeonGrid.gridToWorld(this.gridX, this.gridZ);
		this.position.set(worldPos.x, 0, worldPos.z);
		this.rotation.y = Direction.angle[2]; // south

		this._tryPlay("idle");
	}

	/** Decide what to do this turn. */
	takeTurn(playerX: number, playerZ: number): EnemyAction {
		const dx = playerX - this.gridX;
		const dz = playerZ - this.gridZ;
		const dist = Math.abs(dx) + Math.abs(dz);

		// Attack if adjacent
		if (dist === 1) {
			return { type: "attack", targetX: playerX, targetZ: playerZ };
		}

		// Manhattan-greedy: try to close distance
		const best = this._findBestMove(playerX, playerZ);
		if (best) {
			return { type: "move", toX: best.x, toZ: best.z };
		}

		return { type: "idle" };
	}

	/** Execute a decided action with animation, then emit actionComplete. */
	executeAction(action: EnemyAction): void {
		switch (action.type) {
			case "idle":
				this.actionComplete.emit();
				break;

			case "move":
				this._faceToward(action.toX, action.toZ);
				this.dungeonGrid.clearOccupied(this.gridX, this.gridZ);
				this.gridX = action.toX;
				this.gridZ = action.toZ;
				this.dungeonGrid.setOccupied(this.gridX, this.gridZ);

				this._animStart.copy(this.position);
				{
					const target = this.dungeonGrid.gridToWorld(action.toX, action.toZ);
					this._animEnd.set(target.x, 0, target.z);
				}
				this._animElapsed = 0;
				this._animDuration = ENEMY_MOVE_DURATION;
				this._animType = "move";
				this._animating = true;
				this._tryPlay("walk");
				break;

			case "attack":
				this._faceToward(action.targetX, action.targetZ);
				this.attackedPlayer.emit();
				this._animStart.copy(this.position);
				{
					const target = this.dungeonGrid.gridToWorld(action.targetX, action.targetZ);
					// Lunge halfway toward target
					this._animEnd.copy(this._animStart).lerp(new THREE.Vector3(target.x, 0, target.z), 0.5);
				}
				this._animElapsed = 0;
				this._animDuration = ENEMY_ATTACK_DURATION;
				this._animType = "attack";
				this._animMidpoint = false;
				this._animating = true;
				this.playOneShot("attack-melee-right", undefined, 0.5);
				break;
		}
	}

	/** Reduce health; emit died when ≤ 0. */
	takeDamage(amount: number): void {
		this.health -= amount;
		if (this.health <= 0) {
			this.died.emit();
		}
	}

	/** Begin death animation. Called instead of immediate destroy. */
	playDeath(): void {
		this._dying = true;
		this._deathElapsed = 0;
		this._tryPlay("idle");
	}

	/** Flash red on hit. */
	flashHit(): void {
		this._hitFlashTimer = 0.2;
		this._setEmissive(new THREE.Color(0xff0000));
	}

	/** Clone shared materials so each enemy has its own copies. */
	private _ensureOwnMaterials(): void {
		if (this._originalEmissives.size > 0) return; // already cloned
		this.object3d.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				const original = child.material as THREE.MeshStandardMaterial;
				if (original.emissive) {
					const cloned = original.clone() as THREE.MeshStandardMaterial;
					child.material = cloned;
					this._originalEmissives.set(cloned, cloned.emissive.clone());
				}
			}
		});
	}

	private _setEmissive(color: THREE.Color): void {
		this._ensureOwnMaterials();
		for (const [mat] of this._originalEmissives) {
			(mat as THREE.MeshStandardMaterial).emissive.copy(color);
		}
	}

	private _clearEmissive(): void {
		for (const [mat, original] of this._originalEmissives) {
			(mat as THREE.MeshStandardMaterial).emissive.copy(original);
		}
	}

	override onFixedUpdate(dt: number): void {
		super.onUpdate(dt);

		// Death animation: shrink, sink, spin
		if (this._dying) {
			this._deathElapsed += dt;
			const t = Math.min(this._deathElapsed / this._deathDuration, 1);
			const scale = 1 - t;
			this.scale.set(scale, scale, scale);
			this.position.y = -t * 0.5;
			this.rotation.y += dt * 8;
			if (t >= 1) {
				this.destroy();
			}
			return;
		}

		// Hit flash timer
		if (this._hitFlashTimer > 0) {
			this._hitFlashTimer -= dt;
			if (this._hitFlashTimer <= 0) {
				this._clearEmissive();
			}
		}

		if (!this._animating) return;

		this._animElapsed += dt;

		if (this._animType === "move") {
			const t = Math.min(this._animElapsed / this._animDuration, 1);
			const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
			this.position.lerpVectors(this._animStart, this._animEnd, eased);

			if (t >= 1) {
				this.position.copy(this._animEnd);
				this._animating = false;
				this._tryPlay("idle");
				this.actionComplete.emit();
			}
		} else if (this._animType === "attack") {
			const halfDur = this._animDuration / 2;
			if (!this._animMidpoint && this._animElapsed >= halfDur) {
				this._animMidpoint = true;
			}
			if (this._animMidpoint) {
				// Return phase
				const t = Math.min((this._animElapsed - halfDur) / halfDur, 1);
				this.position.lerpVectors(this._animEnd, this._animStart, t);
				if (t >= 1) {
					this.position.copy(this._animStart);
					this._animating = false;
					this._tryPlay("idle");
					this.actionComplete.emit();
				}
			} else {
				// Lunge phase
				const t = this._animElapsed / halfDur;
				this.position.lerpVectors(this._animStart, this._animEnd, t);
			}
		}
	}

	/** Instantly snap rotation to face a target grid cell. */
	private _faceToward(targetX: number, targetZ: number): void {
		const dx = targetX - this.gridX;
		const dz = targetZ - this.gridZ;
		for (let i = 0; i < 4; i++) {
			if (Direction.dx[i] === dx && Direction.dz[i] === dz) {
				this.rotation.y = Direction.angle[i];
				return;
			}
		}
	}

	private _tryPlay(name: string): void {
		if (this.loaded && this.animationNames.includes(name)) {
			this.play(name);
		}
	}

	private _findBestMove(playerX: number, playerZ: number): { x: number; z: number } | null {
		const currentDist = Math.abs(playerX - this.gridX) + Math.abs(playerZ - this.gridZ);
		let best: { x: number; z: number } | null = null;
		let bestDist = currentDist;

		for (let dir = 0; dir < 4; dir++) {
			const nx = this.gridX + Direction.dx[dir];
			const nz = this.gridZ + Direction.dz[dir];
			if (!this.dungeonGrid.isWalkableAndFree(nx, nz)) continue;

			const dist = Math.abs(playerX - nx) + Math.abs(playerZ - nz);
			if (dist < bestDist) {
				bestDist = dist;
				best = { x: nx, z: nz };
			}
		}

		return best;
	}
}
