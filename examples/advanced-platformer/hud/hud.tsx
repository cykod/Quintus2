import { Vec2 } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { Label, Layer, ProgressBar } from "@quintus/ui";
import { FRAME, HUD_DIGITS, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * In-game HUD: hearts, coin counter, score, key icons, star power bar.
 * All elements use the tile atlas sprites at 0.5× scale (32px HUD icons).
 */
export class HUD extends Layer {
	override zIndex = 100;

	private hearts: Sprite[] = [];
	private coinDigits: Sprite[] = [];
	private keySprites: Record<string, Sprite> = {};

	scoreLabel!: Label;
	starBar!: ProgressBar;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="scoreLabel"
					position={[this.game.width - 10, 12]}
					text={`Score: ${gameState.score}`}
					fontSize={18}
					color="#ffffff"
					align="right"
				/>
				<ProgressBar
					ref="starBar"
					position={[this.game.width / 2 - 80, 740]}
					width={160}
					height={12}
					maxValue={10}
					value={0}
					fillColor="#ffd54f"
					backgroundColor="#333333"
					visible={false}
				/>
			</>
		);
	}

	override onReady() {
		// ── Hearts (top-left) ──────────────────────────────────────
		for (let i = 0; i < gameState.maxHealth; i++) {
			const heart = this.add(Sprite, {
				texture: tileAtlas.texture,
				sourceRect:
					i < gameState.health
						? tileAtlas.getFrameOrThrow(FRAME.HUD_HEART)
						: tileAtlas.getFrameOrThrow(FRAME.HUD_HEART_EMPTY),
				centered: false,
				position: new Vec2(12 + i * 36, 12),
				scale: new Vec2(0.5, 0.5),
			});
			this.hearts.push(heart);
		}

		// ── Coin display (below hearts) ────────────────────────────
		const coinY = 52;
		this.add(Sprite, {
			texture: tileAtlas.texture,
			sourceRect: tileAtlas.getFrameOrThrow(FRAME.HUD_COIN),
			centered: false,
			position: new Vec2(12, coinY),
			scale: new Vec2(0.5, 0.5),
		});
		this.add(Sprite, {
			texture: tileAtlas.texture,
			sourceRect: tileAtlas.getFrameOrThrow(FRAME.HUD_MULTIPLY),
			centered: false,
			position: new Vec2(46, coinY),
			scale: new Vec2(0.5, 0.5),
		});
		for (let i = 0; i < 3; i++) {
			const digit = this.add(Sprite, {
				texture: tileAtlas.texture,
				sourceRect: tileAtlas.getFrameOrThrow(HUD_DIGITS[0]),
				centered: false,
				position: new Vec2(76 + i * 28, coinY),
				scale: new Vec2(0.5, 0.5),
			});
			this.coinDigits.push(digit);
		}
		this._updateCoinDigits(gameState.coins);

		// ── Key icons (below score, top-right) ─────────────────────
		const keyFrames: Record<string, string> = {
			red: FRAME.HUD_KEY_RED,
			blue: FRAME.HUD_KEY_BLUE,
			green: FRAME.HUD_KEY_GREEN,
			yellow: FRAME.HUD_KEY_YELLOW,
		};
		const colors = ["red", "blue", "green", "yellow"];
		for (let i = 0; i < colors.length; i++) {
			const color = colors[i];
			const key = this.add(Sprite, {
				texture: tileAtlas.texture,
				sourceRect: tileAtlas.getFrameOrThrow(keyFrames[color]),
				centered: false,
				position: new Vec2(this.game.width - 150 + i * 36, 40),
				scale: new Vec2(0.5, 0.5),
				visible: gameState.keys[color as keyof typeof gameState.keys],
			});
			this.keySprites[color] = key;
		}

		// ── Star bar initial state ─────────────────────────────────
		this.starBar.visible = gameState.starPower;
		this.starBar.value = gameState.starTimeRemaining;

		// ── Signal connections ──────────────────────────────────────
		gameState.on("health").connect(({ value }) => {
			for (let i = 0; i < this.hearts.length; i++) {
				this.hearts[i].sourceRect =
					i < value
						? tileAtlas.getFrameOrThrow(FRAME.HUD_HEART)
						: tileAtlas.getFrameOrThrow(FRAME.HUD_HEART_EMPTY);
			}
		});

		gameState.on("coins").connect(({ value }) => {
			this._updateCoinDigits(value);
		});

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("keys").connect(({ value }) => {
			for (const color of colors) {
				this.keySprites[color].visible = value[color as keyof typeof value];
			}
		});

		gameState.on("starPower").connect(({ value }) => {
			this.starBar.visible = value;
		});

		gameState.on("starTimeRemaining").connect(({ value }) => {
			this.starBar.value = value;
		});
	}

	private _updateCoinDigits(coins: number): void {
		const str = String(coins).padStart(3, "0");
		for (let i = 0; i < 3; i++) {
			const digitIdx = Number.parseInt(str[i], 10);
			this.coinDigits[i].sourceRect = tileAtlas.getFrameOrThrow(HUD_DIGITS[digitIdx]);
		}
	}
}
