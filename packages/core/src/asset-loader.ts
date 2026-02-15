import { type Signal, signal } from "./signal.js";

export interface AssetManifest {
	/** Image paths to load. */
	images?: string[];
	/** JSON paths to load. */
	json?: string[];
}

export class AssetLoader {
	private images = new Map<string, ImageBitmap>();
	private jsonData = new Map<string, unknown>();
	private failed = new Set<string>();

	/** Fires during loading with progress info. */
	readonly progress: Signal<{ loaded: number; total: number; asset: string }> = signal();
	/** Fires when all assets are loaded (including any that failed). */
	readonly complete: Signal<void> = signal();
	/** Fires when an individual asset fails to load. */
	readonly error: Signal<{ asset: string; error: Error }> = signal();

	/** Load all assets in a manifest. */
	async load(manifest: AssetManifest): Promise<void> {
		const entries: Array<{ type: "image" | "json"; path: string }> = [];

		for (const path of manifest.images ?? []) {
			entries.push({ type: "image", path });
		}
		for (const path of manifest.json ?? []) {
			entries.push({ type: "json", path });
		}

		const total = entries.length;
		let loaded = 0;

		await Promise.allSettled(
			entries.map(async (entry) => {
				try {
					const response = await fetch(entry.path);
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					if (entry.type === "image") {
						const blob = await response.blob();
						const bitmap = await createImageBitmap(blob);
						this.images.set(this.nameFromPath(entry.path), bitmap);
					} else {
						const data = await response.json();
						this.jsonData.set(this.nameFromPath(entry.path), data);
					}

					loaded++;
					this.progress.emit({ loaded, total, asset: entry.path });
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					this.failed.add(entry.path);
					this.error.emit({ asset: entry.path, error });
				}
			}),
		);

		this.complete.emit();
	}

	/** Retry loading a specific failed asset. */
	async retry(name: string): Promise<void> {
		const path = name;
		this.failed.delete(path);
		// Determine type from the original path
		const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(path);
		const manifest: AssetManifest = isImage ? { images: [path] } : { json: [path] };
		await this.load(manifest);
	}

	/** Get a loaded image by its path/name. */
	getImage(name: string): ImageBitmap | null {
		return this.images.get(name) ?? null;
	}

	/** Get a loaded JSON object by its path/name. */
	getJSON<T = unknown>(name: string): T | null {
		return (this.jsonData.get(name) as T) ?? null;
	}

	/** Check if a specific asset is loaded. */
	isLoaded(name: string): boolean {
		return this.images.has(name) || this.jsonData.has(name);
	}

	/** Check if all assets are loaded. */
	get allLoaded(): boolean {
		return this.failed.size === 0;
	}

	/** Get list of assets that failed to load. */
	get failedAssets(): string[] {
		return [...this.failed];
	}

	/** @internal Store an image directly (for testing). */
	_storeImage(name: string, image: ImageBitmap): void {
		this.images.set(name, image);
	}

	/** @internal Store JSON data directly (for testing). */
	_storeJSON(name: string, data: unknown): void {
		this.jsonData.set(name, data);
	}

	private nameFromPath(path: string): string {
		// Extract filename without extension
		const parts = path.split("/");
		const filename = parts[parts.length - 1] ?? path;
		const dotIdx = filename.lastIndexOf(".");
		return dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
	}
}
