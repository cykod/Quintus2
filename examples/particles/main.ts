import type { DrawContext } from "@quintus/core";
import { Game, Node2D, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Color, Vec2 } from "@quintus/math";
import { type ParticleConfig, ParticleEmitter, Particles } from "@quintus/particles";
import { Label, Layer } from "@quintus/ui";

// ── Constants ──────────────────────────────────────────────────────
const COLS = 5;
const CELL_W = 160;
const CELL_H = 160;
const GUTTER = 20;
const CANVAS_W = 960;
const CANVAS_H = 540;
const LABEL_H = 18;

// Burst-only presets that need periodic re-triggering
const BURST_PRESETS = new Set(["explosion", "blood", "debris", "collect"]);
// Wide-area presets that emit from a rect — clamp to cell width and position at top
const WIDE_PRESETS = new Set(["rain", "snow", "leaves"]);
const BURST_INTERVAL = 2; // seconds
const BURST_COUNT = 30;

type PresetName = keyof typeof Particles;

const PRESET_NAMES: PresetName[] = [
	"fire",
	"smoke",
	"sparks",
	"explosion",
	"blood",
	"rain",
	"snow",
	"magic",
	"poison",
	"electric",
	"bubbles",
	"leaves",
	"trail",
	"debris",
	"collect",
];

// ── Input bindings ─────────────────────────────────────────────────
const INPUT_ACTIONS = {
	escape: ["Escape"],
	left: ["ArrowLeft"],
	right: ["ArrowRight"],
	restart: ["KeyR"],
	space: ["Space"],
	burst: ["KeyB"],
	click: ["mouse:left"],
};

// ── Helper: dark background fill ───────────────────────────────────
class Background extends Node2D {
	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(0, 0), new Vec2(CANVAS_W, CANVAS_H), {
			fill: Color.fromHex("#111111"),
		});
	}
}

// ── Build a grid-friendly config: clamp wide emitters to cell size ──
function gridConfig(name: PresetName): ParticleConfig {
	const config = Particles[name]();
	if (WIDE_PRESETS.has(name)) {
		// Clamp wide emitters to fit inside the cell, leaving margin for drift
		config.emissionWidth = CELL_W * 0.5;
		if (config.emissionHeight != null) config.emissionHeight = 0;
	}
	return config;
}

// ── PresetCell: one labeled emitter in a grid cell ─────────────────
class PresetCell extends Node2D {
	readonly presetName: PresetName;
	emitter: ParticleEmitter;
	private _burstTimer = 0;
	private _isBurst: boolean;

	constructor(presetName: PresetName) {
		super();
		this.presetName = presetName;
		this._isBurst = BURST_PRESETS.has(presetName);

		const config = gridConfig(presetName);
		this.emitter = new ParticleEmitter(config);
		if (this._isBurst) {
			this.emitter.emitting = false;
		}
	}

	onReady() {
		// Wide presets emit from the top of the cell; others from center
		if (WIDE_PRESETS.has(this.presetName)) {
			this.emitter.position = new Vec2(CELL_W / 2, LABEL_H + 8);
		} else {
			this.emitter.position = new Vec2(CELL_W / 2, CELL_H / 2 + 10);
		}
		this.add(this.emitter);

		if (this._isBurst) {
			this.emitter.burst(BURST_COUNT);
		}
	}

	onFixedUpdate(dt: number) {
		if (!this._isBurst) return;
		this._burstTimer += dt;
		if (this._burstTimer >= BURST_INTERVAL) {
			this._burstTimer = 0;
			this.emitter.burst(BURST_COUNT);
		}
	}

	onDraw(ctx: DrawContext) {
		// Cell border
		ctx.rect(Vec2.ZERO, new Vec2(CELL_W, CELL_H), {
			stroke: Color.fromHex("#333333"),
			lineWidth: 1,
		});
		// Label at top
		ctx.text(this.presetName, new Vec2(CELL_W / 2, 10), {
			size: 12,
			color: Color.fromHex("#888888"),
			align: "center",
		});
	}
}

// ── FocusBg: dark background + hint text for focus view ────────────
class FocusBg extends Node2D {
	onDraw(ctx: DrawContext) {
		ctx.rect(Vec2.ZERO, new Vec2(CANVAS_W, CANVAS_H), {
			fill: Color.fromHex("#111111"),
		});
		ctx.text(
			"[Left/Right] cycle  [Space] toggle emit  [B] burst  [R] restart  [Esc] grid",
			new Vec2(CANVAS_W / 2, CANVAS_H - 16),
			{ size: 11, color: Color.fromHex("#555555"), align: "center" },
		);
	}
}

