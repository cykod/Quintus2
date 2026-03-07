import type { DrawContext } from "@quintus/core";
import { Game, Node2D, Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { AmbientLight, Camera3D, PointsNode, ThreeLayer, ThreePlugin } from "@quintus/three";
import * as THREE from "three";

class StarField extends PointsNode {
	geometry = (() => {
		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array(3000);
		for (let i = 0; i < 3000; i += 3) {
			positions[i] = (Math.random() - 0.5) * 100;
			positions[i + 1] = (Math.random() - 0.5) * 100;
			positions[i + 2] = (Math.random() - 0.5) * 100;
		}
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		return geo;
	})();
	material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });

	onUpdate(dt: number) {
		this.rotation.y += dt * 0.05;
	}
}

class SimpleLabel extends Node2D {
	onDraw(ctx: DrawContext) {
		ctx.text("2D Overlay on 3D Star Field", new Vec2(-130, 0), {
			color: new Color(1, 1, 1),
			size: 20,
		});
	}
}

class HybridScene extends Scene {
	onReady() {
		// 3D background layer
		const bg = this.add(ThreeLayer);
		bg.zIndex = -100;
		const cam = bg.add(Camera3D, { fov: 60 });
		cam.position.set(0, 0, 30);
		bg.add(AmbientLight, { intensity: 1 });
		bg.add(StarField);

		// 2D content on top
		const label = this.add(SimpleLabel);
		label.position = new Vec2(400, 300);
	}
}

// Hybrid: Canvas2DRenderer stays, ThreePlugin creates offscreen WebGL
const game = new Game({
	width: 800,
	height: 600,
	backgroundColor: "#000000",
	scale: "fit",
});
game.use(ThreePlugin());
game.start(HybridScene);
