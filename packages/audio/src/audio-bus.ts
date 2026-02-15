function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(v, max));
}

export class AudioBus {
	private _master: GainNode;
	private _buses: Map<string, GainNode>;

	constructor(context: AudioContext) {
		this._master = context.createGain();
		this._master.connect(context.destination);

		this._buses = new Map();
		for (const name of ["music", "sfx", "ui"]) {
			const gain = context.createGain();
			gain.connect(this._master);
			this._buses.set(name, gain);
		}
	}

	getOutput(bus: string): GainNode {
		return this._buses.get(bus) ?? (this._buses.get("sfx") as GainNode);
	}

	setVolume(bus: string, volume: number): void {
		const node = this._buses.get(bus);
		if (node) node.gain.value = clamp(volume, 0, 1);
	}

	getVolume(bus: string): number {
		const node = this._buses.get(bus);
		return node ? node.gain.value : 1;
	}

	set masterVolume(v: number) {
		this._master.gain.value = clamp(v, 0, 1);
	}

	get masterVolume(): number {
		return this._master.gain.value;
	}
}
