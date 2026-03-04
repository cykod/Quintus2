import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { Button, Label, Layer } from "@quintus/ui";
import { ParallaxBackground, ParallaxLayer } from "../parallax/parallax-background.js";
import { charAtlas, FRAME } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * Title screen with parallax background, character sprite, and start button.
 */
export class TitleScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		return (
			<>
				<ParallaxBackground>
					<ParallaxLayer texture="bg_solid_sky" scrollFactor={0} tileY zIndex={-100} />
					<ParallaxLayer texture="bg_clouds" scrollFactor={0} screenY={0} zIndex={-99} />
					<ParallaxLayer texture="bg_fade_hills" scrollFactor={0} screenY={250} zIndex={-98} />
					<ParallaxLayer texture="bg_color_hills" scrollFactor={0} screenY={450} zIndex={-97} />
				</ParallaxBackground>
				<Camera position={[cx, this.game.height / 2]} zoom={1} />
				<Layer fixed zIndex={50}>
					<Label
						position={[cx, 160]}
						text="SUPER PLATFORMER"
						fontSize={48}
						color="#ffffff"
						align="center"
						shadow={{ offset: [3, 3], color: "#000000" }}
					/>
					<Label
						position={[cx, 220]}
						text="A Quintus 2.0 Advanced Demo"
						fontSize={14}
						color="#aaaaaa"
						align="center"
					/>
					<Sprite
						position={[cx, 380]}
						texture={charAtlas.texture}
						sourceRect={charAtlas.getFrameOrThrow(FRAME.CHAR_GREEN_FRONT)}
						centered
					/>
					<Label
						position={[cx, 500]}
						text="Arrow keys / WASD to move"
						fontSize={13}
						color="#cccccc"
						align="center"
					/>
					<Label
						position={[cx, 524]}
						text="Space / Z to jump"
						fontSize={13}
						color="#cccccc"
						align="center"
					/>
					<Button
						position={[cx - 70, 580]}
						width={140}
						height={48}
						text="Start"
						fontSize={22}
						backgroundColor="#4fc3f7"
						hoverColor="#80d8ff"
						pressedColor="#0288d1"
						textColor="#0a0a2e"
						onPressed={() => {
							gameState.reset();
							this.switchTo("level1");
						}}
					/>
				</Layer>
			</>
		);
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("level1");
		}
	}
}