// ── FocusView: single preset at full size with config overlay ──────
class FocusView extends Node2D {
	private _presetIndex = 0;
	private _emitter: ParticleEmitter | null = null;
	private _configOverlay: ConfigOverlay | null = null;
	private _nameLabel: Label | null = null;
	private _bg: FocusBg | null = null;
	private _isBurst = false;
	private _burstTimer = 0;

	get presetIndex(): number {
		return this._presetIndex;
	}

	show(index: number) {
		this._presetIndex = index;
		this.visible = true;

		// Clean up previous emitter
		if (this._emitter) {
			this._emitter.destroy();
			this._emitter = null;
		}

		// Background (created once, low zIndex so particles render on top)
		if (!this._bg) {
			this._bg = new FocusBg();
			this._bg.zIndex = -1;
			this.add(this._bg);
		}

		const name = PRESET_NAMES[index] as PresetName;
		const config = Particles[name](); // full-size config for focus view
		this._isBurst = BURST_PRESETS.has(name);
		this._burstTimer = 0;

		this._emitter = new ParticleEmitter(config);
		this._emitter.position = new Vec2(CANVAS_W / 2, CANVAS_H / 2 - 30);
		if (this._isBurst) {
			this._emitter.emitting = false;
		}
		this.add(this._emitter);

		if (this._isBurst) {
			this._emitter.burst(BURST_COUNT);
		}

		// Name label
		if (!this._nameLabel) {
			this._nameLabel = new Label();
			this._nameLabel.fontSize = 24;
			this._nameLabel.color = Color.WHITE;
			this._nameLabel.align = "center";
			this._nameLabel.width = CANVAS_W;
			this._nameLabel.height = 30;
			this._nameLabel.position = new Vec2(CANVAS_W / 2, 30);
			this.add(this._nameLabel);
		}
		this._nameLabel.text = name;

		// Config overlay
		if (!this._configOverlay) {
			this._configOverlay = new ConfigOverlay();
			this._configOverlay.position = new Vec2(12, 60);
			this.add(this._configOverlay);
		}
		this._configOverlay.setConfig(config);
	}

	hide() {
		this.visible = false;
		if (this._emitter) {
			this._emitter.destroy();
			this._emitter = null;
		}
	}

	onFixedUpdate(dt: number) {
		if (!this.visible || !this._isBurst || !this._emitter) return;
		this._burstTimer += dt;
		if (this._burstTimer >= BURST_INTERVAL) {
			this._burstTimer = 0;
			this._emitter.burst(BURST_COUNT);
		}
	}

	triggerBurst() {
		this._emitter?.burst(BURST_COUNT);
	}

	toggleEmitting() {
		if (!this._emitter) return;
		this._emitter.emitting = !this._emitter.emitting;
	}

	get currentEmitter(): ParticleEmitter | null {
		return this._emitter;
	}
}

// ── Main Scene ─────────────────────────────────────────────────────
class ParticleScene extends Scene {
	private cells: PresetCell[] = [];
	private focusView: FocusView | null = null;
	private fpsNode: FPSCounter | null = null;
	private aliveLabel: Label | null = null;
	private hintLabel: Label | null = null;
	private gridVisible = true;

	onReady() {
		// Background
		const bg = new Background();
		bg.zIndex = -10;
		this.add(bg);

		// Create grid of preset cells
		for (let i = 0; i < PRESET_NAMES.length; i++) {
			const col = i % COLS;
			const row = Math.floor(i / COLS);
			const x = GUTTER + col * (CELL_W + GUTTER);
			const y = GUTTER + row * (CELL_H + GUTTER);

			const name = PRESET_NAMES[i] as PresetName;
			const cell = new PresetCell(name);
			cell.position = new Vec2(x, y);
			cell.name = name;
			this.add(cell);
			this.cells.push(cell);
		}

		// Focus view (hidden initially)
		this.focusView = new FocusView();
		this.focusView.visible = false;
		this.focusView.zIndex = 50;
		this.add(this.focusView);

		// HUD
		const hud = new Layer();
		hud.fixed = true;
		hud.zIndex = 100;
		this.add(hud);

		this.fpsNode = new FPSCounter();
		this.fpsNode.position = new Vec2(CANVAS_W - 60, 8);
		hud.add(this.fpsNode);

		this.aliveLabel = new Label();
		this.aliveLabel.fontSize = 11;
		this.aliveLabel.color = Color.fromHex("#666666");
		this.aliveLabel.width = 120;
		this.aliveLabel.height = 14;
		this.aliveLabel.position = new Vec2(CANVAS_W - 180, 8);
		hud.add(this.aliveLabel);

		this.hintLabel = new Label();
		this.hintLabel.fontSize = 11;
		this.hintLabel.color = Color.fromHex("#555555");
		this.hintLabel.width = 500;
		this.hintLabel.height = 14;
		this.hintLabel.position = new Vec2(CANVAS_W / 2 - 200, CANVAS_H - 16);
		this.hintLabel.text = "Click a preset to focus  |  R to restart all";
		hud.add(this.hintLabel);
	}

