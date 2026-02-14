import type { Game } from "./game.js";
import type { NodeConstructor } from "./node.js";
import { Node } from "./node.js";
import { type Signal, signal } from "./signal.js";

/** Function that builds a scene's node tree. */
export type SceneSetupFn = (scene: Scene) => void;

/**
 * A scene definition — a name + setup function.
 * Registered with the Game via game.scene() or defineScene().
 */
export interface SceneDefinition {
	readonly name: string;
	readonly setup: SceneSetupFn;
}

/** Define a reusable scene. Returns a SceneDefinition. */
export function defineScene(name: string, setup: SceneSetupFn): SceneDefinition {
	return { name, setup };
}

export class Scene extends Node {
	/** @internal Marker for scene identification */
	readonly _isScene = true;

	/** The Game instance that owns this scene. */
	private _game: Game;

	/** Whether this scene is paused. */
	paused = false;

	// === Signals ===
	readonly sceneReady: Signal<void> = signal<void>();
	readonly sceneDestroyed: Signal<void> = signal<void>();

	constructor(name: string, game: Game) {
		super();
		this.name = name;
		this._game = game;
		// Scene root is always inside the tree
		this._setInsideTree(true);
	}

	/** The Game instance that owns this scene. */
	override get game(): Game {
		return this._game;
	}

	/** @internal Destruction queue for deferred destruction. */
	private _destructionQueue: Node[] = [];

	// === Entity Spawning ===
	add(node: Node): this;
	add<T extends Node>(NodeClass: NodeConstructor<T>): T;
	add(nodeOrClass: Node | NodeConstructor<Node>): Node | this {
		if (typeof nodeOrClass === "function") {
			const node = new nodeOrClass();
			this.addChild(node);
			return node;
		}
		this.addChild(nodeOrClass);
		return this;
	}

	// === Scene-Wide Queries ===
	override findAll(tag: string): Node[] {
		return super.findAll(tag);
	}

	override findAllByType<T extends Node>(type: NodeConstructor<T>): T[] {
		return super.findAllByType(type);
	}

	count(tag: string): number {
		return this.findAll(tag).length;
	}

	// === Scene Transitions ===
	switchTo(sceneNameOrDef: string | SceneDefinition): void {
		if (typeof sceneNameOrDef === "string") {
			this._game._switchScene(sceneNameOrDef);
		} else {
			this._game._switchScene(sceneNameOrDef.name, sceneNameOrDef.setup);
		}
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

	/** @internal Process all pending destructions. */
	_processDestroyQueue(): void {
		const queue = this._destructionQueue;
		this._destructionQueue = [];
		for (const node of queue) {
			node._processDestroy();
		}
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
