import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class Door extends Sensor {
	override collisionGroup = "items";
	nextScene = "";
	locked = false;

	private _sprite!: AnimatedSprite;
	private _playerInRange = false;
	private _used = false;

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(12, 12);
		this.tag("door");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("door_closed");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) this._playerInRange = true;
		});
		this.bodyExited.connect((body) => {
			if (body.hasTag("player")) this._playerInRange = false;
		});
	}

	override onFixedUpdate(_dt: number) {
		if (this._used || !this._playerInRange) return;
		if (!this.game.input.isJustPressed("interact")) return;

		if (this.locked) {
			if (gameState.keys > 0) {
				gameState.keys--;
				this.locked = false;
				this._sprite.play("door_open");
			}
			return;
		}

		this._used = true;
		this._sprite.play("door_open");
		gameState.currentLevel++;
		if (this.nextScene) this.scene.switchTo(this.nextScene);
	}
}
