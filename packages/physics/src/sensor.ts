import { type Signal, signal } from "@quintus/core";
import { type BodyType, CollisionObject } from "./collision-object.js";

export class Sensor extends CollisionObject {
	readonly bodyType: BodyType = "sensor";

	/**
	 * Whether this sensor detects other bodies overlapping it.
	 * When false, entered/exited signals don't fire.
	 */
	monitoring = true;

	/** Emitted when an Actor or StaticCollider enters this sensor's area. */
	readonly bodyEntered: Signal<CollisionObject> = signal<CollisionObject>();

	/** Emitted when an Actor or StaticCollider exits this sensor's area. */
	readonly bodyExited: Signal<CollisionObject> = signal<CollisionObject>();

	/** Emitted when another Sensor enters this sensor's area. */
	readonly sensorEntered: Signal<Sensor> = signal<Sensor>();

	/** Emitted when another Sensor exits this sensor's area. */
	readonly sensorExited: Signal<Sensor> = signal<Sensor>();

	override get _monitoring(): boolean {
		return this.monitoring;
	}

	override _onBodyEntered(body: CollisionObject): void {
		if (body.bodyType === "sensor") {
			this.sensorEntered.emit(body as Sensor);
		} else {
			this.bodyEntered.emit(body);
		}
	}

	override _onBodyExited(body: CollisionObject): void {
		if (body.bodyType === "sensor") {
			this.sensorExited.emit(body as Sensor);
		} else {
			this.bodyExited.emit(body);
		}
	}

	/** Get all Actors and StaticColliders currently overlapping this sensor. */
	getOverlappingBodies(): CollisionObject[] {
		const world = this._getWorld();
		return world ? world.getOverlappingBodies(this) : [];
	}

	/** Get all other Sensors currently overlapping this sensor. */
	getOverlappingSensors(): Sensor[] {
		const world = this._getWorld();
		return world ? (world.getOverlappingSensors(this) as Sensor[]) : [];
	}

	override onDestroy(): void {
		this.bodyEntered.disconnectAll();
		this.bodyExited.disconnectAll();
		this.sensorEntered.disconnectAll();
		this.sensorExited.disconnectAll();
		super.onDestroy();
	}
}
