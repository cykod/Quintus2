/**
 * Lock page scrolling to prevent pull-to-refresh, rubber-banding, and zoom gestures.
 * Sets CSS properties on the body and adds a touchmove preventDefault listener.
 * @returns A cleanup function that restores original state.
 */
export function lockScroll(canvas: HTMLCanvasElement): () => void {
	// Prevent canvas touch from scrolling
	canvas.style.touchAction = "none";

	// Prevent iOS text selection and callout on canvas
	canvas.style.userSelect = "none";
	(canvas.style as unknown as Record<string, string>).webkitUserSelect = "none";
	(canvas.style as unknown as Record<string, string>).webkitTouchCallout = "none";

	// Preserve originals for cleanup
	const origOverflow = document.body.style.overflow;
	const origPosition = document.body.style.position;
	const origWidth = document.body.style.width;
	const origHeight = document.body.style.height;

	// Prevent body scroll
	document.body.style.overflow = "hidden";
	document.body.style.position = "fixed";
	document.body.style.width = "100%";
	document.body.style.height = "100%";

	// Block touchmove on document (prevents pull-to-refresh, rubber-banding)
	const preventTouchMove = (e: TouchEvent) => {
		if (e.target === canvas || canvas.contains(e.target as Node)) {
			e.preventDefault();
		}
	};
	document.addEventListener("touchmove", preventTouchMove, { passive: false });

	// Block contextmenu on canvas (prevents iOS long-press menu)
	const preventContext = (e: Event) => {
		e.preventDefault();
	};
	canvas.addEventListener("contextmenu", preventContext);

	// Block touchstart default on canvas (prevents iOS selection gesture)
	const preventTouchStart = (e: TouchEvent) => {
		if (e.target === canvas || canvas.contains(e.target as Node)) {
			e.preventDefault();
		}
	};
	document.addEventListener("touchstart", preventTouchStart, { passive: false });

	return () => {
		canvas.style.touchAction = "";
		canvas.style.userSelect = "";
		(canvas.style as unknown as Record<string, string>).webkitUserSelect = "";
		(canvas.style as unknown as Record<string, string>).webkitTouchCallout = "";
		document.body.style.overflow = origOverflow;
		document.body.style.position = origPosition;
		document.body.style.width = origWidth;
		document.body.style.height = origHeight;
		document.removeEventListener("touchmove", preventTouchMove);
		canvas.removeEventListener("contextmenu", preventContext);
		document.removeEventListener("touchstart", preventTouchStart);
	};
}
