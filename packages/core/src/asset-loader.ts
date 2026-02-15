import { type Signal, signal } from "./signal.js";

export type LoaderFn = (name: string, path: string) => Promise<unknown>;

export interface AssetManifest {
	/** Image paths to load. */
	images?: string[];
	/** JSON paths to load. */
	json?: string[];
	/** Custom asset types registered via registerLoader(). */
	[key: string]: string[] | undefined;
}

export class AssetLoader {
	private images = new Map<string, ImageBitmap>();
	private jsonData = new Map<string, unknown>();
	private _customAssets = new Map<string, unknown>();
	private _customLoaders = new Map<string, LoaderFn>();
	private failed = new Set<string>();

	/** Fires during loading with progress info. */
	readonly progress: Signal<{ loaded: number; total: number; asset: string }> = signal();
	/** Fires when all assets are loaded (including any that failed). */
	readonly complete: Signal<void> = signal();
	/** Fires when an individual asset fails to load. */
	readonly error: Signal<{ asset: string; error: Error }> = signal();

	/** Register a custom loader for a new asset type (e.g. "audio"). */
	registerLoader(type: string, loader: LoaderFn): void {
		this._customLoaders.set(type, loader);
	}

	/** Load all assets in a manifest. */
	async load(manifest: AssetManifest): Promise<void> {
		const entries: Array<{ type: string; path: string }> = [];

		for (const path of manifest.images ?? []) {
			entries.push({ type: "image", path });
		}
		for (const path of manifest.json ?? []) {
			entries.push({ type: "json", path });
		}

		// Custom types
		for (const [key, paths] of Object.entries(manifest)) {
			if (key === "images" || key === "json") continue;
			if (!Array.isArray(paths)) continue;
			if (!this._customLoaders.has(key)) {
				console.warn(`No loader registered for asset type "${key}". Skipping.`);
				continue;
			}
			for (const path of paths) {
				entries.push({ type: key, path });
			}
		}

		const total = entries.length;
		let loaded = 0;

		await Promise.allSettled(
			entries.map(async (entry) => {
				try {
					if (entry.type === "image") {
						const response = await fetch(entry.path);
						if (!response.ok) {
							throw new Error(`HTTP ${response.status}: ${response.statusText}`);
						}
						const blob = await response.blob();
						const bitmap = await createImageBitmap(blob);
						this.images.set(this.nameFromPath(entry.path), bitmap);
					} else if (entry.type === "json") {
						const response = await fetch(entry.path);
						if (!response.ok) {
							throw new Error(`HTTP ${response.status}: ${response.statusText}`);
						}
						const data = await response.json();
						this.jsonData.set(this.nameFromPath(entry.path), data);
					} else {
						const loader = this._customLoaders.get(entry.type);
						if (loader) {
							const name = this.nameFromPath(entry.path);
							const result = await loader(name, entry.path);
							this._customAssets.set(name, result);
						}
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

	/** Get a custom-loaded asset by name. */
	get<T = unknown>(name: string): T | null {
		return (this._customAssets.get(name) as T) ?? null;
	}

	/** Check if a specific asset is loaded. */
	isLoaded(name: string): boolean {
		return this.images.has(name) || this.jsonData.has(name) || this._customAssets.has(name);
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

	/** @internal Store a custom asset directly (for testing). */
	_storeCustom(name: string, data: unknown): void {
		this._customAssets.set(name, data);
	}

	private nameFromPath(path: string): string {
		// Extract filename without extension
		const parts = path.split("/");
		const filename = parts[parts.length - 1] ?? path;
		const dotIdx = filename.lastIndexOf(".");
		return dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
	}
}
