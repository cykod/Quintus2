import type { DrawContext } from "@quintus/core";
import { Game, Node2D, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Color, Vec2 } from "@quintus/math";
import { Particles3D } from "@quintus/particles";
import { ParticleEmitter3D } from "@quintus/particles/three";
import { AmbientLight, Camera3D, Node3D, ThreeLayer, ThreePlugin } from "@quintus/three";
import { Label, Layer } from "@quintus/ui";
import * as THREE from "three";

// ── Constants ──────────────────────────────────────────────────────
const CANVAS_W = 960;
const CANVAS_H = 600;
const COLS = 3;
const ROWS = 2;
const BURST_PRESETS = new Set(["explosion"]);
const BURST_INTERVAL = 2; // seconds
const BURST_COUNT = 40;

type PresetName = keyof typeof Particles3D;

const PRESET_NAMES: PresetName[] = ["fire", "sparks", "explosion", "magic", "snow", "trail"];

// Grid positions in 3D world space (X/Z plane)
const GRID_SPACING_X = 50;
const GRID_SPACING_Z = 50;

function gridPosition(index: number): [number, number, number] {
	const col = index % COLS;
	const row = Math.floor(index / COLS);
	const x = (col - (COLS - 1) / 2) * GRID_SPACING_X;
	const z = (row - (ROWS - 1) / 2) * GRID_SPACING_Z;
	return [x, 0, z];
}

// Project a 3D world position to 2D screen coordinates using the camera
const _projVec = new THREE.Vector3();
function projectToScreen(
	worldX: number,
	worldY: number,
	worldZ: number,
	camera: THREE.Camera,
): Vec2 {
	_projVec.set(worldX, worldY, worldZ);
	_projVec.project(camera);
	// NDC (-1..1) → screen pixels
	const sx = ((_projVec.x + 1) / 2) * CANVAS_W;
	const sy = ((1 - _projVec.y) / 2) * CANVAS_H;
	return new Vec2(sx, sy);
}

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

// ── Emitter cell wrapper (3D) ──────────────────────────────────────
class EmitterCell extends Node3D {
	readonly presetName: PresetName;
	emitter: ParticleEmitter3D;
	private _burstTimer = 0;
	private _isBurst: boolean;

	constructor(presetName: PresetName) {
		super();
		this.presetName = presetName;
		this._isBurst = BURST_PRESETS.has(presetName);
		this.emitter = new ParticleEmitter3D(Particles3D[presetName]());
		if (this._isBurst) {
			this.emitter.emitting = false;
		}
	}

	onReady() {
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
}

// ── Grid labels overlay (2D on top of 3D) ──────────────────────────
class GridLabels extends Node2D {
	camera: THREE.Camera | null = null;
	/** Cached screen positions, updated each draw from 3D projection */
	screenPositions: Vec2[] = [];

	onDraw(ctx: DrawContext) {
		if (!this.camera) return;
		this.camera.updateMatrixWorld();
		this.screenPositions = [];
		for (let i = 0; i < PRESET_NAMES.length; i++) {
			const [wx, wy, wz] = gridPosition(i);
			const pos = projectToScreen(wx, wy, wz, this.camera);
			// Offset label below the emitter origin
			pos.y += 30;
			this.screenPositions.push(pos);
			ctx.text(PRESET_NAMES[i] as string, pos, {
				size: 14,
				color: Color.fromHex("#888888"),
				align: "center",
			});
		}
	}
}

// ── Background fill ────────────────────────────────────────────────
class Background extends Node2D {
	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(0, 0), new Vec2(CANVAS_W, CANVAS_H), {
			fill: Color.fromHex("#0a0a0a"),
		});
	}
}

// ── Focus background with hints ────────────────────────────────────
class FocusBg extends Node2D {
	onDraw(ctx: DrawContext) {
		ctx.rect(Vec2.ZERO, new Vec2(CANVAS_W, CANVAS_H), {
			fill: Color.fromHex("#0a0a0a"),
		});
		ctx.text(
			"[Left/Right] cycle  [Space] toggle emit  [B] burst  [R] restart  [Esc] grid",
			new Vec2(CANVAS_W / 2, CANVAS_H - 16),
			{ size: 11, color: Color.fromHex("#555555"), align: "center" },
		);
	}
}

// ── Config overlay ─────────────────────────────────────────────────
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

// ── Focus view ─────────────────────────────────────────────────────
class FocusView extends Node2D {
	private _presetIndex = 0;
	private _emitter: ParticleEmitter3D | null = null;
	private _threeLayer: ThreeLayer | null = null;
	private _camera: Camera3D | null = null;
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

