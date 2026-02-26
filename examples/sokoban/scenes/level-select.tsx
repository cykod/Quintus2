import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { LEVELS } from "../levels.js";
import { gameState } from "../state.js";

export class LevelSelectScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		const buttons: ReturnType<typeof Button>[] = [];

		const cols = 3;
		const btnSize = 80;
		const gap = 20;
		const totalW = cols * btnSize + (cols - 1) * gap;
		const startX = cx - totalW / 2;
		const startY = 220;

		for (let i = 0; i < LEVELS.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = startX + col * (btnSize + gap);
			const y = startY + row * (btnSize + gap);
			const completed = gameState.completedLevels.includes(i);
			const levelNum = i + 1;

			buttons.push(
				<Button
					position={[x, y]}
					width={btnSize}
					height={btnSize}
					text={completed ? `${levelNum} ✓` : `${levelNum}`}
					fontSize={24}
					backgroundColor={completed ? "#6b8e4e" : "#5a4a3a"}
					hoverColor={completed ? "#7ea05e" : "#6b5a4a"}
					pressedColor={completed ? "#4a6e2e" : "#4a3a2a"}
					textColor="#e8c170"
					onPressed={() => {
						gameState.currentLevel = i;
						this.switchTo("level");
					}}
				/>,
			);
		}

		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#3b2d1f" />
				<Label
					position={[cx, 120]}
					text="Select Level"
					fontSize={28}
					color="#e8c170"
					align="center"
				/>
				{buttons}
				<Button
					position={[cx - 50, 520]}
					width={100}
					height={36}
					text="Back"
					fontSize={16}
					backgroundColor="#5a4a3a"
					hoverColor="#6b5a4a"
					pressedColor="#4a3a2a"
					textColor="#e8c170"
					onPressed={() => {
						this.switchTo("title");
					}}
				/>
			</Layer>
		);
	}
}
