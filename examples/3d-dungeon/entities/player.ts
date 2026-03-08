import { signal } from "@quintus/core";
import { GLTFModel } from "@quintus/three";
import * as THREE from "three";
import { MOVE_DURATION, PLAYER_INVINCIBILITY, TRAP_DAMAGE } from "../config.js";
import { gameState } from "../state.js";
import type { DungeonGrid } from "./dungeon-grid.js";

export class PlayerCharacter extends GLTFModel {
	override src = "character-human";
	override modelScale = 1;
	override autoplay = false;

	gridX = 0;
	gridZ = 0;
	dungeonGrid!: DungeonGrid;

	readonly reachedExit = signal<void>();
	readonly collected = signal<{ gridX: number; gridZ: number }>();
	readonly died = signal<void>();

	private _moving = false;
	private _moveStart = new THREE.Vector3();
	private _moveEnd = new THREE.Vector3();
	private _moveElapsed = 0;
	private _invincibleTimer = 0;

	override onReady(): void {
		super.onReady();

		// Place at grid position
		const worldPos = this.dungeonGrid.gridToWorld(this.gridX, this.gridZ);
		this.position.set(worldPos.x, 0, worldPos.z);

		this._tryPlay("idle");
	}

	override onFixedUpdate(dt: number): void {
		// Tick animation mixer via GLTFModel.onUpdate
		super.onUpdate(dt);

		// Tick invincibility
		if (this._invincibleTimer > 0) {
			this._invincibleTimer -= dt;
			// Blink visibility
			this.visible = Math.floor(this._invincibleTimer * 10) % 2 === 0;
			if (this._invincibleTimer <= 0) {
				this._invincibleTimer = 0;
				this.visible = true;
			}
		}

		if (this._moving) {
			this._moveElapsed += dt;
			const t = Math.min(this._moveElapsed / MOVE_DURATION, 1);
			// Ease in-out
			const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

			this.position.lerpVectors(this._moveStart, this._moveEnd, eased);

			if (t >= 1) {
				this._moving = false;
				this.position.copy(this._moveEnd);
				this._tryPlay("idle");
				this._checkTile();
			}
			return;
		}

		// Check input for movement
		const input = this.game.input;
		let dx = 0;
		let dz = 0;
		if (input.isJustPressed("move_up")) dz = -1;
		else if (input.isJustPressed("move_down")) dz = 1;
		else if (input.isJustPressed("move_left")) dx = -1;
		else if (input.isJustPressed("move_right")) dx = 1;

		if (dx === 0 && dz === 0) return;

		const newX = this.gridX + dx;
		const newZ = this.gridZ + dz;

		if (!this.dungeonGrid.isWalkable(newX, newZ)) return;

		// Start move
		this.gridX = newX;
		this.gridZ = newZ;
		this._moveStart.copy(this.position);
		const target = this.dungeonGrid.gridToWorld(newX, newZ);
		this._moveEnd.set(target.x, 0, target.z);
		this._moveElapsed = 0;
		this._moving = true;

		// Face movement direction
		this.rotation.y = Math.atan2(dx, dz);

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
