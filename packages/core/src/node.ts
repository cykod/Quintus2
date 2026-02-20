import { type Signal, signal } from "./signal.js";
import type { NodeSnapshot } from "./snapshot-types.js";
import type { Timer } from "./timer.js";

export type PauseMode = "inherit" | "independent";

/** Symbol used to distinguish Node classes from plain functions in JSX. */
export const IS_NODE_CLASS = Symbol.for("quintus:NodeClass");

/** @internal Symbol for tracking the current build() owner across packages. */
const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");

/** @internal Symbol for the dollar-ref resolver registered by @quintus/jsx. */
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");

export interface NodeConstructor<T extends Node = Node> {
	new (): T;
}

export type NodeProps = {
	name?: string;
	pauseMode?: PauseMode;
};

let nextNodeId = 0;

/** @internal Reset ID counter for deterministic testing. */
export function _resetNodeIdCounter(): void {
	nextNodeId = 0;
}

export class Node {
	static readonly [IS_NODE_CLASS] = true;

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

	// === Bulk Property Setter ===
	/** Set multiple properties at once. Returns this for chaining. */
	set(props: Partial<this>): this {
		Object.assign(this, props);
		return this;
	}

	// === Tree Manipulation ===
	add(node: Node): this;
	add<T extends Node>(NodeClass: NodeConstructor<T>, props?: Partial<T>): T;
	add(nodeOrClass: Node | NodeConstructor<Node>, props?: Partial<Node>): Node | this {
		if (typeof nodeOrClass === "function") {
			const node = new nodeOrClass();
			if (props) Object.assign(node, props);
			this._addChildNode(node);
			return node;
		}

		this._addChildNode(nodeOrClass);
		return this;
	}

