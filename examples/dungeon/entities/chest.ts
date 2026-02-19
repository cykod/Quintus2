import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState, SHIELDS, SWORDS } from "../state.js";

export type LootType = "sword" | "shield" | "health" | "key";

export class Chest extends Sensor {
	override collisionGroup = "items";
	lootType: LootType = "sword";
	lootTier = 0;

	private _opened = false;
	private _sprite!: AnimatedSprite;
	private _playerInRange = false;

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(12, 12);
		this.tag("chest");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("chest_closed");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) this._playerInRange = true;
		});
		this.bodyExited.connect((body) => {
			if (body.hasTag("player")) this._playerInRange = false;
		});
	}

	override onFixedUpdate(_dt: number) {
		if (this._opened || !this._playerInRange) return;
		if (this.game.input.isJustPressed("interact")) {
			this._open();
		}
	}

	private _open(): void {
		this._opened = true;
		this._sprite.play("chest_open");

		switch (this.lootType) {
			case "sword": {
				const sword = SWORDS[Math.min(this.lootTier, SWORDS.length - 1)];
				gameState.sword = sword;
				break;
			}
			case "shield": {
				const shield = SHIELDS[Math.min(this.lootTier, SHIELDS.length - 1)];
				gameState.shield = shield;
				break;
			}
			case "health": {
				gameState.health = Math.min(gameState.health + 2, gameState.maxHealth);
				break;
			}
			case "key": {
				gameState.keys++;
				break;
			}
		}
	}
}
