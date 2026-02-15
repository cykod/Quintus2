import { Node, type Signal, signal } from "@quintus/core";
import { getAudio } from "./audio-plugin.js";
import type { AudioHandle } from "./audio-system.js";

export class AudioPlayer extends Node {
	stream = "";
	volume = 1;
	loop = false;
	autoplay = false;
	bus: "music" | "sfx" | "ui" = "music";
	rate = 1;

	private _handle: AudioHandle | null = null;
	private _paused = false;

	readonly finished: Signal<void> = signal<void>();

	get playing(): boolean {
		return this._handle?.playing ?? false;
	}

	get audioPaused(): boolean {
		return this._paused;
	}

	play(): void {
		this.stop();
		if (!this.stream) return;

		const game = this.game;
		if (!game) return;

		const audio = getAudio(game);
		if (!audio) return;

		this._paused = false;
		this._handle = audio.play(this.stream, {
			volume: this.volume,
			loop: this.loop,
			bus: this.bus,
			rate: this.rate,
		});
	}

	stop(): void {
		if (this._handle) {
			this._handle.stop();
			this._handle = null;
			this._paused = false;
			this.finished.emit();
		}
	}

	pause(): void {
		if (this._handle?.playing) {
			const game = this.game;
			const audio = game ? getAudio(game) : null;
			if (audio?.context) {
				audio.context.suspend();
				this._paused = true;
			}
		}
	}

	resume(): void {
		if (this._paused) {
			const game = this.game;
			const audio = game ? getAudio(game) : null;
			if (audio?.context) {
				audio.context.resume();
				this._paused = false;
			}
		}
	}

	override onReady(): void {
		if (this.autoplay) this.play();
	}

	override onDestroy(): void {
		this.stop();
	}
}
