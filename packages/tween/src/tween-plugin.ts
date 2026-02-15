import { definePlugin, type Game, type Plugin } from "@quintus/core";
import { TweenSystem } from "./tween-system.js";

const systemMap = new WeakMap<Game, TweenSystem>();

export function getTweenSystem(game: Game): TweenSystem | null {
	return systemMap.get(game) ?? null;
}

export function TweenPlugin(): Plugin {
	return definePlugin({
		name: "tween",
		install(game: Game) {
			const system = new TweenSystem();
			systemMap.set(game, system);

			game.postUpdate.connect((dt) => system.update(dt));

			game.stopped.connect(() => {
				system.killAll();
				systemMap.delete(game);
			});
		},
	});
}
