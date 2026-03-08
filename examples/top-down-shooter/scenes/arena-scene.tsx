import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect } from "@quintus/math";
import { isTouchDevice } from "@quintus/touch";
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
				<Player ref="player" position={[this.game.width / 2, this.game.height / 2]} />
				<BulletManager ref="bulletManager" />
				<EnemyManager ref="enemyManager" />
				<HUD ref="hud" />
				<Camera ref="camera" />
			</>
		);
	}

	override onReady() {
		if (isTouchDevice()) {
			// Mobile: follow the player so the full arena is navigable
			this.camera.follow = this.player;
			this.camera.smoothing = 0.08;
			this.camera.bounds = new Rect(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
		} else {
			// Desktop: static camera showing the full arena
			this.camera.position.x = this.game.width / 2;
			this.camera.position.y = this.game.height / 2;
		}

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

		// Wave completion — start next wave after delay
		this.enemyManager.waveComplete.connect((wave) => {
			this.after(WAVE_DELAY, () => {
				this.game.audio.play("wave_start", { bus: "sfx" });
				this.enemyManager.startWave(wave + 1);
			});
		});

		// Start wave 1
		this.game.audio.play("wave_start", { bus: "sfx" });
		this.enemyManager.startWave(1);
	}
}
