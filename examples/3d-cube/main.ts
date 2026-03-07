import { Game, Scene } from "@quintus/core";
import { AmbientLight, Camera3D, DirectionalLight, MeshNode, ThreePlugin } from "@quintus/three";
import * as THREE from "three";

class RotatingCube extends MeshNode {
	geometry = new THREE.BoxGeometry(1, 1, 1);
	material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

	onUpdate(dt: number) {
		this.rotation.x += dt * 0.5;
		this.rotation.y += dt * 0.7;
	}
}

class MainScene extends Scene {
	onReady() {
		const cam = this.add(Camera3D, { fov: 75 });
		cam.position.set(0, 2, 5);
		cam.lookAt(0, 0, 0);

		this.add(AmbientLight, { intensity: 0.4 });
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(5, 10, 5);

		this.add(RotatingCube);
	}
}

// Full 3D: renderer: null + ThreePlugin auto-installs ThreeRenderer
const game = new Game({
	width: 800,
	height: 600,
	renderer: null,
	scale: "fit",
});
game.use(ThreePlugin({ antialias: true, background: 0x1a1a2e }));
game.start(MainScene);
