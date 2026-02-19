import { Signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { isRef } from "./ref.js";

/** Property names that should coerce string values to Color. */
const COLOR_PROPS = new Set([
	"color",
	"fillColor",
	"backgroundColor",
	"hoverColor",
	"pressedColor",
	"borderColor",
	"textColor",
]);

export function applyProp(node: object, key: string, value: unknown): void {
	// 1. Signal auto-connect: function value + target is a Signal
	const existing = (node as Record<string, unknown>)[key];
	if (typeof value === "function" && existing instanceof Signal) {
		// biome-ignore lint/suspicious/noExplicitAny: runtime signal connect with unknown payload type
		(existing as Signal<any>).connect(value as (payload: unknown) => void);
		return;
	}

	// 2. Ref unwrapping: Ref<T> → ref.current
	if (isRef(value)) {
		(node as Record<string, unknown>)[key] = value.current;
		return;
	}

	// 3. Vec2 coercion: [x, y] tuple → Vec2
	if (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	) {
		(node as Record<string, unknown>)[key] = new Vec2(value[0], value[1]);
		return;
	}

	// 4. Color coercion: "#hex" string on color-named props → Color
	if (typeof value === "string" && COLOR_PROPS.has(key)) {
		(node as Record<string, unknown>)[key] = Color.fromHex(value);
		return;
	}

	// 5. Uniform scale shorthand: scale={2} → Vec2(2, 2)
	if (key === "scale" && typeof value === "number") {
		(node as Record<string, unknown>)[key] = new Vec2(value, value);
		return;
	}

	// 6. Direct assignment (default path)
	(node as Record<string, unknown>)[key] = value;
}