		// Clean up previous 3D layer
		if (this._threeLayer) {
			this._threeLayer.destroy();
			this._threeLayer = null;
			this._emitter = null;
			this._camera = null;
		}

		// Background
		if (!this._bg) {
			this._bg = new FocusBg();
			this._bg.zIndex = -1;
			this.add(this._bg);
		}

		const name = PRESET_NAMES[index] as PresetName;
		const config = Particles3D[name]();
		this._isBurst = BURST_PRESETS.has(name);
		this._burstTimer = 0;

		// Create a dedicated ThreeLayer for focus view
		this._threeLayer = new ThreeLayer();
		this._threeLayer.zIndex = 0;
		this.add(this._threeLayer);

		this._camera = new Camera3D();
		this._camera.fov = 60;
		this._camera.position.set(0, 15, 30);
		this._camera.object3d.lookAt(0, 0, 0);
		this._threeLayer.add(this._camera);

		const light = new AmbientLight();
		light.intensity = 1;
		this._threeLayer.add(light);

		this._emitter = new ParticleEmitter3D(config);
		if (this._isBurst) {
			this._emitter.emitting = false;
		}
		this._threeLayer.add(this._emitter);

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
		this._configOverlay.setConfig(config as unknown as Record<string, unknown>);
	}

	hide() {
		this.visible = false;
		if (this._threeLayer) {
			this._threeLayer.destroy();
			this._threeLayer = null;
			this._emitter = null;
			this._camera = null;
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

	get currentEmitter(): ParticleEmitter3D | null {
		return this._emitter;
	}
}

// ── Main Scene ─────────────────────────────────────────────────────
class Particle3DScene extends Scene {
	private cells: EmitterCell[] = [];
	private focusView: FocusView | null = null;
	private fpsNode: FPSCounter | null = null;
	private aliveLabel: Label | null = null;
	private hintLabel: Label | null = null;
	private gridLabels: GridLabels | null = null;
	private threeLayer: ThreeLayer | null = null;
	private gridVisible = true;

	onReady() {
		// Dark background
		const bg = new Background();
		bg.zIndex = -200;
		this.add(bg);

		// 3D layer for grid view
		this.threeLayer = new ThreeLayer();
		this.threeLayer.zIndex = -100;
		this.add(this.threeLayer);

		// Camera looking down at the grid
		const cam = new Camera3D();
		cam.fov = 60;
		cam.position.set(0, 50, 70);
		cam.object3d.lookAt(0, 0, 0);
		this.threeLayer.add(cam);

		// Ambient light
		const light = new AmbientLight();
		light.intensity = 1;
		this.threeLayer.add(light);

		// Create 3×2 grid of emitter cells
		for (let i = 0; i < PRESET_NAMES.length; i++) {
			const name = PRESET_NAMES[i] as PresetName;
			const cell = new EmitterCell(name);
			const [x, y, z] = gridPosition(i);
			cell.position.set(x, y, z);
			cell.name = name;
			this.threeLayer.add(cell);
			this.cells.push(cell);
		}

		// 2D labels overlay (projects 3D positions to screen)
		this.gridLabels = new GridLabels();
		this.gridLabels.camera = cam.object3d as THREE.Camera;
		this.gridLabels.zIndex = -50;
		this.add(this.gridLabels);

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

		// Click → focus on preset (use projected screen positions from labels)
		if (this.gridVisible && input.isJustPressed("click") && this.gridLabels) {
			const mx = input.mousePosition.x;
			const my = input.mousePosition.y;
			const positions = this.gridLabels.screenPositions;
			for (let i = 0; i < positions.length; i++) {
				const pos = positions[i] as Vec2;
				// Hit area around the projected position
				if (mx >= pos.x - 120 && mx <= pos.x + 120 && my >= pos.y - 150 && my <= pos.y + 40) {
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
		if (this.threeLayer) this.threeLayer.visible = false;
		if (this.gridLabels) this.gridLabels.visible = false;
		if (this.hintLabel) this.hintLabel.visible = false;
		this.focusView?.show(index);
	}

	private showGrid() {
		this.gridVisible = true;
		if (this.threeLayer) this.threeLayer.visible = true;
		if (this.gridLabels) this.gridLabels.visible = true;
		if (this.hintLabel) this.hintLabel.visible = true;
		this.focusView?.hide();
	}
}

// ── Game setup ─────────────────────────────────────────────────────
const game = new Game({
	width: CANVAS_W,
	height: CANVAS_H,
	backgroundColor: "#0a0a0a",
	scale: "fit",
	seed: 42,
});

game.use(ThreePlugin());
game.use(InputPlugin({ actions: INPUT_ACTIONS }));
game.start(Particle3DScene);
