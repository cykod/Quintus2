import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { showToast } from "../hud/toast.js";
import { entitySheet } from "../sprites.js";
import { gameState, POTIONS, SHIELDS, SWORDS } from "../state.js";

export type LootType = "sword" | "shield" | "health" | "key" | "potion";

export class Chest extends Sensor {
	override collisionGroup = "items";
	lootType: LootType = "sword";
	lootTier = 0;

	private _opened = false;
	private _playerInRange = false;

	sprite?: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(12, 12)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="chest_closed" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("chest");

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
		const scene = this.scene;
		if (!scene) return;
		this.game.audio.play("chest-open", { volume: 0.5 });

		// 3-frame opening animation: closed -> opening -> open
		this.sprite?.play("chest_opening");
		this.after(0.3, () => {
			this.sprite?.play("chest_open");
			this.game.audio.play("loot", { volume: 0.5 });
		});

		switch (this.lootType) {
			case "sword": {
				const sword = SWORDS[Math.min(this.lootTier, SWORDS.length - 1)];
				gameState.sword = sword;
				showToast(scene, `Got ${sword.name}! (Damage ${sword.damage})`);
				break;
			}
			case "shield": {
				const shield = SHIELDS[Math.min(this.lootTier, SHIELDS.length - 1)];
				gameState.shield = shield;
				showToast(scene, `Got ${shield.name}! (Defense +${shield.defense})`);
				break;
			}
			case "health": {
				gameState.health = Math.min(gameState.health + 2, gameState.maxHealth);
				showToast(scene, "Found health! (+2 HP)");
				break;
			}
			case "key": {
				gameState.keys++;
				showToast(scene, "Got a key!");
				break;
			}
			case "potion": {
				const potion = POTIONS[Math.min(this.lootTier, POTIONS.length - 1)];
				gameState.potion = potion;
				showToast(scene, `Got ${potion.name}!`);
				break;
			}
		}
	}
}
