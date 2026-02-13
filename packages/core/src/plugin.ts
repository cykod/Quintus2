import type { Game } from "./game.js";

export interface Plugin {
	/** Unique plugin name. */
	readonly name: string;
	/** Called when the plugin is installed via game.use(). */
	install(game: Game): void;
}

/** Define a plugin. Convenience wrapper that ensures correct typing. */
export function definePlugin(plugin: Plugin): Plugin {
	return plugin;
}
