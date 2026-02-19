import { type Signal, signal } from "./signal.js";

/** Payload emitted when a reactive state property changes. */
export interface ChangePayload<T, K extends keyof T & string = keyof T & string> {
	key: K;
	value: T[K];
	previous: T[K];
}

/** API methods available on a ReactiveState proxy. */
export interface ReactiveStateAPI<T extends Record<string, unknown>> {
	/** Fires on any property change. */
	readonly changed: Signal<ChangePayload<T>>;

	/** Get a signal for a specific property. Created lazily on first call. */
	on<K extends keyof T & string>(key: K): Signal<{ value: T[K]; previous: T[K] }>;

	/** Reset all properties to their initial values. Emits signals for each changed key. */
	reset(): void;

	/** Return a plain object copy of the current state. */
	snapshot(): Readonly<T>;
}

/** A proxy that acts as both T (read/write properties) and ReactiveStateAPI<T>. */
export type ReactiveState<T extends Record<string, unknown>> = T & ReactiveStateAPI<T>;

/**
 * Create a reactive state object backed by a Proxy.
 * Property writes emit `changed` and per-key signals.
 * Same-value writes are no-ops (no signal emitted).
 *
 * @example
 * const state = reactiveState({ health: 3, coins: 0 });
 * state.on("health").connect(({ value }) => updateHearts(value));
 * state.health = 2; // fires changed + on("health")
 * state.reset();    // restores { health: 3, coins: 0 }
 */
export function reactiveState<T extends Record<string, unknown>>(initial: T): ReactiveState<T> {
	const data = { ...initial } as Record<string, unknown>;
	const initialSnapshot = { ...initial } as Record<string, unknown>;
	const changedSignal: Signal<ChangePayload<T>> = signal();
	const keySignals = new Map<string, Signal<{ value: unknown; previous: unknown }>>();

	function getKeySignal<K extends keyof T & string>(
		key: K,
	): Signal<{ value: T[K]; previous: T[K] }> {
		let s = keySignals.get(key);
		if (!s) {
			s = signal();
			keySignals.set(key, s);
		}
		return s as Signal<{ value: T[K]; previous: T[K] }>;
	}

	function reset(): void {
		for (const key of Object.keys(initialSnapshot)) {
			const v = initialSnapshot[key];
			const prev = data[key];
			if (prev !== v) {
				data[key] = v;
				changedSignal.emit({
					key: key as keyof T & string,
					value: v as T[keyof T & string],
					previous: prev as T[keyof T & string],
				});
				keySignals.get(key)?.emit({ value: v, previous: prev });
			}
		}
	}

	function snapshot(): Readonly<T> {
		return { ...data } as Readonly<T>;
	}

	const handler: ProxyHandler<Record<string, unknown>> = {
		get(_, prop: string | symbol) {
			if (prop === "changed") return changedSignal;
			if (prop === "on") return getKeySignal;
			if (prop === "reset") return reset;
			if (prop === "snapshot") return snapshot;
			return data[prop as string];
		},
		set(_, prop: string | symbol, value: unknown) {
			const key = prop as string;
			const prev = data[key];
			if (prev === value) return true;
			data[key] = value;
			changedSignal.emit({
				key: key as keyof T & string,
				value: value as T[keyof T & string],
				previous: prev as T[keyof T & string],
			});
			keySignals.get(key)?.emit({ value, previous: prev });
			return true;
		},
	};

	return new Proxy(data, handler) as ReactiveState<T>;
}
