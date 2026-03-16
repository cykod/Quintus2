/** Pick a random element from an array. */
function pickRandom(variants: string[]): string {
	return variants[Math.floor(Math.random() * variants.length)];
}

export const SFX = {
	footstep: () =>
		pickRandom([
			"footstep00",
			"footstep01",
			"footstep02",
			"footstep03",
			"footstep04",
			"footstep05",
			"footstep06",
			"footstep07",
			"footstep08",
			"footstep09",
		]),
	swordSwing: () => pickRandom(["drawKnife1", "drawKnife2", "drawKnife3"]),
	swordHit: () => pickRandom(["knifeSlice", "knifeSlice2"]),
	enemyDeath: () => "chop",
	enemyAttack: () => pickRandom(["metalPot1", "metalPot2"]),
	coinCollect: () => pickRandom(["handleCoins", "handleCoins2"]),
	exitDoor: () => pickRandom(["doorOpen_1", "doorOpen_2"]),
	trap: () => "metalClick",
} as const;
