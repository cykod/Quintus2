import { Node, signal } from "@quintus/core";
import { ENEMY_TURN_INTERVAL } from "../config.js";

export enum TurnPhase {
	PlayerInput = "PlayerInput",
	PlayerAnim = "PlayerAnim",
	EnemyTurn = "EnemyTurn",
	EnemyAnim = "EnemyAnim",
}

export class TurnManager extends Node {
	turnCount = 0;
	phase = TurnPhase.PlayerInput;

	readonly playerTurnComplete = signal<number>();
	readonly enemyTurnStart = signal<void>();
	readonly enemyTurnComplete = signal<void>();

	isPlayerInputAllowed(): boolean {
		return this.phase === TurnPhase.PlayerInput;
	}

	commitPlayerAction(): void {
		this.turnCount++;
		this.phase = TurnPhase.PlayerAnim;
	}

	playerAnimDone(): void {
		this.playerTurnComplete.emit(this.turnCount);

		if (this.turnCount % ENEMY_TURN_INTERVAL === 0) {
			this.phase = TurnPhase.EnemyTurn;
			this.enemyTurnStart.emit();
		} else {
			this.phase = TurnPhase.PlayerInput;
		}
	}

	enemyAnimDone(): void {
		this.phase = TurnPhase.PlayerInput;
		this.enemyTurnComplete.emit();
	}
}
