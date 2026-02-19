import { AudioPlugin } from "@quintus/audio";
import type { DrawContext } from "@quintus/core";
import { Game, Node2D, Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Ease, TweenPlugin } from "@quintus/tween";
import { Button, Container, Label, Layer, Panel, ProgressBar } from "@quintus/ui";

// === Game Setup ===
const game = new Game({
	width: 500,
	height: 400,
	canvas: "game",
	backgroundColor: "#16213e",
});
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Animated shapes (world-space objects) ===

class AnimBox extends Node2D {
	color: Color;
	w: number;
	h: number;

	constructor(w: number, h: number, color: Color) {
		super();
		this.w = w;
		this.h = h;
		this.color = color;
	}

	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(-this.w / 2, -this.h / 2), new Vec2(this.w, this.h), {
			fill: this.color.withAlpha(this.alpha),
		});
	}
}

class AnimCircle extends Node2D {
	color: Color;
	radius: number;

	constructor(radius: number, color: Color) {
		super();
		this.radius = radius;
		this.color = color;
	}

	onDraw(ctx: DrawContext) {
		ctx.circle(Vec2.ZERO, this.radius, {
			fill: this.color.withAlpha(this.alpha),
		});
	}
}

class AnimStar extends Node2D {
	color: Color;
	size: number;

	constructor(size: number, color: Color) {
		super();
		this.size = size;
		this.color = color;
	}

	onDraw(ctx: DrawContext) {
		const points: Vec2[] = [];
		for (let i = 0; i < 10; i++) {
			const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
			const r = i % 2 === 0 ? this.size : this.size * 0.45;
			points.push(new Vec2(Math.cos(angle) * r, Math.sin(angle) * r));
		}
		ctx.polygon(points, {
			fill: this.color.withAlpha(this.alpha),
		});
	}
}

// === Demo Scene ===
class DemoScene extends Scene {
	private shapes: Node2D[] = [];
	private progress!: ProgressBar;
	private countLabel!: Label;
	private animCount = 0;

	onReady() {
		// --- World-space animated shapes ---
		const box = new AnimBox(50, 50, Color.fromHex("#e91e63"));
		box.position = new Vec2(100, 200);
		this.add(box);
		this.shapes.push(box);

		const circle = new AnimCircle(25, Color.fromHex("#2196f3"));
		circle.position = new Vec2(250, 200);
		this.add(circle);
		this.shapes.push(circle);

		const star = new AnimStar(30, Color.fromHex("#ffc107"));
		star.position = new Vec2(400, 200);
		this.add(star);
		this.shapes.push(star);

		// --- HUD Layer (screen-fixed UI) ---
		const hud = new Layer();
		hud.fixed = true;
		hud.zIndex = 100;
		this.add(hud);

		// Title panel
		const topPanel = new Panel();
		topPanel.width = 500;
		topPanel.height = 36;
		topPanel.position = new Vec2(0, 0);
		topPanel.backgroundColor = Color.fromHex("#000000").withAlpha(0.6);
		hud.add(topPanel);

		const title = new Label();
		title.text = "Tween & UI Showcase";
		title.fontSize = 18;
		title.color = Color.fromHex("#e0e0e0");
		title.align = "center";
		title.baseline = "middle";
		title.width = 500;
		title.height = 36;
		title.position = new Vec2(250, 18);
		hud.add(title);

		// Bottom control panel
		const bottomPanel = new Panel();
		bottomPanel.width = 500;
		bottomPanel.height = 110;
		bottomPanel.position = new Vec2(0, 290);
		bottomPanel.backgroundColor = Color.fromHex("#0a0a1a").withAlpha(0.85);
		bottomPanel.borderColor = Color.fromHex("#333366");
		bottomPanel.borderWidth = 1;
		hud.add(bottomPanel);

		// Button row
		const btnContainer = new Container();
		btnContainer.direction = "horizontal";
		btnContainer.gap = 10;
		btnContainer.padding = 10;
		btnContainer.width = 480;
		btnContainer.height = 44;
		btnContainer.position = new Vec2(10, 298);
		hud.add(btnContainer);

		const makeButton = (label: string, color: string): Button => {
			const btn = new Button();
			btn.text = label;
			btn.width = 90;
			btn.height = 34;
			btn.fontSize = 13;
			btn.backgroundColor = Color.fromHex(color);
			btn.hoverColor = Color.fromHex(color).withAlpha(0.8);
			btn.pressedColor = Color.fromHex(color).withAlpha(0.5);
			btn.textColor = Color.WHITE;
			btn.borderColor = Color.WHITE.withAlpha(0.2);
			btn.borderWidth = 1;
			btnContainer.add(btn);
			return btn;
		};

		const bounceBtn = makeButton("Bounce", "#e91e63");
		const fadeBtn = makeButton("Fade", "#2196f3");
		const spinBtn = makeButton("Spin", "#ff9800");
		const pathBtn = makeButton("Path", "#4caf50");

		// Progress bar
		const progressLabel = new Label();
		progressLabel.text = "Animation Progress";
		progressLabel.fontSize = 11;
		progressLabel.color = Color.fromHex("#888888");
		progressLabel.width = 200;
		progressLabel.height = 14;
		progressLabel.position = new Vec2(15, 348);
		hud.add(progressLabel);

		this.progress = new ProgressBar();
		this.progress.width = 330;
		this.progress.height = 12;
		this.progress.maxValue = 100;
		this.progress.value = 0;
		this.progress.fillColor = Color.fromHex("#4caf50");
		this.progress.backgroundColor = Color.fromHex("#1a1a2e");
		this.progress.borderColor = Color.fromHex("#333366");
		this.progress.borderWidth = 1;
		this.progress.position = new Vec2(15, 363);
		hud.add(this.progress);

		// Animation counter
		this.countLabel = new Label();
		this.countLabel.text = "Animations: 0";
		this.countLabel.fontSize = 12;
		this.countLabel.color = Color.fromHex("#4fc3f7");
		this.countLabel.width = 120;
		this.countLabel.height = 16;
		this.countLabel.position = new Vec2(370, 360);
		hud.add(this.countLabel);

		// Audio status
		const audioLabel = new Label();
		audioLabel.text = "Audio: ready";
		audioLabel.fontSize = 11;
		audioLabel.color = Color.fromHex("#66bb6a");
		audioLabel.width = 120;
		audioLabel.height = 14;
		audioLabel.position = new Vec2(370, 346);
		hud.add(audioLabel);

		// --- Wire up buttons ---
		bounceBtn.onPressed.connect(() => this.doBounce());
		fadeBtn.onPressed.connect(() => this.doFade());
		spinBtn.onPressed.connect(() => this.doSpin());
		pathBtn.onPressed.connect(() => this.doPath());
	}

