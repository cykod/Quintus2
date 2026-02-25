import { Color } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import type { BulletManager } from "../entities/bullet-manager.js";
import { gameState } from "../state.js";

const COLOR_GREEN = Color.fromHex("#44ff44");
const COLOR_YELLOW = Color.fromHex("#ffaa00");
const COLOR_RED = Color.fromHex("#ff4444");

export class HUD extends Layer {
	override zIndex = 100;

	private scoreLabel?: Label;
	private waveLabel?: Label;
	private healthLabel?: Label;
	private ammoLabel?: Label;
	private poolLabel?: Label;

	bulletManager: BulletManager | null = null;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="scoreLabel"
					position={[10, 6]}
					text={`Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="waveLabel"
					position={[GAME_WIDTH / 2, 6]}
					text={`Wave ${gameState.wave}`}
					fontSize={14}
					color="#4fc3f7"
					align="center"
				/>
				<Label
					ref="healthLabel"
					position={[GAME_WIDTH - 10, 6]}
					text={`HP: ${gameState.health}/${gameState.maxHealth}`}
					fontSize={14}
					color="#44ff44"
					align="right"
				/>
				<Label
					ref="ammoLabel"
					position={[10, 24]}
					text={this._formatAmmo()}
					fontSize={12}
					color="#cccccc"
					align="left"
				/>
				<Label
					position={[GAME_WIDTH / 2, GAME_HEIGHT - 10]}
					text="[1/2/3] or scroll wheel to switch weapons"
					fontSize={10}
					color="#666666"
					align="center"
				/>
				<Label
					ref="poolLabel"
					position={[GAME_WIDTH - 10, 24]}
					text=""
					fontSize={10}
					color="#666666"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		gameState.on("score").connect(({ value }) => {
			if (this.scoreLabel) this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("wave").connect(({ value }) => {
			if (this.waveLabel) this.waveLabel.text = `Wave ${value}`;
		});

		gameState.on("health").connect(({ value }) => {
			if (this.healthLabel) {
				this.healthLabel.text = `HP: ${value}/${gameState.maxHealth}`;
				if (value > 50) {
					this.healthLabel.color = COLOR_GREEN;
				} else if (value > 25) {
					this.healthLabel.color = COLOR_YELLOW;
				} else {
					this.healthLabel.color = COLOR_RED;
				}
			}
		});

		const updateAmmo = () => {
			if (this.ammoLabel) this.ammoLabel.text = this._formatAmmo();
		};
		gameState.on("ammo").connect(updateAmmo);
		gameState.on("maxAmmo").connect(updateAmmo);
		gameState.on("currentWeapon").connect(updateAmmo);
	}

	override onUpdate(_dt: number) {
		if (this.poolLabel && this.bulletManager) {
			const stats = this.bulletManager.getPoolStats();
			this.poolLabel.text =
				`PB: ${stats.playerBullets.available}/${stats.playerBullets.max}` +
				` EB: ${stats.enemyBullets.available}/${stats.enemyBullets.max}`;
		}
	}

	private _formatAmmo(): string {
		const weapon = gameState.currentWeapon;
		if (gameState.ammo === Infinity) return `${weapon.toUpperCase()} \u221E`;
		return `${weapon.toUpperCase()} ${gameState.ammo}/${gameState.maxAmmo}`;
	}
}
