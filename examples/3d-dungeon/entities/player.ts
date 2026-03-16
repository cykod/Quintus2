import { signal } from "@quintus/core";
import { BoneAttachment, GLTFModel } from "@quintus/three";
import * as THREE from "three";
import { SFX } from "../audio.js";
import {
	MOVE_DURATION,
	PLAYER_ATTACK_DURATION,
	PLAYER_ATTACK_WINDUP,
	PLAYER_INVINCIBILITY,
	TRAP_DAMAGE,
	TURN_DURATION,
} from "../config.js";
import { gameState } from "../state.js";
import type { DungeonGrid } from "./dungeon-grid.js";
import type { TurnManager } from "./turn-manager.js";

/**
 * Cardinal directions derived from Three.js conventions.
 * Three.js default forward is -Z, so rotation.y = 0 faces north (-Z).
 *
 * Index: 0 = North, 1 = East, 2 = South, 3 = West
 * Turn right increments index, turn left decrements.
 */
const DIR_DX = [0, 1, 0, -1]; // grid X delta
const DIR_DZ = [-1, 0, 1, 0]; // grid Z delta
const DIR_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // rotation.y

export class PlayerCharacter extends GLTFModel {
	override src = "character-human";
	override modelScale = 1;
	override autoplay = false;

	gridX = 0;
	gridZ = 0;
	dungeonGrid!: DungeonGrid;
	turnManager!: TurnManager;

	readonly reachedExit = signal<void>();
	readonly collected = signal<{ gridX: number; gridZ: number }>();
	readonly died = signal<void>();
	readonly attacked = signal<{ gridX: number; gridZ: number }>();

	/** Cardinal direction index: 0=North, 1=East, 2=South, 3=West. Starts facing south. */
	private _facing = 2;

	/** Read-only access to the current facing direction index. */
	get facing(): number {
		return this._facing;
	}

	private _moving = false;
	private _moveStart = new THREE.Vector3();
	private _moveEnd = new THREE.Vector3();
	private _moveElapsed = 0;

	private _turning = false;
	private _turnStart = 0;
	private _turnEnd = 0;
	private _turnElapsed = 0;

	private _attacking = false;
	private _attackElapsed = 0;
	private _attackStart = new THREE.Vector3();
	private _attackEnd = new THREE.Vector3();
	private _attackTargetX = 0;
	private _attackTargetZ = 0;
	private _attackHit = false;

	private _invincibleTimer = 0;

	override onReady(): void {
		super.onReady();

		// GLTF models typically face +Z; rotate inner model to face -Z (Three.js forward)
		if (this.object3d.children.length > 0) {
			this.object3d.children[0].rotation.y = Math.PI;
		}

		// Place at grid position
		const worldPos = this.dungeonGrid.gridToWorld(this.gridX, this.gridZ);
		this.position.set(worldPos.x, 0, worldPos.z);
		this.rotation.y = DIR_ANGLE[this._facing];

		// Attach sword to the right hand via BoneAttachment.
		// arm-right bone is at the shoulder; -Y goes toward the hand.
		// Rotation: X=-90° tilts blade from bone +Y into bone -Z plane,
		// then Z=90° rotates blade to point forward in character space.
		this.add(BoneAttachment, {
			boneName: "arm-right",
			offset: new THREE.Vector3(-0.2, 0.0, 0.1),
			offsetRotation: new THREE.Euler(Math.PI / 2, 0, -Math.PI / 6),
		}).add(GLTFModel, { src: "weapon-sword" });

		// holding-right poses the arm outward for carrying the sword
		this._tryPlay("idle");
	}

