/**
 * Test helpers for DOM/layout-dependent engine code (canvas scaling, element sizing).
 *
 * **jsdom never lays out.** `clientWidth`, `clientHeight` and `getBoundingClientRect()` are
 * permanently `0`, so these helpers stub the very values the code under test is about to read.
 * A passing jsdom test therefore verifies *arithmetic against stubbed inputs* — it is **not**
 * evidence that the layout is correct. Anything whose contract is "the element stays inside its
 * container" must additionally be checked in a real browser.
 */

/** Content-box sizes reported by `MockResizeObserver`, keyed by element. */
const contentBoxes = new WeakMap<Element, { width: number; height: number }>();

/**
 * Stub an element's measured size.
 *
 * `width`/`height` become `clientWidth`/`clientHeight` — the **padding box**. Pass `content` to
 * model a padded container, where the content box the `ResizeObserver` reports is smaller than
 * the padding box. Defaults to the padding box (an unpadded element).
 */
export function setElementSize(
	el: HTMLElement,
	width: number,
	height: number,
	content: { width: number; height: number } = { width, height },
): void {
	Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
	Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
	contentBoxes.set(el, content);
}

/**
 * Minimal `ResizeObserver` stand-in for jsdom.
 *
 * Records every instance so tests can assert the registration/teardown invariant, and delivers
 * `ResizeObserverEntry`-shaped entries carrying the observed element's stubbed **content box**
 * (see {@link setElementSize}) — the real API always passes entries, and code that discards them
 * silently falls back to the padding box.
 *
 * Two deliberate divergences from the real API, neither observable by the code under test:
 *   - delivery here is **synchronous** (`observe()` calls back immediately); real browsers
 *     deliver the initial observation asynchronously, before paint but after the constructor
 *     returns, so a real canvas renders at its intrinsic attribute size for one frame;
 *   - only `contentRect` is populated (`borderBoxSize`/`contentBoxSize` are omitted).
 */
export class MockResizeObserver {
	static instances: MockResizeObserver[] = [];
	readonly observed: Element[] = [];
	disconnected = false;

	constructor(private readonly callback: ResizeObserverCallback) {
		MockResizeObserver.instances.push(this);
	}

	observe(target: Element): void {
		this.observed.push(target);
		// The real ResizeObserver delivers one callback on observe(), with the laid-out size.
		this.fire();
	}

	unobserve(): void {}

	disconnect(): void {
		this.disconnected = true;
	}

	/** Simulate a resize of every observed element. */
	fire(): void {
		const entries = this.observed.map((target) => {
			const box = contentBoxes.get(target) ?? {
				width: target.clientWidth,
				height: target.clientHeight,
			};
			return { target, contentRect: { ...box, x: 0, y: 0, top: 0, left: 0 } };
		}) as unknown as ResizeObserverEntry[];
		this.callback(entries, this as unknown as ResizeObserver);
	}

	/**
	 * Deliver a callback with **no** entries, exercising the manual/`clientWidth` fallback path
	 * that code must keep working when `fit()` is invoked outside an observer callback.
	 */
	fireWithoutEntries(): void {
		this.callback([], this as unknown as ResizeObserver);
	}
}
