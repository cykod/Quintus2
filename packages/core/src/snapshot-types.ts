export interface NodeSnapshot {
	id: number;
	type: string;
	name: string;
	tags: string[];
	children: NodeSnapshot[];
}

export interface Node2DSnapshot extends NodeSnapshot {
	position: { x: number; y: number };
	rotation: number;
	scale: { x: number; y: number };
	globalPosition: { x: number; y: number };
	visible: boolean;
	zIndex: number;
}

export interface CameraSnapshot extends NodeSnapshot {
	position: { x: number; y: number };
	zoom: number;
	smoothing: number;
	followTarget: string | null;
	bounds: { x: number; y: number; width: number; height: number } | null;
	isShaking: boolean;
	deadZone: { x: number; y: number; width: number; height: number } | null;
	pixelPerfectZoom: boolean;
}
