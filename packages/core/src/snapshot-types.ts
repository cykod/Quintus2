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
