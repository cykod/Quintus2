import { Sprite } from "@quintus/sprites";
import { Label, Layer } from "@quintus/ui";
import { entitySheet, TILE } from "../sprites.js";
import { gameState } from "../state.js";

export class HUD extends Layer {
	override zIndex = 100;

	private hearts: Sprite[] = [];
	scoreLabel?: Label;
	keyLabel?: Label;
	swordSprite?: Sprite;
	potionSprite?: Sprite;
	shieldSprite?: Sprite;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		this.hearts = Array.from(
			{ length: gameState.maxHealth },
			(_, i) =>
				(
					<Sprite
						texture="tileset"
						sourceRect={entitySheet.getFrameRect(
							i < gameState.health ? TILE.HEALTH_FULL : TILE.HEALTH_EMPTY,
						)}
						centered={false}
						position={[4 + i * 18, 4]}
					/>
				) as Sprite,
		);

		return (
			<>
				{this.hearts}
				<Sprite
					ref="swordSprite"
					texture="tileset"
					sourceRect={entitySheet.getFrameRect(gameState.sword.spriteFrame)}
					centered={false}
					position={[4, 24]}
				/>
				<Sprite
					ref="potionSprite"
					texture="tileset"
					sourceRect={
						gameState.potion
							? entitySheet.getFrameRect(gameState.potion.spriteFrame)
							: entitySheet.getFrameRect(TILE.POTION_GRAY)
					}
					centered={false}
					position={[24, 24]}
					alpha={gameState.potion ? 1 : 0.3}
				/>
				<Sprite
					ref="shieldSprite"
					texture="tileset"
					sourceRect={
						gameState.shield
							? entitySheet.getFrameRect(gameState.shield.spriteFrame)
							: entitySheet.getFrameRect(TILE.SHIELD_WOODEN)
					}
					centered={false}
					position={[44, 24]}
					alpha={gameState.shield ? 1 : 0.3}
				/>
				<Label
					ref="scoreLabel"
					position={[250, 4]}
					text={`Score: ${gameState.score}`}
					fontSize={8}
					color="#ffffff"
					align="right"
				/>
				<Label
					ref="keyLabel"
					position={[250, 16]}
					text={gameState.keys > 0 ? `Keys: ${gameState.keys}` : ""}
					fontSize={8}
					color="#ffd54f"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		gameState.on("health").connect(({ value }) => {
			for (let i = 0; i < this.hearts.length; i++) {
				this.hearts[i].sourceRect = entitySheet.getFrameRect(
					i < value ? TILE.HEALTH_FULL : TILE.HEALTH_EMPTY,
				);
			}
		});

		gameState.on("score").connect(({ value }) => {
			if (this.scoreLabel) this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("keys").connect(({ value }) => {
			if (this.keyLabel) this.keyLabel.text = value > 0 ? `Keys: ${value}` : "";
		});

		gameState.on("sword").connect(({ value }) => {
			if (this.swordSprite)
				this.swordSprite.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
		});

		gameState.on("shield").connect(({ value }) => {
			const s = this.shieldSprite;
			if (!s) return;
			if (value) {
				s.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
				s.alpha = 1;
			} else {
				s.sourceRect = entitySheet.getFrameRect(TILE.SHIELD_WOODEN);
				s.alpha = 0.3;
			}
		});

		gameState.on("potion").connect(({ value }) => {
			const p = this.potionSprite;
			if (!p) return;
			if (value) {
				p.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
				p.alpha = 1;
			} else {
				p.sourceRect = entitySheet.getFrameRect(TILE.POTION_GRAY);
				p.alpha = 0.3;
			}
		});
	}
}
