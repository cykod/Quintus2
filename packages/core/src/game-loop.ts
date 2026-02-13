export interface GameLoopConfig {
	/** Fixed timestep in seconds. Default: 1/60. */
	fixedDeltaTime: number;
	/** Maximum accumulated time before dropping frames (prevents spiral of death). Default: 0.25s. */
	maxAccumulator: number;
}

export class GameLoop {
	private accumulator = 0;
	private lastTimestamp = 0;
	private rafId = 0;
	private _running = false;

	/** Total elapsed time in seconds. */
	elapsed = 0;

	/** Total fixed frames processed. */
	fixedFrame = 0;

	constructor(
		private readonly config: GameLoopConfig,
		private readonly callbacks: {
			fixedUpdate: (dt: number) => void;
			update: (dt: number) => void;
			render: () => void;
			cleanup: () => void;
		},
	) {}

	get running(): boolean {
		return this._running;
	}

	start(): void {
		if (this._running) return;
		this._running = true;
		this.lastTimestamp = performance.now();
		this.rafId = requestAnimationFrame((t) => this.tick(t));
	}

	stop(): void {
		this._running = false;
		cancelAnimationFrame(this.rafId);
	}

	/**
	 * Manual step (for headless / testing). Advances exactly one fixed timestep.
	 * @param variableDt - Optional delta time for update(). Defaults to fixedDeltaTime.
	 */
	step(variableDt?: number): void {
		const fixedDt = this.config.fixedDeltaTime;
		this.callbacks.fixedUpdate(fixedDt);
		this.fixedFrame++;
		this.elapsed += fixedDt;
		this.callbacks.update(variableDt ?? fixedDt);
		this.callbacks.render();
		this.callbacks.cleanup();
	}

	private tick(timestamp: number): void {
		if (!this._running) return;

		const rawDt = (timestamp - this.lastTimestamp) / 1000;
		this.lastTimestamp = timestamp;

		const frameDt = Math.min(rawDt, this.config.maxAccumulator);
		this.accumulator += frameDt;
		this.elapsed += frameDt;

		const fixedDt = this.config.fixedDeltaTime;
		while (this.accumulator >= fixedDt) {
			this.callbacks.fixedUpdate(fixedDt);
			this.fixedFrame++;
			this.accumulator -= fixedDt;
		}

		this.callbacks.update(frameDt);
		this.callbacks.render();
		this.callbacks.cleanup();

		this.rafId = requestAnimationFrame((t) => this.tick(t));
	}
}
