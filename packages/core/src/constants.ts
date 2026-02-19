import { type Signal, signal } from "./signal.js";

/** Metadata for a registered constant. */
export interface ConstantDef<T = unknown> {
	name: string;
	value: T;
	description?: string;
	category?: string;
	min?: number;
	max?: number;
	step?: number;
}

/**
 * Named constants registry for tweakable game values.
 * Constants are defined with a name, default value, and optional metadata.
 * Values can be overridden at runtime (debug panel, MCP, JSON file).
 */
export class ConstantsRegistry {
	private _values = new Map<string, unknown>();
	private _defs = new Map<string, ConstantDef>();

	/** Fires when any constant changes. */
	readonly changed: Signal<{ name: string; value: unknown; previous: unknown }> = signal();

	/**
	 * Register a constant. Returns the current value (default on first call,
	 * existing value if already registered).
	 */
	define<T>(
		name: string,
		defaultValue: T,
		options?: Partial<Omit<ConstantDef<T>, "name" | "value">>,
	): T {
		if (!this._values.has(name)) {
			this._values.set(name, defaultValue);
			this._defs.set(name, { name, value: defaultValue, ...options });
		}
		return this._values.get(name) as T;
	}

	/** Get a constant's current value. Throws if not registered. */
	get<T>(name: string): T {
		if (!this._values.has(name)) {
			throw new Error(`Unknown constant: "${name}"`);
		}
		return this._values.get(name) as T;
	}

	/** Set a constant's value. Emits `changed`. */
	set<T>(name: string, value: T): void {
		const previous = this._values.get(name);
		this._values.set(name, value);
		this.changed.emit({ name, value, previous });
	}

	/** Load constants from a JSON object. Only updates already-registered keys. */
	load(data: Record<string, unknown>): void {
		for (const [name, value] of Object.entries(data)) {
			if (this._values.has(name)) {
				this.set(name, value);
			}
		}
	}

	/** Export all constants as a plain object. */
	export(): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const [name, value] of this._values) {
			result[name] = value;
		}
		return result;
	}

	/** Get all constant definitions with metadata. */
	get definitions(): ReadonlyMap<string, ConstantDef> {
		return this._defs;
	}
}