	override onFixedUpdate(dt: number): void {
		// Tick animation mixer via GLTFModel.onUpdate
		super.onUpdate(dt);

		// Tick invincibility
		if (this._invincibleTimer > 0) {
			this._invincibleTimer -= dt;
			this.visible = Math.floor(this._invincibleTimer * 10) % 2 === 0;
			if (this._invincibleTimer <= 0) {
				this._invincibleTimer = 0;
				this.visible = true;
			}
		}

		// Attack animation: wind-up → lunge → return
		if (this._attacking) {
			this._attackElapsed += dt;
			const lungeDur = PLAYER_ATTACK_DURATION / 2;
			const lungeStart = PLAYER_ATTACK_WINDUP;
			const returnStart = lungeStart + lungeDur;

			if (this._attackElapsed < lungeStart) {
				// Wind-up: hold position, let swing animation build
			} else if (this._attackElapsed < returnStart) {
				// Lunge forward
				const t = (this._attackElapsed - lungeStart) / lungeDur;
				this.position.lerpVectors(this._attackStart, this._attackEnd, t);
			} else {
				// Deal damage at the peak (transition to return phase)
				if (!this._attackHit) {
					this._attackHit = true;
					this.attacked.emit({ gridX: this._attackTargetX, gridZ: this._attackTargetZ });
				}
				// Return
				const t = Math.min((this._attackElapsed - returnStart) / lungeDur, 1);
				this.position.lerpVectors(this._attackEnd, this._attackStart, t);
				if (t >= 1) {
					this.position.copy(this._attackStart);
					this._attacking = false;
					this._tryPlay("idle");
					this.turnManager.playerAnimDone();
				}
			}
			return;
		}

		// Smooth turn in progress
		if (this._turning) {
			this._turnElapsed += dt;
			const t = Math.min(this._turnElapsed / TURN_DURATION, 1);
			const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

			this.rotation.y = this._turnStart + (this._turnEnd - this._turnStart) * eased;

			if (t >= 1) {
				this._turning = false;
				this.rotation.y = this._turnEnd;
				this.turnManager.playerAnimDone();
			}
			return;
		}

		// Smooth move in progress
		if (this._moving) {
			this._moveElapsed += dt;
			const t = Math.min(this._moveElapsed / MOVE_DURATION, 1);
			const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

			this.position.lerpVectors(this._moveStart, this._moveEnd, eased);

			if (t >= 1) {
				this._moving = false;
				this.position.copy(this._moveEnd);
				this._tryPlay("idle");
				this._checkTile();
				this.turnManager.playerAnimDone();
			}
			return;
		}

		// Check input
		if (!this.turnManager.isPlayerInputAllowed()) return;
		const input = this.game.input;

		if (input.isJustPressed("turn_left")) {
			this._startTurn(-1);
			return;
		}
		if (input.isJustPressed("turn_right")) {
			this._startTurn(1);
			return;
		}

		if (input.isJustPressed("move_forward")) {
			this._startMove(1);
			return;
		}
		if (input.isJustPressed("move_backward")) {
			this._startMove(-1);
			return;
		}

		if (input.isJustPressed("interact")) {
			this._startAttack();
			return;
		}
	}

	private _startAttack(): void {
		const targetX = this.gridX + DIR_DX[this._facing];
		const targetZ = this.gridZ + DIR_DZ[this._facing];

		this.turnManager.commitPlayerAction();

		// Lunge toward target tile and return; damage dealt at peak
		this._attackTargetX = targetX;
		this._attackTargetZ = targetZ;
		this._attackHit = false;
		this._attackStart.copy(this.position);
		const target = this.dungeonGrid.gridToWorld(targetX, targetZ);
		this._attackEnd.copy(this._attackStart).lerp(new THREE.Vector3(target.x, 0, target.z), 0.5);
		this._attackElapsed = 0;
		this._attacking = true;

		this.playOneShot("attack-melee-right", undefined, 0.5);
	}

	private _startTurn(direction: number): void {
		this.turnManager.commitPlayerAction();
		this._facing = (this._facing + direction + 4) % 4;
		this._turnStart = this.rotation.y;
		this._turnEnd = DIR_ANGLE[this._facing];

		// Pick shortest rotation path
		let delta = this._turnEnd - this._turnStart;
		if (delta > Math.PI) delta -= 2 * Math.PI;
		if (delta < -Math.PI) delta += 2 * Math.PI;
		this._turnEnd = this._turnStart + delta;

		this._turnElapsed = 0;
		this._turning = true;
	}

	private _startMove(forward: number): void {
		const dx = DIR_DX[this._facing] * forward;
		const dz = DIR_DZ[this._facing] * forward;

		const newX = this.gridX + dx;
		const newZ = this.gridZ + dz;

		if (!this.dungeonGrid.isWalkableAndFree(newX, newZ)) return;

		this.turnManager.commitPlayerAction();
		this.gridX = newX;
		this.gridZ = newZ;
		this._moveStart.copy(this.position);
		const target = this.dungeonGrid.gridToWorld(newX, newZ);
		this._moveEnd.set(target.x, 0, target.z);
		this._moveElapsed = 0;
		this._moving = true;

		this._tryPlay("walk");
		this.game.audio.play(SFX.footstep(), { bus: "sfx" });
	}

	private _checkTile(): void {
		const ch = this.dungeonGrid.charAt(this.gridX, this.gridZ);
		switch (ch) {
			case "C":
				this.collected.emit({ gridX: this.gridX, gridZ: this.gridZ });
				break;
			case "E":
				this.reachedExit.emit();
				break;
			case "T":
				this._takeDamage();
				break;
		}
	}

	private _takeDamage(): void {
		if (this._invincibleTimer > 0) return;

		gameState.health -= TRAP_DAMAGE;
		this._invincibleTimer = PLAYER_INVINCIBILITY;
		this.game.audio.play(SFX.trap(), { bus: "sfx" });

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}

	private _tryPlay(name: string): void {
		if (this.loaded && this.animationNames.includes(name)) {
			this.play(name);
		}
	}
}
