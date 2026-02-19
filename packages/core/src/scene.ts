import { Matrix2D } from "@quintus/math";
import type { Game } from "./game.js";
import { Node } from "./node.js";
import { type Signal, signal } from "./signal.js";

/** Constructor type for class-based scenes. */
export type SceneConstructor = new (game: Game) => Scene;

/** A scene can be referenced by its class constructor or by its registered string name. */
export type SceneTarget = string | SceneConstructor;

export class Scene extends Node {
	/** @internal Marker for scene identification */
	readonly _isScene = true;

	/** The Game instance that owns this scene. */
	private _game: Game;

	/** Whether this scene is paused. */
	paused = false;

	/**
	 * View transform applied during rendering.
	 * Converts world coordinates to screen coordinates.
	 * Set by Camera node or custom code. Default: identity (no transform).
	 */
	viewTransform: Matrix2D = Matrix2D.IDENTITY;

	// === Signals ===
	readonly sceneReady: Signal<void> = signal<void>();
	readonly sceneDestroyed: Signal<void> = signal<void>();

	constructor(game: Game) {
		super();
		this._game = game;
		// Scene root is always inside the tree
		this._setInsideTree(true);
	}

	/** The Game instance that owns this scene. */
	override get game(): Game {
		return this._game;
	}

	/** Scene is always its own scene. */
	override get scene(): Scene {
		return this;
	}

	/** Scene is always its own scene. */
	override get sceneOrNull(): Scene {
		return this;
	}

	/** Scene always has a game. */
	override get gameOrNull(): Game {
		return this._game;
	}

	/** @internal Destruction queue for deferred destruction. */
	private _destructionQueue: Node[] = [];

	count(tag: string): number {
		return this.findAll(tag).length;
	}

	// === Scene Transitions ===
	switchTo(target: SceneTarget): void {
		this._game._switchScene(target);
	}

	// === Internal: Update Traversal ===
	/** @internal */
	_walkFixedUpdate(dt: number): void {
		this._walkFixedUpdateNode(this, dt);
	}

	private _walkFixedUpdateNode(node: Node, dt: number): void {
		if (node.isDestroyed) return;
		if (!node._shouldProcess(this.paused)) return;
		try {
			node.onFixedUpdate(dt);
		} catch (err) {
			this._handleLifecycleError(node, "onFixedUpdate", err);
		}
		for (const child of node.children) {
			this._walkFixedUpdateNode(child, dt);
		}
	}

	/** @internal */
	_walkUpdate(dt: number): void {
		this._walkUpdateNode(this, dt);
	}

	private _walkUpdateNode(node: Node, dt: number): void {
		if (node.isDestroyed) return;
		if (!node._shouldProcess(this.paused)) return;
		try {
			node.onUpdate(dt);
		} catch (err) {
			this._handleLifecycleError(node, "onUpdate", err);
		}
		for (const child of node.children) {
			this._walkUpdateNode(child, dt);
		}
	}

	private _handleLifecycleError(node: Node, lifecycle: string, err: unknown): void {
		// Debug instrumentation: log error
		if (this._game.debug) {
			const msg = err instanceof Error ? err.message : String(err);
			this._game.debugLog.write(
				{
					category: "error",
					message: `Error in ${node.constructor.name}#${node.id} ${lifecycle}: ${msg}`,
				},
				this._game.fixedFrame,
				this._game.elapsed,
			);
		}

		if (this._game.onError.hasListeners) {
			this._game.onError.emit({ node, lifecycle, error: err });
		} else {
			console.error(
				`Error in ${node.constructor.name}#${node.id} "${node.name}" during ${lifecycle}():`,
				err,
			);
		}
	}

	/** @internal Queue a node for destruction at end of frame. */
	_queueDestroy(node: Node): void {
		this._destructionQueue.push(node);
	}

	/** @internal Process all pending destructions. Returns true if any nodes were destroyed. */
	_processDestroyQueue(): boolean {
		const queue = this._destructionQueue;
		if (queue.length === 0) return false;
		this._destructionQueue = [];
		for (const node of queue) {
			node._processDestroy();
		}
		return true;
	}

	/** @internal Destroy the entire scene tree. */
	_destroyAll(): void {
		for (const child of [...this.children]) {
			child.destroy();
			child._processDestroy();
		}
		this.sceneDestroyed.emit();
		this.sceneDestroyed.disconnectAll();
		this.sceneReady.disconnectAll();
	}
}
