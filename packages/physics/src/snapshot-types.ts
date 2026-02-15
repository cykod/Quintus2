import type { Node2DSnapshot } from "@quintus/core";

export interface CollisionShapeSnapshot extends Node2DSnapshot {
	shapeType: "rect" | "circle" | "capsule" | "polygon" | null;
	shapeDesc: string;
	disabled: boolean;
}

export interface ActorSnapshot extends Node2DSnapshot {
	velocity: { x: number; y: number };
	gravity: number;
	isOnFloor: boolean;
	isOnWall: boolean;
	isOnCeiling: boolean;
	collisionGroup: string;
	bodyType: "actor";
}

export interface StaticColliderSnapshot extends Node2DSnapshot {
	oneWay: boolean;
	constantVelocity: { x: number; y: number };
	collisionGroup: string;
	bodyType: "static";
}

export interface SensorSnapshot extends Node2DSnapshot {
	monitoring: boolean;
	overlappingBodyCount: number;
	overlappingSensorCount: number;
	collisionGroup: string;
	bodyType: "sensor";
}
