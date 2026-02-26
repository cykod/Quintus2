import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { CELL_SIZE, GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { CrateSprite } from "../entities/crate-sprite.js";
import { GridRenderer } from "../entities/grid-renderer.js";
import { PlayerSprite } from "../entities/player-sprite.js";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, type Dir, SokobanGrid } from "../grid.js";
import { HUD } from "../hud/hud.js";
import { LEVELS } from "../levels.js";
import { gameState } from "../state.js";

/**
 * Main gameplay scene. Loads a level, handles input, drives grid logic.
 */
export class SokobanLevel extends Scene {
	private _grid!: SokobanGrid;
	private _gridRenderer!: GridRenderer;
	private _playerSprite!: PlayerSprite;
	private _crateSprites: CrateSprite[] = [];
	private _animating = false;

	override build() {
		return (
			<>
				<Camera position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
				<HUD />
			</>
		);
	}

	override onReady() {
		const levelIndex = gameState.currentLevel;
		const levelStr = LEVELS[levelIndex];
		if (!levelStr) {
			this.switchTo("level-select");
			return;
		}

		this._grid = SokobanGrid.parse(levelStr);
		gameState.moves = 0;

		// Center the grid on screen
		const gridPixelW = this._grid.width * CELL_SIZE;
		const gridPixelH = this._grid.height * CELL_SIZE;
		const offsetX = (GAME_WIDTH - gridPixelW) / 2;
		const offsetY = (GAME_HEIGHT - gridPixelH) / 2;

		// Grid renderer (floor/walls/targets)
		this._gridRenderer = new GridRenderer();
		this._gridRenderer.position._set(offsetX, offsetY);
		this._gridRenderer.setGrid(this._grid);
		this.addChild(this._gridRenderer);

		// Player sprite
		this._playerSprite = new PlayerSprite();
		this._playerSprite.position._set(offsetX, offsetY);
		this._playerSprite.snapTo(this._grid.player.x, this._grid.player.y);
		this._playerSprite.zIndex = 2;
		this.addChild(this._playerSprite);

		// Crate sprites
		this._crateSprites = [];
		for (const crate of this._grid.crates) {
			const cs = new CrateSprite();
			cs.position._set(offsetX, offsetY);
			cs.snapTo(crate.x, crate.y);
			cs.zIndex = 1;
			this.addChild(cs);
			this._crateSprites.push(cs);
		}

		this._updateCrateTargetState();
	}

	override onFixedUpdate(_dt: number): void {
		if (this._animating) return;

		const input = this.game.input;

		// Undo
		if (input.isJustPressed("undo")) {
			if (this._grid.undo()) {
				gameState.moves = this._grid.moveCount;
				this._syncSprites();
			}
			return;
		}

		// Reset
		if (input.isJustPressed("reset")) {
			this._grid.reset();
			gameState.moves = 0;
			this._syncSprites();
			return;
		}

		// Movement
		let dir: Dir | null = null;
		if (input.isJustPressed("move_up")) dir = DIR_UP;
		else if (input.isJustPressed("move_down")) dir = DIR_DOWN;
		else if (input.isJustPressed("move_left")) dir = DIR_LEFT;
		else if (input.isJustPressed("move_right")) dir = DIR_RIGHT;

		if (!dir) return;

		const result = this._grid.tryMove(dir);
		if (!result.moved) return;

		gameState.moves = this._grid.moveCount;

		// Animate player
		this._playerSprite.moveTo(this._grid.player.x, this._grid.player.y, dir);

		// Animate pushed crate
		if (result.pushedCrate >= 0) {
			const crate = this._grid.crates[result.pushedCrate];
			const cs = this._crateSprites[result.pushedCrate];
			if (crate && cs) cs.moveTo(crate.x, crate.y);
		}

		this._updateCrateTargetState();

		// Check win
		if (this._grid.isSolved()) {
			this._onLevelComplete();
		}
	}

	/** Snap all sprites to current grid state (for undo/reset). */
	private _syncSprites(): void {
		this._playerSprite.snapTo(this._grid.player.x, this._grid.player.y);
		for (let i = 0; i < this._crateSprites.length; i++) {
			const crate = this._grid.crates[i];
			if (crate) this._crateSprites[i]?.snapTo(crate.x, crate.y);
		}
		this._updateCrateTargetState();
	}

	/** Update crate visuals based on target overlap. */
	private _updateCrateTargetState(): void {
		for (let i = 0; i < this._crateSprites.length; i++) {
			const crate = this._grid.crates[i];
			if (crate) this._crateSprites[i]?.setOnTarget(this._grid.isTarget(crate));
		}
	}

	private _onLevelComplete(): void {
		// Mark level as completed
		const completed = [...gameState.completedLevels];
		if (!completed.includes(gameState.currentLevel)) {
			completed.push(gameState.currentLevel);
			gameState.completedLevels = completed;
		}

		this.after(0.5, () => {
			this.switchTo("level-complete");
		});
	}

	getGrid(): SokobanGrid {
		return this._grid;
	}
}
