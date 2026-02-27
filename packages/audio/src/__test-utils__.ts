import { vi } from "vitest";

interface MockGainNode {
	gain: { value: number };
	connect: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
}

interface MockSourceNode {
	buffer: unknown;
	loop: boolean;
	playbackRate: { value: number };
	onended: (() => void) | null;
	connect: ReturnType<typeof vi.fn>;
	start: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
}

export interface MockAudioContext {
	state: string;
	destination: object;
	createGain: ReturnType<typeof vi.fn>;
	createBufferSource: ReturnType<typeof vi.fn>;
	resume: ReturnType<typeof vi.fn>;
	suspend: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	decodeAudioData: ReturnType<typeof vi.fn>;
	_gains: MockGainNode[];
	_sources: MockSourceNode[];
}

export function createMockGainNode(): MockGainNode {
	return {
		gain: { value: 1 },
		connect: vi.fn(),
		disconnect: vi.fn(),
	};
}

export function createMockSourceNode(): MockSourceNode {
	return {
		buffer: null,
		loop: false,
		playbackRate: { value: 1 },
		onended: null,
		connect: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};
}

export function createMockAudioContext(state = "running"): MockAudioContext {
	const gains: MockGainNode[] = [];
	const sources: MockSourceNode[] = [];

	const ctx: MockAudioContext = {
		state,
		destination: {},
		createGain: vi.fn(() => {
			const g = createMockGainNode();
			gains.push(g);
			return g;
		}),
		createBufferSource: vi.fn(() => {
			const s = createMockSourceNode();
			sources.push(s);
			return s;
		}),
		resume: vi.fn(() => {
			ctx.state = "running";
			return Promise.resolve();
		}),
		suspend: vi.fn(() => Promise.resolve()),
		close: vi.fn(() => Promise.resolve()),
		decodeAudioData: vi.fn((buf: ArrayBuffer) => Promise.resolve(buf)),
		_gains: gains,
		_sources: sources,
	};
	return ctx;
}
