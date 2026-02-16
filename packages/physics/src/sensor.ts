import { type Signal, signal } from "@quintus/core";
import { type BodyType, CollisionObject } from "./collision-object.js";
import type { SensorSnapshot } from "./snapshot-types.js";

export class Sensor extends CollisionObject {
	readonly bodyType: BodyType = "sensor";

	/**
	 * Sensors default to monitoring = true (override base class default of false).
	 * When false, entered/exited signals don't fire.
	 */
	override monitoring = true;

	/** Emitted when another Sensor enters this sensor's area. */
	readonly sensorEntered: Signal<Sensor> = signal<Sensor>();

	/** Emitted when another Sensor exits this sensor's area. */
	readonly sensorExited: Signal<Sensor> = signal<Sensor>();

	// === Serialization ===

	override serialize(): SensorSnapshot {
		return {
			...super.serialize(),
			monitoring: this.monitoring,
			overlappingBodyCount: this.getOverlappingBodies().length,
			overlappingSensorCount: this.getOverlappingSensors().length,
			collisionGroup: this.collisionGroup,
			bodyType: "sensor" as const,
		};
	}

	override onBodyEntered(body: CollisionObject): void {
		super.onBodyEntered(body); // always emit bodyEntered
		if (body.bodyType === "sensor") {
			this.onSensorEntered(body as Sensor);
		}
	}

	override onBodyExited(body: CollisionObject): void {
		super.onBodyExited(body); // always emit bodyExited
		if (body.bodyType === "sensor") {
			this.onSensorExited(body as Sensor);
		}
	}

	/** Override for sensor-specific self-handling. Default emits sensorEntered signal. */
	onSensorEntered(sensor: Sensor): void {
		this.sensorEntered.emit(sensor);
	}

	/** Override for sensor-specific self-handling. Default emits sensorExited signal. */
	onSensorExited(sensor: Sensor): void {
		this.sensorExited.emit(sensor);
	}

	/** Get all other Sensors currently overlapping this sensor. */
	getOverlappingSensors(): Sensor[] {
		const world = this._getWorld();
		return world ? (world.getOverlappingSensors(this) as Sensor[]) : [];
	}

	override onDestroy(): void {
		this.sensorEntered.disconnectAll();
		this.sensorExited.disconnectAll();
		super.onDestroy();
	}
}
