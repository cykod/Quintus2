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

/**
 * A zero-arg class, usable to *construct* a node — the engine calls `new NodeClass()`
 * with no arguments and then assigns props, so the constructor **must** be callable
 * with zero args. Required by every construction site: {@link Node.add},
 * `NodePool`, the JSX factory, and `TileMap.spawnObjects`.
 *
 * A class with required constructor parameters deliberately fails to compile here.
 * Instantiate it yourself and pass the instance instead:
 *
 * ```ts
 * class Target extends Node2D {
 *   constructor(public spot: Vec2) { super(); }
 * }
 * scene.add(new Target(new Vec2(10, 20))); // instance overload — always allowed
 * ```
 *
 * @see {@link NodeType} for the looser token used by the query methods.
 */
export interface NodeConstructor<T extends Node = Node> {
	new (): T;
}

/**
 * A class used purely as a runtime `instanceof` **type token** — for the query and
 * guard methods ({@link Node.is}, {@link Node.findByType}, {@link Node.getChild}, …)
 * that never instantiate it.
 *
 * Unlike {@link NodeConstructor} it accepts node classes with required constructor
 * args, because `instanceof` does not care about arity. Abstract base classes are
 * accepted too, so a query can be written against a shared base.
 *
 * ```ts
 * class Target extends Node2D {
 *   constructor(public spot: Vec2) { super(); }
 * }
 * scene.findAllByType(Target); // OK — no cast, despite the required arg
 * scene.add(Target);           // compile error — `add` constructs, so it needs NodeConstructor
 * ```
 */
