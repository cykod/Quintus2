import type { DrawContext } from "@quintus/core";
import { Color, type Rect, Vec2 } from "@quintus/math";
import { Button, Label, Layer } from "@quintus/ui";
import { GAME_WIDTH, TOWER_ARROW_COST, TOWER_CANNON_COST, TOWER_SLOW_COST } from "../config.js";
import {
	FRAME_TURRET_ARROW,
	FRAME_TURRET_CANNON,
	FRAME_TURRET_SLOW,
	tileSheet,
} from "../sprites.js";
import { gameState, type TowerType } from "../state.js";

const INFO_Y = 532;
const BTN_Y = 556;
const BTN_W = 140;
const BTN_H = 72;
const BTN_GAP = 15;
const BTN_START_X = (GAME_WIDTH - 3 * BTN_W - 2 * BTN_GAP) / 2;

const SELECTED_BORDER = Color.fromHex("#ffd700");
const NORMAL_BORDER = Color.fromHex("#555555");
const COST_COLOR = Color.fromHex("#aaaaaa");
const BG_COLOR = Color.fromHex("#2a2a2a");
const HOVER_COLOR = Color.fromHex("#3a3a3a");
const PRESSED_COLOR = Color.fromHex("#1a1a1a");

class TowerSelectButton extends Button {
	iconRect: Rect | null = null;
	selected = false;
	shortcut = "";
	costAmount = 0;

	override onDraw(ctx: DrawContext): void {
		const bgColor = this.pressed ? PRESSED_COLOR : this.hovered ? HOVER_COLOR : BG_COLOR;

		ctx.rect(Vec2.ZERO, this.size, { fill: bgColor });

		// Border: gold when selected, dim grey otherwise
		ctx.rect(Vec2.ZERO, this.size, {
			stroke: this.selected ? SELECTED_BORDER : NORMAL_BORDER,
			strokeWidth: this.selected ? 2 : 1,
		});

		// Tower icon from tileset
		if (this.iconRect) {
			const iconSize = 36;
			const iconX = (this.width - iconSize) / 2;
			ctx.image("tileset", new Vec2(iconX, 4), {
				sourceRect: this.iconRect,
				width: iconSize,
				height: iconSize,
			});
		}

		// Shortcut + name
		const label = this.shortcut ? `${this.shortcut} ${this.text}` : this.text;
		ctx.text(label, new Vec2(this.width / 2, 44), {
			font: this.font,
			size: 11,
			color: this.textColor,
			align: "center",
			baseline: "top",
		});

		// Cost (rendered with $ prefix here to avoid JSX dollar-ref coercion)
		ctx.text(`$${this.costAmount}`, new Vec2(this.width / 2, 57), {
			font: this.font,
			size: 10,
			color: this.selected ? SELECTED_BORDER : COST_COLOR,
			align: "center",
			baseline: "top",
		});
	}
}

export class HUD extends Layer {
	override zIndex = 100;

	private goldLabel?: Label;
	private livesLabel?: Label;
	private waveLabel?: Label;
	private arrowBtn?: TowerSelectButton;
	private cannonBtn?: TowerSelectButton;
	private slowBtn?: TowerSelectButton;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="goldLabel"
					position={[10, INFO_Y]}
					text={`Gold: ${gameState.gold}`}
					fontSize={14}
					color="#ffd700"
					align="left"
				/>
				<Label
					ref="livesLabel"
					position={[GAME_WIDTH / 2, INFO_Y]}
					text={`Lives: ${gameState.lives}`}
					fontSize={14}
					color="#ff5252"
					align="center"
				/>
				<Label
					ref="waveLabel"
					position={[GAME_WIDTH - 10, INFO_Y]}
					text={`Wave: ${gameState.wave}`}
					fontSize={14}
					color="#8bc34a"
					align="right"
				/>
				<TowerSelectButton
					ref="arrowBtn"
					position={[BTN_START_X, BTN_Y]}
					width={BTN_W}
					height={BTN_H}
					text="Arrow"
					shortcut="[1]"
					costAmount={TOWER_ARROW_COST}
					iconRect={tileSheet.getFrameRect(FRAME_TURRET_ARROW)}
				/>
				<TowerSelectButton
					ref="cannonBtn"
					position={[BTN_START_X + BTN_W + BTN_GAP, BTN_Y]}
					width={BTN_W}
					height={BTN_H}
					text="Cannon"
					shortcut="[2]"
					costAmount={TOWER_CANNON_COST}
					iconRect={tileSheet.getFrameRect(FRAME_TURRET_CANNON)}
				/>
				<TowerSelectButton
					ref="slowBtn"
					position={[BTN_START_X + 2 * (BTN_W + BTN_GAP), BTN_Y]}
					width={BTN_W}
					height={BTN_H}
					text="Slow"
					shortcut="[3]"
					costAmount={TOWER_SLOW_COST}
					iconRect={tileSheet.getFrameRect(FRAME_TURRET_SLOW)}
				/>
			</>
		);
	}

	override onReady() {
		gameState.on("gold").connect(({ value }) => {
			if (this.goldLabel) this.goldLabel.text = `Gold: ${value}`;
		});

		gameState.on("lives").connect(({ value }) => {
			if (this.livesLabel) this.livesLabel.text = `Lives: ${value}`;
		});

		gameState.on("wave").connect(({ value }) => {
			if (this.waveLabel) this.waveLabel.text = `Wave: ${value}`;
		});

		// Click handlers for tower buttons
		this.arrowBtn?.onPressed.connect(() => {
			this.game.audio.play("click", { bus: "ui" });
			gameState.selectedTower = "arrow";
		});
		this.cannonBtn?.onPressed.connect(() => {
			this.game.audio.play("click", { bus: "ui" });
			gameState.selectedTower = "cannon";
		});
		this.slowBtn?.onPressed.connect(() => {
			this.game.audio.play("click", { bus: "ui" });
			gameState.selectedTower = "slow";
		});

		gameState.on("selectedTower").connect(({ value }) => {
			this._updateSelection(value);
		});

		this._updateSelection(gameState.selectedTower);
	}

	override onFixedUpdate(_dt: number) {
		const input = this.game.input;
		if (input.isJustPressed("tower_arrow")) {
			gameState.selectedTower = "arrow";
		} else if (input.isJustPressed("tower_cannon")) {
			gameState.selectedTower = "cannon";
		} else if (input.isJustPressed("tower_slow")) {
			gameState.selectedTower = "slow";
		}
	}

	private _updateSelection(type: TowerType | null): void {
		if (this.arrowBtn) this.arrowBtn.selected = type === "arrow";
		if (this.cannonBtn) this.cannonBtn.selected = type === "cannon";
		if (this.slowBtn) this.slowBtn.selected = type === "slow";
	}
}
