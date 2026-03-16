import { Color, Vec2 } from "@quintus/math";
import { Layer, Panel } from "@quintus/ui";

export class DamageOverlay extends Layer {
	private _panel!: Panel;
	private _timer = 0;
	private _duration = 0.2;

	override onReady(): void {
		this.fixed = true;
		this.zIndex = 99;

		this._panel = this.add(Panel, {
			position: new Vec2(0, 0),
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#ff0000").withAlpha(0),
		});
		this._panel.visible = false;
	}

	/** Flash the red overlay. */
	flash(): void {
		this._panel.visible = true;
		this._panel.backgroundColor = Color.fromHex("#ff0000").withAlpha(0.35);
		this._timer = this._duration;
	}

	override onUpdate(dt: number): void {
		if (this._timer <= 0) return;
		this._timer -= dt;
		const alpha = Math.max(0, (this._timer / this._duration) * 0.35);
		this._panel.backgroundColor = Color.fromHex("#ff0000").withAlpha(alpha);
		if (this._timer <= 0) {
			this._panel.visible = false;
		}
	}
}