export type NodeType<T extends Node = Node> = abstract new (...args: never[]) => T;

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

	/**
	 * Detach a child **immediately and synchronously**. The child is *not* destroyed:
	 * `onExitTree`/`treeExited` fire for it and its whole subtree (it is leaving the
	 * tree), but `destroying`, `onDestroy` and the signal `disconnectAll` teardown do
	 * **not** run, and `isDestroyed` stays `false`. Use this to move a node between
	 * parents or to park it for later re-`add()`ing — not to get rid of it.
	 *
	 * Because the splice happens immediately, calling this from inside `onFixedUpdate`
	 * mutates the array the update walk is iterating, so a sibling can be skipped for
	 * that frame. {@link Node.destroy} has no such hazard — it never mutates the tree.
	 *
	 * **Footgun — never pair the two:**
	 * ```ts
	 * parent.removeChild(child);
	 * child.destroy();  // ← silently does nothing
	 * ```
	 * `removeChild()` nulls the parent link, so `destroy()` can no longer walk up to the
	 * scene's destroy queue: the node is flagged `isDestroyed` but is never processed,
	 * and `onDestroy` never runs. To remove a node *with* its lifecycle, call
	 * `destroy()` on its own — since a destroyed node is invisible to every tree query
	 * in the same tick, there is no reason to detach it first.
	 *
	 * @see {@link Node.destroy} for removal *with* teardown.
	 * @see [Embedding quintus2](https://github.com/cykod/quintus2/blob/main/docs/embedding.md)
	 */
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

	/**
	 * Detach this node from its parent immediately. No-op at the root.
	 * Identical contract to {@link Node.removeChild} (which it delegates to):
	 * synchronous, **not** a destroy, and never to be followed by `destroy()`.
	 */
	removeSelf(): void {
		if (this._parent) {
			this._parent.removeChild(this);
		}
	}

	// === Type Guard ===

	/**
	 * Runtime `instanceof` check that narrows the static type:
	 * `if (node.is(Actor)) { node.move(dt); }`
	 *
	 * Unlike the tree queries below this is a **pure type guard** and deliberately
	 * ignores `isDestroyed` — narrowing must not depend on lifecycle state, so
	 * `node.is(Actor)` stays `true` for a node awaiting end-of-frame teardown.
	 * Check {@link Node.isDestroyed} yourself if you are holding a reference across
	 * frames.
	 *
	 * Accepts any node class (`NodeType`), including abstract ones and ones
	 * with required constructor arguments.
	 */
	is<T extends Node>(type: NodeType<T>): this is T {
		return this instanceof type;
	}

	// === Tree Queries ===
	// Invariant: a destroyed node and its whole subtree are invisible to every
	// tree query in the same tick — including when the destroyed node is the
	// receiver. `destroy()` flags only the receiver (descendants are flagged
	// later, in `_processDestroy`), so each recursive walk needs both an
	// `this.isDestroyed` receiver guard and a per-child skip.

	/**
	 * Depth-first search for the first **descendant** named `name`. Excludes `this`.
	 * Returns `null` when nothing matches.
	 *
	 * Names are not unique or indexed — this is an O(n) walk of the subtree, fine for
	 * setup and occasional lookups, not for per-frame use. Cache the result instead.
	 *
	 * Skips destroyed nodes and their whole subtrees, so a node `destroy()`ed earlier
	 * in the same tick is never returned even though it is still spliced into
	 * `parent.children` until end-of-frame cleanup.
	 *
	 * @see {@link Node.destroy} for the deferral this compensates for.
	 */
	find(name: string): Node | null {
		if (this.isDestroyed) return null;
		for (const child of this._children) {
			if (child.isDestroyed) continue;
			if (child.name === name) return child;
			const found = child.find(name);
			if (found) return found;
		}
		return null;
	}

	/**
	 * Collect every node in this subtree carrying `tag`, optionally narrowed by an
	 * `instanceof` check. **Includes `this`** if it is tagged — `scene.findAll("enemy")`
	 * and `enemy.findAll("enemy")` therefore differ by the receiver.
	 *
	 * Order is depth-first, receiver-first, and stable across runs (the tree order),
	 * which is what makes tag-driven iteration deterministic.
	 *
	 * Destroyed nodes and their subtrees are skipped, so this agrees with
	 * `Scene.count()` (which delegates here) in the same tick as a `destroy()`.
	 *
	 * ```ts
	 * for (const coin of scene.findAll("coin", Sensor)) coin.destroy();
	 * scene.findAll("coin").length; // → 0, same tick
	 * ```
	 */
	findAll(tag: string): Node[];
	findAll<T extends Node>(tag: string, type: NodeType<T>): T[];
	findAll(tag: string, type?: NodeType<Node>): Node[] {
		const result: Node[] = [];
		this._collectByTag(tag, result);
		if (type) return result.filter((n) => n instanceof type);
		return result;
	}

	/**
	 * First node in this subtree carrying `tag`, optionally narrowed by an
	 * `instanceof` check. **Includes `this`**, and depth-first order makes the
	 * receiver the first candidate. Returns `null` when nothing matches.
	 *
	 * Skips destroyed nodes and their subtrees. Short-circuits on the first hit, so
	 * prefer it over `findAll(tag)[0]`.
	 */
	findFirst(tag: string): Node | null;
	findFirst<T extends Node>(tag: string, type: NodeType<T>): T | null;
	findFirst(tag: string, type?: NodeType<Node>): Node | null {
		return this._findFirstByTag(tag, type ?? null);
	}

	private _findFirstByTag(tag: string, type: NodeType<Node> | null): Node | null {
		if (this.isDestroyed) return null; // skip destroyed node + subtree
		if (this.hasTag(tag) && (!type || this instanceof type)) return this;
		for (const child of this._children) {
			const found = child._findFirstByTag(tag, type);
			if (found) return found;
		}
		return null;
	}

	private _collectByTag(tag: string, result: Node[]): void {
		if (this.isDestroyed) return; // skip destroyed node + subtree
		if (this.hasTag(tag)) result.push(this);
		for (const child of this._children) {
			child._collectByTag(tag, result);
		}
	}

	/**
	 * First **direct child** matching `type`. Does not recurse and does not consider
	 * `this`. Returns `null` when there is none.
	 *
	 * This is the standard way to reach a node's own composed parts — e.g. an
	 * {@link Node.build}-declared `CollisionShape` or sprite:
	 * ```ts
	 * const shape = actor.getChild(CollisionShape);
	 * ```
	 *
	 * Destroyed children are skipped in the same tick they are destroyed. Note the
	 * physics **solver** deliberately does not use this — a body destroyed mid-tick
	 * stays solid for the rest of that step, so nothing falls through a platform that
	 * was destroyed during the frame.
	 */
	getChild<T extends Node>(type: NodeType<T>): T | null {
		if (this.isDestroyed) return null;
		return (this._children.find((c) => !c.isDestroyed && c instanceof type) as T) ?? null;
	}

	/**
	 * All **direct children** matching `type`, in child order. Does not recurse and
	 * does not consider `this`. Returns `[]` (never `null`) when there is no match, and
	 * `[]` when the receiver itself is destroyed.
	 *
	 * Destroyed children are skipped in the same tick they are destroyed.
	 */
	getChildren<T extends Node>(type: NodeType<T>): T[] {
		if (this.isDestroyed) return [];
		return this._children.filter((c) => !c.isDestroyed && c instanceof type) as T[];
	}

	/**
	 * Depth-first search for the first **descendant** matching `type`.
	 * **Excludes `this`** — contrast {@link Node.findAllByType}, which includes it.
	 * Returns `null` when nothing matches.
	 *
	 * Accepts any node class (`NodeType`) — abstract classes and classes with
	 * required constructor arguments both work, since the check is a runtime
	 * `instanceof`:
	 * ```ts
	 * class Target extends Node2D {
	 *   constructor(public spot: Vec2) { super(); }
	 * }
	 * const target = scene.findByType(Target); // Target | null, no cast needed
	 * ```
	 *
	 * Skips destroyed nodes and their subtrees.
	 */
	findByType<T extends Node>(type: NodeType<T>): T | null {
		if (this.isDestroyed) return null;
		for (const child of this._children) {
			if (child.isDestroyed) continue;
			if (child instanceof type) return child;
			const found = child.findByType(type);
			if (found) return found;
		}
		return null;
	}

	/**
	 * Every node in this subtree matching `type`, depth-first. **Includes `this`** —
	 * `enemy.findAllByType(Enemy)` contains `enemy` itself, unlike
	 * {@link Node.findByType}, which starts at the children.
	 *
	 * Accepts any node class (`NodeType`) — a base class returns every subclass
	 * instance too, and abstract base classes are allowed.
	 *
	 * Skips destroyed nodes and their subtrees, so this is safe to call in the same
	 * tick as a bulk `destroy()` — the standard "clear and rebuild" reset:
	 * ```ts
	 * for (const t of scene.findAllByType(Target)) t.destroy();
	 * scene.findAllByType(Target).length; // → 0, same tick
	 * ```
	 */
	findAllByType<T extends Node>(type: NodeType<T>): T[] {
		const result: T[] = [];
		this._collectByType(type, result);
		return result;
	}

	private _collectByType<T extends Node>(type: NodeType<T>, result: T[]): void {
		if (this.isDestroyed) return; // skip destroyed node + subtree
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

	// === Pool Reset ===

	/**
	 * @internal Reset engine-level state for object pool reuse.
	 * Called by NodePool.acquire() before user reset().
	 * Subclasses must call super._poolReset().
	 */
	_poolReset(): void {
		// Fresh ID so the node looks "new" to the physics world and tree
		(this as { id: number }).id = nextNodeId++;

		// Reset lifecycle flags so build() + onReady() re-run on next tree entry
		this._isReady = false;
		this._isInsideTree = false;
		this._isDestroyed = false;
		this._pendingDestroy = false;

		// Clear tags
		this._tags.clear();

		// Reset pause mode
		this.pauseMode = "inherit";

		// Reset name to class name
		this.name = this.constructor.name;

		// Detach all children (they may be stale build() children from previous use)
		for (const child of [...this._children]) {
			child._parent = null;
		}
		this._children.length = 0;
		this._parent = null;

		// Disconnect all signal listeners
		this.treeEntered.disconnectAll();
		this.treeExited.disconnectAll();
		this.readySignal.disconnectAll();
		this.destroying.disconnectAll();
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
	/**
	 * Marks this node for destruction. **Deferred, but immediately invisible:**
	 * `isDestroyed` is set synchronously, so this node *and its whole subtree*
	 * stop being returned by every tree query (`find`, `findAll`, `findFirst`,
	 * `findByType`, `findAllByType`, `getChild`, `getChildren`, `Scene.count`)
	 * in the same tick. The splice out of the parent's child list and the full
	 * teardown (`destroying`, `onDestroy`, `onExitTree`, `treeExited`, child
	 * recursion, signal disconnect) run at end-of-frame cleanup — so the node is
	 * still present in `parent.children` until then, and it is safe to call this
	 * from `onFixedUpdate` without perturbing the current walk.
	 *
	 * The physics **solver** deliberately does not follow the query rule: a body
	 * destroyed mid-tick keeps colliding for the remainder of that step, so an actor
	 * never falls through a platform destroyed underneath it. Physics *scene* queries
	 * (`raycast`, `queryCircle`, `findNearest`, …) do follow it and agree with the tree
	 * queries. In short — queries answer "is it still in the game?" immediately; the
	 * solver answers "what did this step collide with?" unchanged.
	 *
	 * A node with no scene ancestor has nowhere to queue: it is flagged `isDestroyed`,
	 * but no teardown ever runs. That is why the `removeChild()`-then-`destroy()`
	 * pairing below is a silent no-op.
	 *
	 * @example Destroying from a lifecycle hook, then re-querying in the same tick
	 * ```ts
	 * class Wave extends Node {
	 *   override onFixedUpdate(): void {
	 *     for (const e of this.findAll("enemy")) {
	 *       if (e.hasTag("dead")) e.destroy();   // safe: no tree mutation
	 *     }
	 *     // Same tick, already consistent — the destroyed enemies are not counted.
	 *     if (this.findAll("enemy").length === 0) this.tag("wave-cleared");
	 *   }
	 * }
	 * ```
	 *
	 * @see {@link Node.removeChild} for immediate detach *without* any destroy hooks.
	 * Do not call `removeChild()` and then `destroy()`: `removeChild()` nulls the
	 * parent, so `destroy()` can no longer reach the scene's destroy queue and
	 * the whole lifecycle is silently skipped.
	 * @see [Embedding quintus2](https://github.com/cykod/quintus2/blob/main/docs/embedding.md)
	 */
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
