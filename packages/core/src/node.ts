import { type Signal, signal } from "./signal.js";
import type { NodeSnapshot } from "./snapshot-types.js";

export type PauseMode = "inherit" | "independent";

export interface NodeConstructor<T extends Node = Node> {
	new (): T;
}

export type NodeProps = {
	name?: string;
	pauseMode?: PauseMode;
};

let nextNodeId = 0;

export class Node {
	// === Identity ===
	name: string;
	readonly id: number;

	// === Tree ===
	private _parent: Node | null = null;
	private _children: Node[] = [];

	// === Lifecycle State ===
	private _isReady = false;
	private _isInsideTree = false;
	private _isDestroyed = false;
	private _pendingDestroy = false;

	// === Pause Mode ===
	pauseMode: PauseMode = "inherit";

	// === Tags ===
	private _tags: Set<string> = new Set();

	// === Built-in Signals ===
	readonly treeEntered: Signal<void> = signal<void>();
	readonly treeExited: Signal<void> = signal<void>();
	readonly readySignal: Signal<void> = signal<void>();
	readonly destroying: Signal<void> = signal<void>();

	constructor() {
		this.id = nextNodeId++;
		this.name = this.constructor.name;
	}

	// === Tree Accessors ===
	get parent(): Node | null {
		return this._parent;
	}

	get children(): ReadonlyArray<Node> {
		return this._children;
	}

	get isReady(): boolean {
		return this._isReady;
	}

	get isInsideTree(): boolean {
		return this._isInsideTree;
	}

	get isDestroyed(): boolean {
		return this._isDestroyed;
	}

	// === Tags ===
	tag(...tags: string[]): this {
		for (const t of tags) this._tags.add(t);
		return this;
	}

	untag(...tags: string[]): this {
		for (const t of tags) this._tags.delete(t);
		return this;
	}

	hasTag(tag: string): boolean {
		return this._tags.has(tag);
	}

	get tags(): ReadonlySet<string> {
		return this._tags;
	}

	// === Tree Manipulation ===
	addChild(node: Node): this;
	addChild<T extends Node>(NodeClass: NodeConstructor<T>): T;
	addChild(nodeOrClass: Node | NodeConstructor<Node>): Node | this {
		if (typeof nodeOrClass === "function") {
			const node = new nodeOrClass();
			this._addChildNode(node);
			return node;
		}

		this._addChildNode(nodeOrClass);
		return this;
	}

	private _addChildNode(node: Node): void {
		if (node === this) {
			throw new Error("Cannot add a node to itself.");
		}
		if (node._parent) {
			throw new Error(
				`Cannot add "${node.name}" to "${this.name}": node already has a parent "${node._parent.name}". Call removeSelf() first.`,
			);
		}
		if (this._isAncestorOf(node)) {
			throw new Error(`Cannot add an ancestor as a child (would create cycle).`);
		}

		this._children.push(node);
		node._parent = this;

		// If this node is inside a tree, propagate entry
		if (this._isInsideTree || this._isSceneRoot()) {
			this._enterTreeRecursive(node);
		}
	}

	private _isAncestorOf(node: Node): boolean {
		let current: Node | null = this._parent;
		while (current) {
			if (current === node) return true;
			current = current._parent;
		}
		return false;
	}

	private _isSceneRoot(): boolean {
		// A scene root has no parent but is considered inside the tree
		// This is set by the Game when it activates a scene
		return false;
	}

	/** @internal Called by the scene/game to mark this node as inside the tree */
	_setInsideTree(value: boolean): void {
		this._isInsideTree = value;
	}

	/** @internal Called by Game to mark the scene root as ready (bypasses _enterTreeRecursive). */
	_markReady(): void {
		this._isReady = true;
	}

	private _enterTreeRecursive(node: Node): void {
		node._isInsideTree = true;
		node.onEnterTree();
		node.treeEntered.emit();

		// Enter children first (depth-first)
		for (const child of node._children) {
			this._enterTreeRecursive(child);
		}

		// Ready is called bottom-up (children before parent), only on first entry
		if (!node._isReady) {
			node._isReady = true;
			node.onReady();
			node.readySignal.emit();

			// Debug instrumentation: log onReady
			const game = node.game;
			if (game?.debug) {
				const tags = node._tags.size > 0 ? ` tags=[${[...node._tags].join(",")}]` : "";
				game.debugLog.write(
					{
						category: "lifecycle",
						message: `${node.constructor.name}#${node.id}.onReady${tags}`,
					},
					game.fixedFrame,
					game.elapsed,
				);
			}
		}
	}

	/** Remove a child from this node. The child is NOT destroyed — just detached. */
	removeChild(node: Node): void {
		const idx = this._children.indexOf(node);
		if (idx === -1) return;

		if (node._isInsideTree) {
			this._exitTreeRecursive(node);
		}

		this._children.splice(idx, 1);
		node._parent = null;
	}

