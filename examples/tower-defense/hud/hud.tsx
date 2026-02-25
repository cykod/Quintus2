import { Label, Layer } from "@quintus/ui";
import { GAME_WIDTH, TOWER_ARROW_COST, TOWER_CANNON_COST, TOWER_SLOW_COST } from "../config.js";
import { gameState, type TowerType } from "../state.js";

const HUD_Y = 530; // below the gameplay grid
const BTN_Y = HUD_Y + 50;

export class HUD extends Layer {
	override zIndex = 100;

	private goldLabel?: Label;
	private livesLabel?: Label;
	private waveLabel?: Label;
	private arrowBtn?: Label;
	private cannonBtn?: Label;
	private slowBtn?: Label;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="goldLabel"
					position={[10, HUD_Y]}
					text={`Gold: ${gameState.gold}`}
					fontSize={14}
					color="#ffd700"
					align="left"
				/>
				<Label
					ref="livesLabel"
					position={[GAME_WIDTH / 2, HUD_Y]}
					text={`Lives: ${gameState.lives}`}
					fontSize={14}
					color="#ff5252"
					align="center"
				/>
				<Label
					ref="waveLabel"
					position={[GAME_WIDTH - 10, HUD_Y]}
					text={`Wave: ${gameState.wave}`}
					fontSize={14}
					color="#8bc34a"
					align="right"
				/>
				{/* Tower selection labels (act as visual buttons) */}
				<Label
					ref="arrowBtn"
					position={[10, BTN_Y]}
					text={`[1] Arrow $${TOWER_ARROW_COST}`}
					fontSize={12}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="cannonBtn"
					position={[170, BTN_Y]}
					text={`[2] Cannon $${TOWER_CANNON_COST}`}
					fontSize={12}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="slowBtn"
					position={[340, BTN_Y]}
					text={`[3] Slow $${TOWER_SLOW_COST}`}
					fontSize={12}
					color="#ffffff"
					align="left"
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

		gameState.on("selectedTower").connect(({ value }) => {
			this._updateSelection(value);
		});

		// Initial highlight
		this._updateSelection(gameState.selectedTower);
	}

	override onFixedUpdate(_dt: number) {
		// Number keys for tower selection
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
		const highlight = "#ffd700";
		const normal = "#ffffff";
		if (this.arrowBtn) this.arrowBtn.color = type === "arrow" ? highlight : normal;
		if (this.cannonBtn) this.cannonBtn.color = type === "cannon" ? highlight : normal;
		if (this.slowBtn) this.slowBtn.color = type === "slow" ? highlight : normal;
	}
}
