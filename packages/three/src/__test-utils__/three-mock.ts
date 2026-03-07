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
}

export class Object3D {
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

	traverse(fn: (o: Object3D) => void) {
		fn(this);
		for (const c of this.children) c.traverse(fn);
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
	dispose() {}
	setAttribute(_name: string, _attr: BufferAttribute) {
		return this;
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

export class PlaneGeometry extends BufferGeometry {}

export class BufferAttribute {
	array: Float32Array;
	itemSize: number;
	constructor(array: Float32Array, itemSize: number) {
		this.array = array;
		this.itemSize = itemSize;
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
	constructor(params?: { color?: number; size?: number }) {
		super();
		this.color = new Color(params?.color ?? 0xffffff);
		this.size = params?.size ?? 1;
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
	clipAction(_clip: AnimationClip): AnimationAction {
		return new AnimationAction();
	}
	update(_dt: number) {}
	stopAllAction() {}
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
	setLoop(_mode: number, _count: number) {
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
export type ColorRepresentation = number | string | Color;
export type ToneMapping = number;
