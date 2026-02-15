import { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { getPointerDispatcher } from "./pointer-dispatch.js";

export class UINode extends Node2D {
	width = 0;
	height = 0;
	interactive = true;

	constructor() {
		super();
		this.renderFixed = true;
	}

	get size(): Vec2 {
		return new Vec2(this.width, this.height);
	}

	set size(v: Vec2) {
		this.width = v.x;
		this.height = v.y;
	}

	containsPoint(screenX: number, screenY: number): boolean {
		const gp = this.globalPosition;
		return (
			screenX >= gp.x &&
			screenX <= gp.x + this.width &&
			screenY >= gp.y &&
			screenY <= gp.y + this.height
		);
	}

	override onEnterTree(): void {
		const game = this.game;
		if (game) {
			getPointerDispatcher(game).register(this, game);
		}
	}

	override onExitTree(): void {
		const game = this.game;
		if (game) {
			getPointerDispatcher(game).unregister(this);
		}
	}

	/** @internal */ _onPointerDown(_x: number, _y: number): void {}
	/** @internal */ _onPointerUp(_x: number, _y: number): void {}
	/** @internal */ _onPointerMove(_x: number, _y: number): void {}
	/** @internal */ _onPointerEnter(): void {}
	/** @internal */ _onPointerExit(): void {}
}
