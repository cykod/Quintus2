/** Heuristic: does this device support touch input? */
export function isTouchDevice(): boolean {
	if (typeof navigator === "undefined") return false;
	return navigator.maxTouchPoints > 0;
}

/**
 * Listen for input method changes between touch and mouse.
 * Fires "touch" on first touch event, "mouse" on first mouse move.
 * Used to auto-show/hide virtual controls.
 * @returns A cleanup function that removes listeners.
 */
export function onInputMethodChange(callback: (method: "touch" | "mouse") => void): () => void {
	let current: "touch" | "mouse" | null = null;

	const onPointer = (e: PointerEvent) => {
		const method = e.pointerType === "touch" ? "touch" : "mouse";
		if (method !== current) {
			current = method;
			callback(method);
		}
	};

	document.addEventListener("pointerdown", onPointer, true);
	document.addEventListener("pointermove", onPointer, true);

	return () => {
		document.removeEventListener("pointerdown", onPointer, true);
		document.removeEventListener("pointermove", onPointer, true);
	};
}