	/** @deprecated Use add() instead. */
	addChild(node: Node): this;
	/** @deprecated Use add() instead. */
	addChild<T extends Node>(NodeClass: NodeConstructor<T>, props?: Partial<T>): T;
	addChild(nodeOrClass: Node | NodeConstructor<Node>, props?: Partial<Node>): Node | this {
		if (typeof nodeOrClass === "function") {
			const node = new nodeOrClass();
			if (props) Object.assign(node, props);
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
		this._onChildAdded(node);

		// If this node is inside a tree, propagate entry
		if (this._isInsideTree || this._isSceneRoot()) {
			this._enterTreeRecursive(node);
		}

		this.gameOrNull?._markRenderDirty();
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

		// Process build() on first entry — add built children before recursing
		if (!node._isReady) {
			const g = globalThis as Record<symbol, unknown>;
			const prevOwner = g[CURRENT_BUILD_OWNER];
			g[CURRENT_BUILD_OWNER] = node;

			const built = node.build();

			// Resolve $ refs if @quintus/jsx is loaded
			const resolve = g[RESOLVE_BUILD_REFS];
			if (typeof resolve === "function") (resolve as () => void)();

			// Restore (not null-clear, because build() can call add() which nests)
			g[CURRENT_BUILD_OWNER] = prevOwner;

			if (built !== null) {
				const nodes = Array.isArray(built) ? (built.flat(Infinity) as unknown[]) : [built];
				for (const child of nodes) {
					if (child instanceof Node && !child._parent) {
						// Direct push — skip _addChildNode to avoid nested _enterTreeRecursive
						node._children.push(child);
						child._parent = node;
						node._onChildAdded(child);
					}
				}
			}
		}

		// Enter children (includes both pre-existing and built children)
		for (const child of node._children) {
			if (!child._isInsideTree) {
				this._enterTreeRecursive(child);
			}
		}

		// Ready is called bottom-up (children before parent), only on first entry
		if (!node._isReady) {
			node._isReady = true;
			node.onReady();
			node.readySignal.emit();

			// Debug instrumentation: log onReady
			const game = node.gameOrNull;
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

		this.gameOrNull?._markRenderDirty();
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

	// === Type Guard ===

	/** Type-narrowing check: `if (node.is(Actor)) { node.move(dt); }` */
	is<T extends Node>(type: NodeConstructor<T>): this is T {
		return this instanceof type;
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

	findAll(tag: string): Node[];
	findAll<T extends Node>(tag: string, type: NodeConstructor<T>): T[];
	findAll(tag: string, type?: NodeConstructor<Node>): Node[] {
		const result: Node[] = [];
		this._collectByTag(tag, result);
		if (type) return result.filter((n) => n instanceof type);
		return result;
	}

	/** Find the first node with the given tag, optionally narrowed by type. */
	findFirst(tag: string): Node | null;
	findFirst<T extends Node>(tag: string, type: NodeConstructor<T>): T | null;
	findFirst(tag: string, type?: NodeConstructor<Node>): Node | null {
		return this._findFirstByTag(tag, type ?? null);
	}

	private _findFirstByTag(tag: string, type: NodeConstructor<Node> | null): Node | null {
		if (this.hasTag(tag) && (!type || this instanceof type)) return this;
		for (const child of this._children) {
			const found = child._findFirstByTag(tag, type);
			if (found) return found;
		}
		return null;
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

	/** Returns the Scene this node belongs to. Throws if not in a tree. */
	get scene(): import("./scene.js").Scene {
		const s = this.sceneOrNull;
		if (!s) {
			throw new Error(
				`${this.constructor.name}#${this.id} "${this.name}" is not inside a scene tree. ` +
					"Use sceneOrNull if you need to check outside lifecycle hooks.",
			);
		}
		return s;
	}

	/** Returns the Scene this node belongs to, or null if not in a tree. */
	get sceneOrNull(): import("./scene.js").Scene | null {
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

	/** Returns the Game instance. Throws if not in a tree. */
	get game(): import("./game.js").Game {
		const g = this.gameOrNull;
		if (!g) {
			throw new Error(
				`${this.constructor.name}#${this.id} "${this.name}" is not inside a scene tree. ` +
					"Use gameOrNull if you need to check outside lifecycle hooks.",
			);
		}
		return g;
	}

	/** Returns the Game instance, or null if not in a tree. */
	get gameOrNull(): import("./game.js").Game | null {
		const s = this.sceneOrNull;
		return s ? s.game : null;
	}

	// === Timer Convenience ===

	/** Run a callback once after `seconds` of fixed-time. Returns the Timer for manual stop. */
	after(seconds: number, callback: () => void): Timer {
		const timer = _createTimer();
		timer.duration = seconds;
		timer.repeat = false;
		timer.autostart = true;
		timer.timeout.connect(() => {
			callback();
			timer.destroy();
		});
		this.add(timer);
		return timer;
	}

	/** Run a callback every `seconds` of fixed-time. Returns the Timer for manual stop. */
	every(seconds: number, callback: () => void): Timer {
		const timer = _createTimer();
		timer.duration = seconds;
		timer.repeat = true;
		timer.autostart = true;
		timer.timeout.connect(callback);
		this.add(timer);
		return timer;
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

	/** Called after a child is added to this node. Override in subclasses (e.g., Layer). */
	protected _onChildAdded(_child: Node): void {}

	// === Declarative Build (override with @quintus/jsx) ===
	/** Override to declaratively define child nodes (used with @quintus/jsx). */
	build(): Node | Node[] | null {
		return null;
	}

	// === Destruction ===
	destroy(): void {
		if (this._isDestroyed) return;
		this._isDestroyed = true;
		this._pendingDestroy = true;
		this.sceneOrNull?._queueDestroy(this);
	}

	/** @internal Process pending destruction. Called by game loop cleanup. */
	_processDestroy(): void {
		if (!this._pendingDestroy) return;
		this._pendingDestroy = false;

		// Debug instrumentation: log onDestroy
		const game = this.gameOrNull;
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

// Lazy Timer factory to break circular import (Timer extends Node).
// The Timer class is set by timer.ts when it loads, after node.ts has finished.
let _TimerFactory: (() => Timer) | null = null;

/** @internal Called by timer.ts to register the factory. */
export function _registerTimerFactory(factory: () => Timer): void {
	_TimerFactory = factory;
}

function _createTimer(): Timer {
	if (!_TimerFactory) {
		throw new Error("Timer not available. Ensure @quintus/core Timer is imported.");
	}
	return _TimerFactory();
}
