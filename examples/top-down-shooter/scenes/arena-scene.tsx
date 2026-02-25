import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { Arena } from "../entities/arena.js";
import { BulletManager } from "../entities/bullet-manager.js";
import { EnemyManager } from "../entities/enemy-manager.js";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";

const WAVE_DELAY = 2;

export class ArenaScene extends Scene {
	private player!: Player;
	private bulletManager!: BulletManager;
	private enemyManager!: EnemyManager;
	private hud!: HUD;
	private camera!: Camera;

	override build() {
		return (
			<>
				<Arena />
				<Player ref="player" position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
				<BulletManager ref="bulletManager" />
				<EnemyManager ref="enemyManager" />
				<HUD ref="hud" />
				<Camera ref="camera" />
			</>
		);
	}

	override onReady() {
		// Set camera position
		this.camera.position.x = GAME_WIDTH / 2;
		this.camera.position.y = GAME_HEIGHT / 2;

		// Wire cross-references
		this.player.bulletManager = this.bulletManager;
		this.enemyManager.playerRef = this.player;
		this.enemyManager.bulletManager = this.bulletManager;
		this.hud.bulletManager = this.bulletManager;

		// Player death
		this.player.died.connect(() => {
			this.after(0.5, () => this.switchTo("game-over"));
		});

		// Player damage — camera shake
		this.player.damaged.connect(() => {
			this.camera.shake(4, 0.2);
		});

		// Wave completion
		this.enemyManager.waveComplete.connect((wave) => {
			this.after(WAVE_DELAY, () => {
				this.enemyManager.startWave(wave + 1);
			});
		});

		// Start wave 1
		this.enemyManager.startWave(1);
	}
}
