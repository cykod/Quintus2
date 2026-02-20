import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class VictoryScene extends Scene {
	override build() {
		return (
			<Layer fixed>
				<Panel width={320} height={240} backgroundColor="#1a1a2e" />
				<Label position={[160, 50]} text="Victory!" fontSize={28} color="#81c784" align="center" />
				<Label
					position={[160, 100]}
					text={`Final Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[160, 120]}
					text={`Coins: ${gameState.coins}`}
					fontSize={12}
					color="#ffd54f"
					align="center"
				/>
				<Button
					position={[100, 160]}
					width={120}
					height={30}
					text="Play Again"
					fontSize={14}
					backgroundColor="#333333"
					hoverColor="#555555"
					textColor="#ffffff"
					onPressed={() => {
						gameState.reset();
						this.switchTo("level1");
					}}
				/>
			</Layer>
		);
	}
}
