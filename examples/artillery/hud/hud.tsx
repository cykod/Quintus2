import type { DrawContext, SignalConnection } from "@quintus/core";
import { Color, clamp, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { MAX_POWER, MIN_POWER } from "../config.js";
import { gameState } from "../state.js";

// Power-meter geometry (screen space — the HUD is a fixed layer).
const METER_X = 10;
const METER_Y = 42;
const METER_WIDTH = 130;
const METER_HEIGHT = 10;
const METER_BG_COLOR = Color.fromHex("#1c2a33");
const METER_FILL_COLOR = Color.fromHex("#e8a13a");

function windText(wind: number): string {
	const arrow = wind > 0 ? "►" : wind < 0 ? "◄" : "—";
	return `Wind: ${arrow} ${Math.abs(Math.round(wind))}`;
}

function angleText(angle: number): string {
	return `Angle: ${Math.round((angle * 180) / Math.PI)}°`;
}

export class HUD extends Layer {
	override zIndex = 100;

	private angleLabel?: Label;
	private powerLabel?: Label;
	private windLabel?: Label;
	private ammoLabel?: Label;
	private scoreLabel?: Label;

	/**
	 * Handles for the `gameState` (module singleton) subscriptions. `gameState`
	 * outlives every scene, so `Node.destroy()`'s `disconnectAll()` — which only
	 * clears this node's OWN signals — will not remove them. Without an explicit
	 * disconnect, each new round's HUD would orphan five live handlers that keep
	 * firing on destroyed labels (an accumulating per-round leak). Disconnected in
	 * `onDestroy()`.
	 */
	private stateConnections: SignalConnection[] = [];

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="angleLabel"
					position={[10, 6]}
					text={angleText(gameState.angle)}
					fontSize={14}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="powerLabel"
					position={[10, 24]}
					text={`Power: ${Math.round(gameState.power)}`}
					fontSize={14}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="windLabel"
					position={[this.game.width / 2, 6]}
					text={windText(gameState.wind)}
					fontSize={14}
					color="#ffd166"
					align="center"
				/>
				<Label
					ref="ammoLabel"
					position={[this.game.width - 10, 6]}
					text={`Ammo: ${gameState.ammo}`}
					fontSize={14}
					color="#ffffff"
					align="right"
				/>
				<Label
					ref="scoreLabel"
					position={[this.game.width - 10, 24]}
					text={`Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		this.stateConnections.push(
			gameState.on("angle").connect(({ value }) => {
				if (this.angleLabel) this.angleLabel.text = angleText(value);
			}),
			gameState.on("power").connect(({ value }) => {
				if (this.powerLabel) this.powerLabel.text = `Power: ${Math.round(value)}`;
			}),
			gameState.on("wind").connect(({ value }) => {
				if (this.windLabel) this.windLabel.text = windText(value);
			}),
			gameState.on("ammo").connect(({ value }) => {
				if (this.ammoLabel) this.ammoLabel.text = `Ammo: ${value}`;
			}),
			gameState.on("score").connect(({ value }) => {
				if (this.scoreLabel) this.scoreLabel.text = `Score: ${value}`;
			}),
		);
	}

	override onDestroy(): void {
		for (const connection of this.stateConnections) connection.disconnect();
		this.stateConnections = [];
	}

	override onDraw(ctx: DrawContext): void {
		// Power meter — background track + proportional fill.
		ctx.rect(new Vec2(METER_X, METER_Y), new Vec2(METER_WIDTH, METER_HEIGHT), {
			fill: METER_BG_COLOR,
		});
		const t = (gameState.power - MIN_POWER) / (MAX_POWER - MIN_POWER);
		const fillWidth = clamp(t, 0, 1) * METER_WIDTH;
		if (fillWidth > 0) {
			ctx.rect(new Vec2(METER_X, METER_Y), new Vec2(fillWidth, METER_HEIGHT), {
				fill: METER_FILL_COLOR,
			});
		}
	}
}
