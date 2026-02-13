import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { definePlugin } from "./plugin.js";

describe("Plugin", () => {
	it("definePlugin returns the plugin object", () => {
		const plugin = definePlugin({ name: "test", install: () => {} });
		expect(plugin.name).toBe("test");
	});

	it("game.use(plugin) calls install(game)", () => {
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 100, height: 100, canvas });
		const installFn = vi.fn();
		const plugin = definePlugin({ name: "test", install: installFn });
		game.use(plugin);
		expect(installFn).toHaveBeenCalledWith(game);
	});

	it("hasPlugin returns true after install", () => {
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 100, height: 100, canvas });
		const plugin = definePlugin({ name: "myPlugin", install: () => {} });
		game.use(plugin);
		expect(game.hasPlugin("myPlugin")).toBe(true);
	});

	it("double install logs warning", () => {
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 100, height: 100, canvas });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const plugin = definePlugin({ name: "test", install: () => {} });
		game.use(plugin);
		game.use(plugin);
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("plugin install receives game instance", () => {
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 100, height: 100, canvas });
		const plugin = definePlugin({
			name: "test",
			install: (g) => {
				expect(g).toBe(game);
			},
		});
		game.use(plugin);
	});
});
