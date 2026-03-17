import { signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Layer, Panel } from "@quintus/ui";

export class TransitionOverlay extends Layer {
	private _panel!: Panel;
	private _elapsed = 0;
	private _duration = 0;
	private _fromAlpha = 0;
	private _toAlpha = 0;
	private _active = false;

	readonly fadeOutComplete = signal<void>();
	readonly fadeInComplete = signal<void>();

	override onReady(): void {
		this.fixed = true;
		this.zIndex = 200;

		this._panel = this.add(Panel, {
			position: new Vec2(0, 0),
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#000000").withAlpha(0),
		});
		this._panel.visible = false;
	}

	/** Fade from transparent to opaque black. */
	fadeOut(duration: number): void {
		this._panel.visible = true;
		this._fromAlpha = 0;
		this._toAlpha = 1;
		this._duration = duration;
		this._elapsed = 0;
		this._active = true;
		this._panel.backgroundColor = Color.fromHex("#000000").withAlpha(0);
	}

	/** Fade from opaque black to transparent. */
	fadeIn(duration: number): void {
		this._panel.visible = true;
		this._fromAlpha = 1;
		this._toAlpha = 0;
		this._duration = duration;
		this._elapsed = 0;
		this._active = true;
		this._panel.backgroundColor = Color.fromHex("#000000").withAlpha(1);
	}

	override onUpdate(dt: number): void {
		if (!this._active) return;

		this._elapsed += dt;
		const t = Math.min(this._elapsed / this._duration, 1);
		const alpha = this._fromAlpha + (this._toAlpha - this._fromAlpha) * t;
		this._panel.backgroundColor = Color.fromHex("#000000").withAlpha(alpha);

		if (t >= 1) {
			this._active = false;
			if (this._toAlpha === 1) {
				this.fadeOutComplete.emit();
			} else {
				this._panel.visible = false;
				this.fadeInComplete.emit();
			}
		}
	}
}
