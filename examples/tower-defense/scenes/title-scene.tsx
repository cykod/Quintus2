import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#1a3a0e" />
				<Label
					position={[cx, 140]}
					text="TOWER DEFENSE"
					fontSize={36}
					color="#8bc34a"
					align="center"
				/>
				<Label
					position={[cx, 190]}
					text="A Quintus 2.0 Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 260]}
					text="Click to place towers"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 280]}
					text="Defend against waves of enemies"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, 340]}
					width={120}
					height={40}
					text="Level 1"
					fontSize={20}
					backgroundColor="#8bc34a"
					hoverColor="#aed581"
					pressedColor="#558b2f"
					textColor="#1a3a0e"
					onPressed={() => {
						this.game.audio.play("click", { bus: "ui" });
						gameState.reset();
						this.switchTo("level1");
					}}
				/>
				<Button
					position={[cx - 60, 400]}
					width={120}
					height={40}
					text="Level 2"
					fontSize={20}
					backgroundColor="#66bb6a"
					hoverColor="#81c784"
					pressedColor="#388e3c"
					textColor="#1a3a0e"
					onPressed={() => {
						this.game.audio.play("click", { bus: "ui" });
						gameState.reset();
						this.switchTo("level2");
					}}
				/>
			</Layer>
		);
	}
}
