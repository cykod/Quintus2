import { Node, Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { FRAME, STAR_SCALE, tilesetAtlas } from "../sprites.js";

const STAR_FRAMES = [FRAME.STAR1, FRAME.STAR2, FRAME.STAR3];
const LAYER_COUNT = 2;
const STARS_PER_LAYER = 15;

/**
 * Design decision -- Parallax speeds and depth cues:
 * Back layer: 40px/s at 60% scale. Front layer: 80px/s at 100% scale.
 * Both speed and scale decrease for the back layer, creating a depth cue
 * where distant stars appear smaller and move slower. Stars wrap from
 * bottom to top at y = GAME_HEIGHT+10 → y = -10, producing an infinite
 * vertical scroll effect.
 */
const LAYER_SPEEDS = [40, 80];
const LAYER_SCALES = [STAR_SCALE * 0.6, STAR_SCALE];

class Star extends Node2D {
	speed = 0;

	override onFixedUpdate(dt: number) {
		this.position._set(this.position.x, this.position.y + this.speed * dt);
		if (this.position.y > GAME_HEIGHT + 10) {
			this.position._set(this.position.x, -10);
		}
	}
}

export class Starfield extends Node {
	override onReady() {
		for (let layer = 0; layer < LAYER_COUNT; layer++) {
			const speed = LAYER_SPEEDS[layer]!;
			const sc = LAYER_SCALES[layer]!;

			for (let i = 0; i < STARS_PER_LAYER; i++) {
				const star = new Star();
				star.speed = speed;
				const frameIdx = (layer * STARS_PER_LAYER + i) % STAR_FRAMES.length;
				const frame = STAR_FRAMES[frameIdx]!;

				const x = this.game.random.next() * GAME_WIDTH;
				const y = this.game.random.next() * GAME_HEIGHT;
				star.position = new Vec2(x, y);

				const sprite = new Sprite();
				sprite.texture = "tileset";
				sprite.sourceRect = tilesetAtlas.getFrameOrThrow(frame);
				sprite.scale = new Vec2(sc, sc);
				star.add(sprite);

				this.add(star);
			}
		}
	}
}
