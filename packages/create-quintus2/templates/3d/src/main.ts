import { Game } from "quintus2";
import { ThreePlugin } from "quintus2/three";
import { MainScene } from "./scenes/main-scene.js";

// `renderer: null` hands rendering to ThreePlugin, which installs the Three.js WebGL
// renderer and creates its own canvas. `scale: "fit"` keeps that canvas responsive.
const game = new Game({ width: 800, height: 600, renderer: null, scale: "fit", seed: 42 });
game.use(ThreePlugin({ antialias: true, background: "#101018" }));
game.start(MainScene);
