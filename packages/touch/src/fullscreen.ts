/** Request fullscreen on an element. Cross-browser with Safari fallback. */
export function requestFullscreen(el: HTMLElement = document.documentElement): Promise<void> {
	if (el.requestFullscreen) return el.requestFullscreen();
	// Safari fallback
	const webkit = el as HTMLElement & {
		webkitRequestFullscreen?: () => Promise<void>;
	};
	if (webkit.webkitRequestFullscreen) return webkit.webkitRequestFullscreen();
	return Promise.resolve();
}

/** Exit fullscreen mode. Cross-browser with Safari fallback. */
export function exitFullscreen(): Promise<void> {
	if (document.exitFullscreen) return document.exitFullscreen();
	const webkit = document as Document & {
		webkitExitFullscreen?: () => Promise<void>;
	};
	if (webkit.webkitExitFullscreen) return webkit.webkitExitFullscreen();
	return Promise.resolve();
}

/** Check if the document is currently in fullscreen mode. */
export function isFullscreen(): boolean {
	return !!document.fullscreenElement;
}

/** Listen for fullscreen state changes. Returns a cleanup function. */
export function onFullscreenChange(callback: (active: boolean) => void): () => void {
	const handler = () => callback(isFullscreen());
	document.addEventListener("fullscreenchange", handler);
	document.addEventListener("webkitfullscreenchange", handler);
	return () => {
		document.removeEventListener("fullscreenchange", handler);
		document.removeEventListener("webkitfullscreenchange", handler);
	};
}
