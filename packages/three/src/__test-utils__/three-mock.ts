/**
 * Minimal Three.js mocks for testing without WebGL.
 * Provides enough structure for tree operations, lazy creation, and property access.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export class Vector3 {
	x: number;
	y: number;
	z: number;
	constructor(x = 0, y = 0, z = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
	set(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}
	setScalar(s: number) {
		this.x = s;
		this.y = s;
		this.z = s;
		return this;
	}
	clone() {
		return new Vector3(this.x, this.y, this.z);
	}
	add(v: Vector3) {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
		return this;
	}
	lerp(target: Vector3, alpha: number) {
		this.x += (target.x - this.x) * alpha;
		this.y += (target.y - this.y) * alpha;
		this.z += (target.z - this.z) * alpha;
		return this;
	}
	copy(v: Vector3) {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		return this;
	}
	lerpVectors(v1: Vector3, v2: Vector3, alpha: number) {
		this.x = v1.x + (v2.x - v1.x) * alpha;
		this.y = v1.y + (v2.y - v1.y) * alpha;
		this.z = v1.z + (v2.z - v1.z) * alpha;
		return this;
	}
}

export class Euler {
	x: number;
	y: number;
	z: number;
	order: string;
	constructor(x = 0, y = 0, z = 0, order = "XYZ") {
		this.x = x;
		this.y = y;
		this.z = z;
		this.order = order;
	}
	set(x: number, y: number, z: number, order?: string) {
		this.x = x;
		this.y = y;
		this.z = z;
		if (order) this.order = order;
		return this;
	}
}

export class Quaternion {
	x: number;
	y: number;
	z: number;
	w: number;
	constructor(x = 0, y = 0, z = 0, w = 1) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}
	set(x: number, y: number, z: number, w: number): this {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
		return this;
	}
	copy(q: Quaternion): this {
		this.x = q.x;
		this.y = q.y;
		this.z = q.z;
		this.w = q.w;
		return this;
	}
}

export class Object3D {
	name = "";
	position = new Vector3();
	rotation = new Euler();
	quaternion = new Quaternion();
	scale = new Vector3(1, 1, 1);
	visible = true;
	parent: Object3D | null = null;
	children: Object3D[] = [];
	userData: Record<string, unknown> = {};
	matrixAutoUpdate = true;

	add(child: Object3D) {
		if (child.parent) {
			child.parent.remove(child);
		}
		this.children.push(child);
		child.parent = this;
		return this;
	}

	remove(child: Object3D) {
		const i = this.children.indexOf(child);
		if (i >= 0) {
			this.children.splice(i, 1);
			child.parent = null;
		}
		return this;
	}

	clear() {
		for (const child of [...this.children]) {
			this.remove(child);
		}
		return this;
	}

	lookAt(_x: number | Vector3, _y?: number, _z?: number) {}

	updateWorldMatrix(_updateParents?: boolean, _updateChildren?: boolean) {}

	getWorldPosition(target: Vector3): Vector3 {
		target.set(this.position.x, this.position.y, this.position.z);
		let p: Object3D | null = this.parent;
		while (p) {
			target.x += p.position.x;
			target.y += p.position.y;
			target.z += p.position.z;
			p = p.parent;
		}
		return target;
	}

	getWorldQuaternion(target: Quaternion): Quaternion {
		target.set(this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w);
		return target;
	}

	traverse(fn: (o: Object3D) => void) {
		fn(this);
		for (const c of this.children) c.traverse(fn);
	}

	getObjectByName(name: string): Object3D | undefined {
		if (this.name === name) return this;
		for (const c of this.children) {
			const found = c.getObjectByName(name);
			if (found) return found;
		}
		return undefined;
	}
}

export class Scene extends Object3D {
	background: Color | null = null;
}

export class Color {
	r: number;
	g: number;
	b: number;
	constructor(color?: number | string) {
		if (typeof color === "number") {
			this.r = ((color >> 16) & 255) / 255;
			this.g = ((color >> 8) & 255) / 255;
			this.b = (color & 255) / 255;
		} else {
			this.r = 0;
			this.g = 0;
			this.b = 0;
		}
	}
}

class MockShadow {
	mapSize = new Vector3(512, 512, 0);
	map: { dispose: () => void } | null = null;
	camera = new OrthographicCamera(-5, 5, 5, -5, 0.5, 500);
}

export class Camera extends Object3D {
	aspect = 1;
	updateProjectionMatrix() {}
}

export class PerspectiveCamera extends Camera {
	fov: number;
	near: number;
	far: number;
	constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
		super();
		this.fov = fov;
		this.aspect = aspect;
		this.near = near;
		this.far = far;
	}
}

export class OrthographicCamera extends Camera {
	left: number;
	right: number;
	top: number;
	bottom: number;
	near: number;
	far: number;
	constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
		super();
		this.left = left;
		this.right = right;
		this.top = top;
		this.bottom = bottom;
		this.near = near;
		this.far = far;
	}
}

export class BufferGeometry {
	private _attributes: Record<string, BufferAttribute> = {};

	dispose() {}

	setAttribute(name: string, attr: BufferAttribute) {
		this._attributes[name] = attr;
		return this;
	}

	getAttribute(name: string): BufferAttribute | undefined {
		return this._attributes[name];
	}

	setDrawRange(start: number, count: number) {
		(this as Record<string, unknown>).drawRangeStart = start;
		(this as Record<string, unknown>).drawRangeCount = count;
	}
}

export class BoxGeometry extends BufferGeometry {
	constructor(
		public width = 1,
		public height = 1,
		public depth = 1,
	) {
		super();
	}
}

export class PlaneGeometry extends BufferGeometry {
	constructor(
		public width = 1,
		public height = 1,
	) {
		super();
	}
	rotateX(_angle: number) {
		return this;
	}
}

export class BufferAttribute {
	array: Float32Array;
	itemSize: number;
	needsUpdate = false;
	constructor(array: Float32Array, itemSize: number) {
		this.array = array;
		this.itemSize = itemSize;
	}
}

export class Float32BufferAttribute extends BufferAttribute {
	constructor(array: Float32Array | number[], itemSize: number) {
		super(array instanceof Float32Array ? array : new Float32Array(array), itemSize);
	}
}

export class Material {
	needsUpdate = false;
	dispose() {}
}

export class MeshStandardMaterial extends Material {
	color: Color;
	constructor(params?: { color?: number }) {
		super();
		this.color = new Color(params?.color ?? 0xffffff);
	}
}

export class PointsMaterial extends Material {
	color: Color;
	size: number;
	vertexColors: boolean;
	transparent: boolean;
	depthWrite: boolean;
	blending: number;
	sizeAttenuation: boolean;
	alphaTest: number;
	constructor(params?: Record<string, unknown>) {
		super();
		this.color = new Color((params?.color as number) ?? 0xffffff);
		this.size = (params?.size as number) ?? 1;
		this.vertexColors = (params?.vertexColors as boolean) ?? false;
		this.transparent = (params?.transparent as boolean) ?? false;
		this.depthWrite = (params?.depthWrite as boolean) ?? true;
		this.blending = (params?.blending as number) ?? NormalBlending;
		this.sizeAttenuation = (params?.sizeAttenuation as boolean) ?? true;
		this.alphaTest = (params?.alphaTest as number) ?? 0;
	}
}

export class ShaderMaterial extends Material {
	uniforms: Record<string, { value: unknown }>;
	vertexShader: string;
	fragmentShader: string;
	transparent: boolean;
	depthWrite: boolean;
	blending: number;
	constructor(params?: Record<string, unknown>) {
		super();
		this.uniforms = (params?.uniforms as Record<string, { value: unknown }>) ?? {};
		this.vertexShader = (params?.vertexShader as string) ?? "";
		this.fragmentShader = (params?.fragmentShader as string) ?? "";
		this.transparent = (params?.transparent as boolean) ?? false;
		this.depthWrite = (params?.depthWrite as boolean) ?? true;
		this.blending = (params?.blending as number) ?? NormalBlending;
	}
}

export class SpriteMaterial extends Material {
	map: Texture | null = null;
	transparent: boolean;
	opacity: number;
	constructor(params?: { transparent?: boolean; opacity?: number }) {
		super();
		this.transparent = params?.transparent ?? false;
		this.opacity = params?.opacity ?? 1;
	}
}

export class MeshBasicMaterial extends Material {
	color: Color;
	transparent: boolean;
	opacity: number;
	depthWrite: boolean;
	constructor(params?: {
		color?: number;
		transparent?: boolean;
		opacity?: number;
		depthWrite?: boolean;
	}) {
		super();
		this.color = new Color(params?.color ?? 0xffffff);
		this.transparent = params?.transparent ?? false;
		this.opacity = params?.opacity ?? 1;
		this.depthWrite = params?.depthWrite ?? true;
	}
}

export class Mesh extends Object3D {
	geometry: BufferGeometry;
	material: Material | Material[];
	castShadow = false;
	receiveShadow = false;
	constructor(geometry?: BufferGeometry, material?: Material) {
		super();
		this.geometry = geometry ?? new BufferGeometry();
		this.material = material ?? new Material();
	}
}

export class Points extends Object3D {
	geometry: BufferGeometry;
	material: Material | Material[];
	constructor(geometry?: BufferGeometry, material?: Material) {
		super();
		this.geometry = geometry ?? new BufferGeometry();
		this.material = material ?? new Material();
	}
}

export class Sprite extends Object3D {
	material: Material;
	constructor(material?: Material) {
		super();
		this.material = material ?? new SpriteMaterial();
	}
}

export class AmbientLight extends Object3D {
	color: Color;
	intensity: number;
	constructor(color?: number | Color, intensity = 1) {
		super();
		this.color = color instanceof Color ? color : new Color(color ?? 0xffffff);
		this.intensity = intensity;
	}
}

export class DirectionalLight extends Object3D {
	color: Color;
	intensity: number;
	castShadow = false;
	shadow = new MockShadow();
	constructor(color?: number | Color, intensity = 1) {
		super();
		this.color = color instanceof Color ? color : new Color(color ?? 0xffffff);
		this.intensity = intensity;
	}
}

export class PointLight extends Object3D {
	color: Color;
	intensity: number;
	distance: number;
	decay: number;
	castShadow = false;
	shadow = new MockShadow();
	constructor(color?: number | Color, intensity = 1, distance = 0, decay = 2) {
		super();
		this.color = color instanceof Color ? color : new Color(color ?? 0xffffff);
		this.intensity = intensity;
		this.distance = distance;
		this.decay = decay;
	}
}

export class Texture {
	dispose() {}
}

export class WebGLRenderer {
	domElement: HTMLCanvasElement;
	shadowMap = { enabled: false, type: 0 };
	toneMapping = 0;

	constructor(params?: {
		canvas?: HTMLCanvasElement;
		antialias?: boolean;
		alpha?: boolean;
		preserveDrawingBuffer?: boolean;
	}) {
		this.domElement = params?.canvas ?? document.createElement("canvas");
	}
	setSize(w: number, h: number, _updateStyle?: boolean) {
		this.domElement.width = w;
		this.domElement.height = h;
	}
	setPixelRatio(_ratio: number) {}
	setClearColor(_color: Color, _alpha?: number) {}
	clear() {}
	render(_scene: Scene, _camera: Camera) {}
	dispose() {}
}

export class AnimationMixer {
	private _listeners: Map<string, Array<(e: unknown) => void>> = new Map();
	private _activeActions: Array<{ action: AnimationAction; elapsed: number; clip: AnimationClip }> =
		[];

	clipAction(clip: AnimationClip): AnimationAction {
		const action = new AnimationAction();
		(action as unknown as { _clip: AnimationClip })._clip = clip;
		(action as unknown as { _mixer: AnimationMixer })._mixer = this;
		return action;
	}
	update(dt: number) {
		for (let i = this._activeActions.length - 1; i >= 0; i--) {
			const entry = this._activeActions[i];
			entry.elapsed += dt;
			if (entry.elapsed >= entry.clip.duration) {
				this._activeActions.splice(i, 1);
				this._dispatch("finished", { action: entry.action });
			}
		}
	}
	stopAllAction() {
		this._activeActions.length = 0;
	}
	addEventListener(type: string, listener: (e: unknown) => void) {
		if (!this._listeners.has(type)) this._listeners.set(type, []);
		const arr = this._listeners.get(type);
		if (arr) arr.push(listener);
	}
	removeEventListener(type: string, listener: (e: unknown) => void) {
		const arr = this._listeners.get(type);
		if (arr) {
			const i = arr.indexOf(listener);
			if (i >= 0) arr.splice(i, 1);
		}
	}
	_trackAction(action: AnimationAction, clip: AnimationClip) {
		this._activeActions.push({ action, elapsed: 0, clip });
	}
	private _dispatch(type: string, event: unknown) {
		const arr = this._listeners.get(type);
		if (arr) {
			for (const fn of [...arr]) fn(event);
		}
	}
}

export class AnimationClip {
	name: string;
	duration: number;
	constructor(name = "", duration = 1) {
		this.name = name;
		this.duration = duration;
	}
}

export class AnimationAction {
	clampWhenFinished = false;
	private _loopMode: number = LoopRepeat;
	private _clip?: AnimationClip;
	private _mixer?: AnimationMixer;
	setLoop(mode: number, _count: number) {
		this._loopMode = mode;
		return this;
	}
	reset() {
		return this;
	}
	fadeIn(_duration: number) {
		return this;
	}
	fadeOut(_duration: number) {
		return this;
	}
	play() {
		// Track one-shot actions so the mixer can fire 'finished'
		if (this._loopMode === LoopOnce && this._mixer && this._clip) {
			this._mixer._trackAction(this, this._clip);
		}
		return this;
	}
	stop() {
		return this;
	}
}

export class Matrix4 {
	elements: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

	identity(): Matrix4 {
		this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
		return this;
	}

	makeTranslation(x: number, y: number, z: number): Matrix4 {
		this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
		return this;
	}

	makeRotationY(theta: number): Matrix4 {
		const c = Math.cos(theta);
		const s = Math.sin(theta);
		this.elements = [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
		return this;
	}

	multiply(m: Matrix4): Matrix4 {
		const a = this.elements;
		const b = m.elements;
		const r = new Array(16);
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				r[i * 4 + j] =
					a[i * 4] * b[j] +
					a[i * 4 + 1] * b[4 + j] +
					a[i * 4 + 2] * b[8 + j] +
					a[i * 4 + 3] * b[12 + j];
			}
		}
		this.elements = r;
		return this;
	}

	clone(): Matrix4 {
		const m = new Matrix4();
		m.elements = [...this.elements];
		return m;
	}
}

export class InstancedMesh extends Mesh {
	count: number;
	instanceMatrix: { needsUpdate: boolean; array: Float32Array };
	private _matrices: Matrix4[] = [];

	constructor(geometry?: BufferGeometry, material?: Material, count = 0) {
		super(geometry, material);
		this.count = count;
		this.instanceMatrix = {
			needsUpdate: false,
			array: new Float32Array(count * 16),
		};
		this._matrices = Array.from({ length: count }, () => new Matrix4());
	}

	setMatrixAt(index: number, matrix: Matrix4): void {
		this._matrices[index] = matrix;
		this.instanceMatrix.array.set(matrix.elements, index * 16);
	}

	getMatrixAt(index: number, matrix: Matrix4): void {
		const offset = index * 16;
		for (let i = 0; i < 16; i++) {
			matrix.elements[i] = this.instanceMatrix.array[offset + i];
		}
	}
}

// Enum-like constants
export const LoopRepeat = 2201;
export const LoopOnce = 2200;
export const PCFSoftShadowMap = 2;
export const NoToneMapping = 0;
export const AdditiveBlending = 2;
export const NormalBlending = 1;
export type ColorRepresentation = number | string | Color;
export type ToneMapping = number;
