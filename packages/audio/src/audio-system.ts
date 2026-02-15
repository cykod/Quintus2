import type { AssetLoader } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { AudioBus } from "./audio-bus.js";
import type { AutoplayGate } from "./autoplay-gate.js";

export interface PlayOptions {
	volume?: number;
	loop?: boolean;
	bus?: "music" | "sfx" | "ui";
	rate?: number;
}

export interface AudioHandle {
	stop(): void;
	readonly playing: boolean;
}

const noopHandle: AudioHandle = {
	stop() {},
	get playing() {
		return false;
	},
};

export class AudioSystem {
	readonly context: AudioContext | null;
	private _bus: AudioBus | null = null;
	private _gate: AutoplayGate | null = null;
	private _assets: AssetLoader;
	private _activeHandles = new Set<{ source: AudioBufferSourceNode; playing: boolean }>();

	readonly onReady: Signal<void> = signal<void>();

	constructor(context: AudioContext | null, assets: AssetLoader) {
		this.context = context;
		this._assets = assets;

		if (context) {
			this._bus = new AudioBus(context);
		}
	}

	/** @internal Set the autoplay gate after construction. */
	_setGate(gate: AutoplayGate): void {
		this._gate = gate;
		gate.onReady.connect(() => this.onReady.emit());
	}

	get ready(): boolean {
		if (this._gate) return this._gate.ready;
		return this.context?.state === "running" || false;
	}

	play(name: string, options?: PlayOptions): AudioHandle {
		if (!this.context || !this._bus) return noopHandle;

		const buffer = this._assets.get<AudioBuffer>(name);
		if (!buffer) {
			console.warn(
				`Audio asset '${name}' not found. Load it via game.assets.load({ audio: ['${name}.ogg'] }).`,
			);
			return noopHandle;
		}

		const doPlay = (): AudioHandle => {
			const ctx = this.context as AudioContext;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.loop = options?.loop ?? false;
			source.playbackRate.value = options?.rate ?? 1;

			// Volume
			const vol = options?.volume ?? 1;
			const gainNode = ctx.createGain();
			gainNode.gain.value = vol;

			// Route: source → gain → bus
			const busName = options?.bus ?? "sfx";
			source.connect(gainNode);
			gainNode.connect((this._bus as AudioBus).getOutput(busName));

			const entry = { source, playing: true };
			this._activeHandles.add(entry);

			source.onended = () => {
				entry.playing = false;
				this._activeHandles.delete(entry);
			};

			source.start(0);

			return {
				stop() {
					if (entry.playing) {
						entry.playing = false;
						try {
							source.stop();
						} catch {
							// Already stopped
						}
					}
				},
				get playing() {
					return entry.playing;
				},
			};
		};

		if (this._gate && !this._gate.ready) {
			let handle: AudioHandle = noopHandle;
			this._gate.whenReady(() => {
				handle = doPlay();
			});
			return {
				stop() {
					handle.stop();
				},
				get playing() {
					return handle.playing;
				},
			};
		}

		return doPlay();
	}

	stopAll(): void {
		for (const entry of this._activeHandles) {
			if (entry.playing) {
				entry.playing = false;
				try {
					entry.source.stop();
				} catch {
					// Already stopped
				}
			}
		}
		this._activeHandles.clear();
	}

	get masterVolume(): number {
		return this._bus?.masterVolume ?? 1;
	}

	set masterVolume(v: number) {
		if (this._bus) this._bus.masterVolume = v;
	}

	setBusVolume(bus: string, volume: number): void {
		this._bus?.setVolume(bus, volume);
	}

	getBusVolume(bus: string): number {
		return this._bus?.getVolume(bus) ?? 1;
	}
}
