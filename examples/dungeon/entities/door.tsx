import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class Door extends Sensor {
  override collisionGroup = "items";
  nextScene = "";
  locked = false;

  private _playerInRange = false;
  private _used = false;

  sprite?: AnimatedSprite;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(12, 12)} />
        <AnimatedSprite
          ref="sprite"
          spriteSheet={entitySheet}
          animation="door_closed"
        />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("door");

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
        this.game.audio.play("loot", { volume: 0.5 });
      } else {
        return;
      }
    }

    this._used = true;
    // Play opening animation, then switch scene after it completes
    this.game.audio.play("door-open", { volume: 0.5 });
    this._playOpenAnimation();
    this.after(0.6, () => {
      gameState.currentLevel++;
      if (this.nextScene) this.scene.switchTo(this.nextScene);
    });
  }

  private _playOpenAnimation(): void {
    // 4-frame opening: closed(45) -> opening_1(33) -> opening_2(21) -> open(9)
    this.sprite?.play("door_opening_1");
    this.after(0.2, () => this.sprite?.play("door_opening_2"));
    this.after(0.4, () => this.sprite?.play("door_open"));
  }
}
