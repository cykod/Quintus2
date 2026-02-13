/** Callback type for signal handlers. */
export type SignalHandler<T> = (payload: T) => void;

/** Connection handle returned by connect(). Call disconnect() to remove. */
export interface SignalConnection {
	disconnect(): void;
	readonly connected: boolean;
}

/**
 * Typed signal — the core communication primitive.
 * Declared as class properties: `readonly died = signal<void>();`
 */
export class Signal<T = void> {
	private handlers: Array<SignalHandler<T>> = [];

	/** Emit this signal with the given payload. All connected handlers fire synchronously. */
	emit(...args: T extends void ? [] | [T] : [T]): void {
		const payload = args[0] as T;
		const snapshot = [...this.handlers];
		for (const handler of snapshot) {
			handler(payload);
		}
	}

	/** Connect a handler. Returns a SignalConnection for disconnection. */
	connect(handler: SignalHandler<T>): SignalConnection {
		this.handlers.push(handler);
		const connection: SignalConnection = {
			get connected() {
				return self.handlers.includes(handler);
			},
			disconnect: () => {
				this.disconnect(handler);
			},
		};
		const self = this;
		return connection;
	}

	/** Connect a handler that fires once, then auto-disconnects. */
	once(handler: SignalHandler<T>): SignalConnection {
		const wrapper: SignalHandler<T> = (payload: T) => {
			this.disconnect(wrapper);
			handler(payload);
		};
		return this.connect(wrapper);
	}

	/** Disconnect a specific handler. */
	disconnect(handler: SignalHandler<T>): void {
		const idx = this.handlers.indexOf(handler);
		if (idx === -1) return;
		this.handlers.splice(idx, 1);
	}

	/** Remove all handlers. Called automatically when the owning node is destroyed. */
	disconnectAll(): void {
		this.handlers.length = 0;
	}

	/** Number of connected handlers. */
	get listenerCount(): number {
		return this.handlers.length;
	}

	/** Whether any handlers are connected. */
	get hasListeners(): boolean {
		return this.handlers.length > 0;
	}
}

/**
 * Factory function for creating signals. Used in class declarations:
 *   readonly died = signal<void>();
 *   readonly healthChanged = signal<{ current: number; max: number }>();
 */
export function signal<T = void>(): Signal<T> {
	return new Signal<T>();
}