	onFixedUpdate(_dt: number) {
		// Update alive count
		if (this.aliveLabel) {
			let total = 0;
			if (this.gridVisible) {
				for (const cell of this.cells) {
					total += cell.emitter.aliveCount;
				}
			} else if (this.focusView?.currentEmitter) {
				total = this.focusView.currentEmitter.aliveCount;
			}
			this.aliveLabel.text = `particles: ${total}`;
		}

		const input = this.game.input;

		// Click → focus on cell (must be in onFixedUpdate for isJustPressed)
		if (this.gridVisible && input.isJustPressed("click")) {
			const mx = input.mousePosition.x;
			const my = input.mousePosition.y;
			for (let i = 0; i < this.cells.length; i++) {
				const cell = this.cells[i] as PresetCell;
				const cx = cell.position.x;
				const cy = cell.position.y;
				if (mx >= cx && mx <= cx + CELL_W && my >= cy && my <= cy + CELL_H) {
					this.showFocus(i);
					return;
				}
			}
		}

		// ESC: return to grid
		if (input.isJustPressed("escape") && !this.gridVisible) {
			this.showGrid();
			return;
		}

		// R: restart all
		if (input.isJustPressed("restart")) {
			if (this.gridVisible) {
				for (const cell of this.cells) {
					cell.emitter.restart();
					if (BURST_PRESETS.has(cell.presetName)) {
						cell.emitter.emitting = false;
						cell.emitter.burst(BURST_COUNT);
					}
				}
			} else if (this.focusView) {
				this.focusView.show(this.focusView.presetIndex);
			}
			return;
		}

		// Focus view controls
		if (!this.gridVisible && this.focusView) {
			if (input.isJustPressed("left")) {
				const idx = (this.focusView.presetIndex - 1 + PRESET_NAMES.length) % PRESET_NAMES.length;
				this.focusView.show(idx);
			}
			if (input.isJustPressed("right")) {
				const idx = (this.focusView.presetIndex + 1) % PRESET_NAMES.length;
				this.focusView.show(idx);
			}
			if (input.isJustPressed("space")) {
				this.focusView.toggleEmitting();
			}
			if (input.isJustPressed("burst")) {
				this.focusView.triggerBurst();
			}
		}
	}

	private showFocus(index: number) {
		this.gridVisible = false;
		for (const cell of this.cells) cell.visible = false;
		if (this.hintLabel) this.hintLabel.visible = false;
		this.focusView?.show(index);
	}

	private showGrid() {
		this.gridVisible = true;
		for (const cell of this.cells) cell.visible = true;
		if (this.hintLabel) this.hintLabel.visible = true;
		this.focusView?.hide();
	}
}

// ── FPS counter ────────────────────────────────────────────────────
class FPSCounter extends Node2D {
	private frames = 0;
	private timer = 0;
	private fps = 0;

	onUpdate(dt: number) {
		this.frames++;
		this.timer += dt;
		if (this.timer >= 1) {
			this.fps = this.frames;
			this.frames = 0;
			this.timer -= 1;
		}
	}

	onDraw(ctx: DrawContext) {
		ctx.text(`${this.fps} fps`, Vec2.ZERO, {
			size: 11,
			color: Color.fromHex("#666666"),
		});
	}
}

// ── Config overlay: draws config as multiline text ─────────────────
class ConfigOverlay extends Node2D {
	private _lines: string[] = [];

	setConfig(config: Record<string, unknown>) {
		this._lines = [];
		for (const [key, val] of Object.entries(config)) {
			if (val === undefined) continue;
			if (Array.isArray(val)) {
				this._lines.push(`${key}: [${val.join(", ")}]`);
			} else {
				this._lines.push(`${key}: ${String(val)}`);
			}
		}
	}

	onDraw(ctx: DrawContext) {
		const lineHeight = 13;
		for (let i = 0; i < this._lines.length; i++) {
			ctx.text(this._lines[i] as string, new Vec2(0, i * lineHeight), {
				size: 10,
				color: Color.fromHex("#555555"),
			});
		}
	}
}

// ── Game setup ─────────────────────────────────────────────────────
const game = new Game({
	width: CANVAS_W,
	height: CANVAS_H,
	canvas: "game",
	backgroundColor: "#111111",
	seed: 42,
});

game.use(InputPlugin({ actions: INPUT_ACTIONS }));

game.start(ParticleScene);
