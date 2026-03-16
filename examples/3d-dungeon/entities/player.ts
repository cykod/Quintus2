import { signal } from "@quintus/core";
import { GLTFModel } from "@quintus/three";
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { MOVE_DURATION, PLAYER_INVINCIBILITY, TRAP_DAMAGE, TURN_DURATION } from "../config.js";
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

		// Attach sword GLTF to the right hand bone.
		// The arm-right bone origin is at the shoulder; offset to the hand
		// (~0.15 units along -Y in bone-local). Push slightly outward on X
		// so the blade clears the body mesh.
		const armRight = this.findBone("arm-right");
		const swordGltf = this.game.assets.get<GLTF>("weapon-sword");
		if (armRight && swordGltf) {
			const swordModel = SkeletonUtils.clone(swordGltf.scene);
			swordModel.position.set(0, -0.08, -0.05);
			armRight.add(swordModel);
		}

		// holding-right poses the arm outward for carrying the sword
		this._tryPlay("holding-right");
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

		// Attack animation driven by playOneShot — just block input
		if (this._attacking) return;

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
				this._tryPlay("holding-right");
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
		this.attacked.emit({ gridX: targetX, gridZ: targetZ });

		this._attacking = true;
		this.playOneShot("attack-melee-right", () => {
			this._attacking = false;
			this._tryPlay("holding-right");
			this.turnManager.playerAnimDone();
		});
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

		if (!this.dungeonGrid.isWalkable(newX, newZ)) return;

		this.turnManager.commitPlayerAction();
		this.gridX = newX;
		this.gridZ = newZ;
		this._moveStart.copy(this.position);
		const target = this.dungeonGrid.gridToWorld(newX, newZ);
		this._moveEnd.set(target.x, 0, target.z);
		this._moveElapsed = 0;
		this._moving = true;

		this._tryPlay("walk");
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