	private _exitTreeRecursive(node: Node): void {
		node.onExitTree();
		node.treeExited.emit();

		for (const child of node._children) {
			this._exitTreeRecursive(child);
		}

		node._isInsideTree = false;
	}

	/** Remove this node from its parent. */
	removeSelf(): void {
		if (this._parent) {
			this._parent.removeChild(this);
		}
	}

	// === Tree Queries ===
	find(name: string): Node | null {
		for (const child of this._children) {
			if (child.name === name) return child;
			const found = child.find(name);
			if (found) return found;
		}
		return null;
	}

	findAll(tag: string): Node[] {
		const result: Node[] = [];
		this._collectByTag(tag, result);
		return result;
	}

	private _collectByTag(tag: string, result: Node[]): void {
		if (this.hasTag(tag)) result.push(this);
		for (const child of this._children) {
			child._collectByTag(tag, result);
		}
	}

	getChild<T extends Node>(type: NodeConstructor<T>): T | null {
		return (this._children.find((c) => c instanceof type) as T) ?? null;
	}

	getChildren<T extends Node>(type: NodeConstructor<T>): T[] {
		return this._children.filter((c) => c instanceof type) as T[];
	}

	findByType<T extends Node>(type: NodeConstructor<T>): T | null {
		for (const child of this._children) {
			if (child instanceof type) return child;
			const found = child.findByType(type);
			if (found) return found;
		}
		return null;
	}

	findAllByType<T extends Node>(type: NodeConstructor<T>): T[] {
		const result: T[] = [];
		this._collectByType(type, result);
		return result;
	}

	private _collectByType<T extends Node>(type: NodeConstructor<T>, result: T[]): void {
		if (this instanceof type) result.push(this as unknown as T);
		for (const child of this._children) {
			child._collectByType(type, result);
		}
	}

	// === Scene/Game Access ===
	get scene(): import("./scene.js").Scene | null {
		// Walk up to root and check if it's a Scene
		// biome-ignore lint/suspicious/noExplicitAny: internal scene detection
		let current: any = this;
		while (current) {
			if (current._isScene) {
				return current as import("./scene.js").Scene;
			}
			current = current._parent;
		}
		return null;
	}

	get game(): import("./game.js").Game | null {
		const s = this.scene;
		return s ? s.game : null;
	}

	// === Serialization ===
	serialize(): NodeSnapshot {
		return {
			id: this.id,
			type: this.constructor.name,
			name: this.name,
			tags: [...this._tags],
			children: this._children.map((c) => c.serialize()),
		};
	}

	// === Lifecycle Methods (override in subclasses) ===
	onReady(): void {}
	onEnterTree(): void {}
	onExitTree(): void {}
	onUpdate(_dt: number): void {}
	onFixedUpdate(_dt: number): void {}
	onDestroy(): void {}

	// === Destruction ===
	destroy(): void {
		if (this._isDestroyed) return;
		this._isDestroyed = true;
		this._pendingDestroy = true;
		this.scene?._queueDestroy(this);
	}

	/** @internal Process pending destruction. Called by game loop cleanup. */
	_processDestroy(): void {
		if (!this._pendingDestroy) return;
		this._pendingDestroy = false;

		// Debug instrumentation: log onDestroy
		const game = this.game;
		if (game?.debug) {
			game.debugLog.write(
				{
					category: "lifecycle",
					message: `${this.constructor.name}#${this.id}.onDestroy`,
				},
				game.fixedFrame,
				game.elapsed,
			);
		}

		this.destroying.emit();

		// Destroy children first (depth-first)
		for (const child of [...this._children]) {
			child._isDestroyed = true;
			child._pendingDestroy = true;
			child._processDestroy();
		}

		this.onDestroy();

		if (this._isInsideTree) {
			this.onExitTree();
			this.treeExited.emit();
		}

		if (this._parent) {
			const idx = this._parent._children.indexOf(this);
			if (idx !== -1) this._parent._children.splice(idx, 1);
			this._parent = null;
		}

		this._isInsideTree = false;

		// Disconnect all signals LAST
		this.treeEntered.disconnectAll();
		this.treeExited.disconnectAll();
		this.readySignal.disconnectAll();
		this.destroying.disconnectAll();
	}

	// === Pause Mode Resolution ===
	/** @internal */
	_shouldProcess(scenePaused: boolean): boolean {
		const mode = this._resolvePauseMode();
		if (mode === "independent") return true;
		return !scenePaused;
	}

	private _resolvePauseMode(): PauseMode {
		if (this.pauseMode !== "inherit") return this.pauseMode;
		if (this._parent) return this._parent._resolvePauseMode();
		return "inherit";
	}
}