	private animateProgress(duration: number) {
		this.animCount++;
		this.countLabel.text = `Animations: ${this.animCount}`;
		// Tween the progress bar itself — smoothly fills over the animation duration
		this.progress.killTweens();
		this.progress.value = 0;
		this.progress.tween().to({ value: 100 }, duration, Ease.quadOut);
	}

	private doBounce() {
		this.animateProgress(0.7);
		for (const shape of this.shapes) {
			shape.killTweens();
			const startY = shape.position.y;
			shape
				.tween()
				.to({ position: { y: startY + 80 } }, 0.4, Ease.bounceOut)

				.to({ position: { y: startY } }, 0.3, Ease.quadOut);
		}
	}

	private doFade() {
		this.animateProgress(1.3);
		for (let i = 0; i < this.shapes.length; i++) {
			const shape = this.shapes[i] as Node2D;
			shape.killTweens();
			shape
				.tween()
				.delay(i * 0.15) // stagger
				.to({ alpha: 0.1 }, 0.5, Ease.quadInOut)

				.to({ alpha: 1 }, 0.5, Ease.quadInOut);
		}
	}

	private doSpin() {
		this.animateProgress(0.8);
		for (let i = 0; i < this.shapes.length; i++) {
			const shape = this.shapes[i] as Node2D;
			shape.killTweens();
			shape.rotation = 0;
			const target = (i % 2 === 0 ? 1 : -1) * Math.PI * 2;
			shape.tween().to({ rotation: target }, 0.8, Ease.elasticOut);
		}
	}

	private doPath() {
		this.animateProgress(1.0);
		for (let i = 0; i < this.shapes.length; i++) {
			const shape = this.shapes[i] as Node2D;
			shape.killTweens();
			const baseX = 100 + i * 150;
			const baseY = 200;
			shape
				.tween()
				.to({ position: { x: baseX + 60, y: baseY - 60 } }, 0.3, Ease.sineOut)

				.to({ position: { x: baseX - 60, y: baseY - 30 } }, 0.3, Ease.sineInOut)

				.to({ position: { x: baseX, y: baseY } }, 0.4, Ease.backOut);
		}
	}
}

game.start(DemoScene);
