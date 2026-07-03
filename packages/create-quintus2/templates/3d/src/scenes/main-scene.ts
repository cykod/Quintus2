import { Scene } from "quintus2";
import { AmbientLight, Camera3D, DirectionalLight } from "quintus2/three";
import { Spinner } from "../entities/spinner.js";

/** The one scene: a spinning cube lit by an ambient + directional light, viewed by a 3D camera. */
export class MainScene extends Scene {
	override onReady(): void {
		const cam = this.add(Camera3D, { fov: 75 });
		cam.position.set(0, 2, 5);
		cam.lookAt(0, 0, 0);

		this.add(AmbientLight, { intensity: 0.4 });
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(5, 10, 5);

		this.add(Spinner);
	}
}
