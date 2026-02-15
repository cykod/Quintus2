import type { Game } from "@quintus/core";
import type { UINode } from "./ui-node.js";

const pointerState = new WeakMap<Game, PointerDispatcher>();

export function getPointerDispatcher(game: Game): PointerDispatcher {
	let dispatcher = pointerState.get(game);
	if (!dispatcher) {
		dispatcher = new PointerDispatcher();
		pointerState.set(game, dispatcher);
	}
	return dispatcher;
}

export class PointerDispatcher {
	private nodes = new Set<UINode>();
	private hovered: UINode | null = null;
	private cleanup: (() => void) | null = null;

	register(node: UINode, game: Game): void {
		this.nodes.add(node);
		if (!this.cleanup) {
			this._setupListeners(game);
		}
	}

	unregister(node: UINode): void {
		this.nodes.delete(node);
		if (this.hovered === node) this.hovered = null;
		if (this.nodes.size === 0) {
			this.cleanup?.();
			this.cleanup = null;
		}
	}

	private _setupListeners(game: Game): void {
		const canvas = game.canvas;

		const toLocal = (e: PointerEvent): { x: number; y: number } => {
			const rect = canvas.getBoundingClientRect();
			return {
				x: (e.clientX - rect.left) * (game.width / rect.width),
				y: (e.clientY - rect.top) * (game.height / rect.height),
			};
		};

		const findTarget = (x: number, y: number): UINode | null => {
			let best: UINode | null = null;
			let bestZ = -Infinity;
			for (const node of this.nodes) {
				if (!node.interactive || !node.visible) continue;
				if (node.containsPoint(x, y) && node.zIndex >= bestZ) {
					best = node;
					bestZ = node.zIndex;
				}
			}
			return best;
		};

		const onDown = (e: PointerEvent) => {
			const { x, y } = toLocal(e);
			findTarget(x, y)?._onPointerDown(x, y);
		};

		const onUp = (e: PointerEvent) => {
			const { x, y } = toLocal(e);
			// Dispatch to all pressed nodes, not just the one under pointer
			for (const node of this.nodes) {
				if (!node.interactive || !node.visible) continue;
				node._onPointerUp(x, y);
			}
		};

		const onMove = (e: PointerEvent) => {
			const { x, y } = toLocal(e);
			const target = findTarget(x, y);

			if (target !== this.hovered) {
				this.hovered?._onPointerExit();
				target?._onPointerEnter();
				this.hovered = target;
			}
			target?._onPointerMove(x, y);
		};

		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointermove", onMove);

		this.cleanup = () => {
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointermove", onMove);
		};
	}
}
