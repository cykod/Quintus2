import { Node, Node2D, type NodeConstructor, type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { assertType, describe, expectTypeOf, test } from "vitest";
import type { Ref } from "./ref.js";
import type { NodeJSXProps } from "./types.js";

// ---- Test Node Subclasses ----

class TestLabel extends Node2D {
	text = "";
	font = "sans-serif";
	fontSize = 16;
	color: Color = Color.WHITE;
	align: "left" | "center" | "right" = "left";
	readonly interactive = false;
}

class TestButton extends Node2D {
	text = "";
	fontSize = 16;
	textColor: Color = Color.WHITE;
	backgroundColor: Color = Color.fromHex("#333333");
	borderWidth = 0;

	private _hovered = false;
	get hovered(): boolean {
		return this._hovered;
	}

	readonly onPressed: Signal<void> = signal<void>();
	readonly onHoverChanged: Signal<boolean> = signal<boolean>();
}

class TestActor extends Node2D {
	velocity: Vec2 = new Vec2(0, 0);
	solid = false;
	gravity = 0;
	applyGravity = true;
	readonly collided: Signal<{ normal: Vec2 }> = signal<{ normal: Vec2 }>();
}

class TestCamera extends Node {
	follow: Node | null = null;
	smoothing = 0.1;
}

// ---- WritableKeys Tests ----

describe("NodeJSXProps — writable properties", () => {
	test("accepts writable string properties", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("text");
		expectTypeOf<NodeJSXProps<TestLabel>["text"]>().toEqualTypeOf<string | undefined>();
	});

	test("accepts writable number properties", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("fontSize");
		expectTypeOf<NodeJSXProps<TestLabel>["fontSize"]>().toEqualTypeOf<number | undefined>();
	});

	test("accepts writable union properties", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("align");
		expectTypeOf<NodeJSXProps<TestLabel>["align"]>().toEqualTypeOf<
			"left" | "center" | "right" | undefined
		>();
	});

	test("accepts writable boolean properties", () => {
		expectTypeOf<NodeJSXProps<TestActor>>().toHaveProperty("solid");
		expectTypeOf<NodeJSXProps<TestActor>["solid"]>().toEqualTypeOf<boolean | undefined>();
	});

	test("inherits writable properties from parent classes", () => {
		// Node properties
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("name");
		expectTypeOf<NodeJSXProps<TestLabel>["name"]>().toEqualTypeOf<string | undefined>();

		// Node2D properties
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("visible");
		expectTypeOf<NodeJSXProps<TestLabel>["visible"]>().toEqualTypeOf<boolean | undefined>();

		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("alpha");
		expectTypeOf<NodeJSXProps<TestLabel>["alpha"]>().toEqualTypeOf<number | undefined>();

		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("zIndex");
		expectTypeOf<NodeJSXProps<TestLabel>["zIndex"]>().toEqualTypeOf<number | undefined>();
	});
});

describe("NodeJSXProps — readonly exclusion", () => {
	test("excludes readonly id", () => {
		// @ts-expect-error — id is readonly, should not be in props
		// biome-ignore lint/correctness/noUnusedVariables: intentionally unused — tests that type access errors
		type HasId = NodeJSXProps<TestLabel>["id"];
	});

	test("excludes getter-only properties", () => {
		// hovered is getter-only on TestButton
		// @ts-expect-error — hovered is readonly getter, should not be in props
		// biome-ignore lint/correctness/noUnusedVariables: intentionally unused — tests that type access errors
		type HasHovered = NodeJSXProps<TestButton>["hovered"];
	});

	test("excludes readonly interactive", () => {
		// interactive is `readonly` on TestLabel
		// @ts-expect-error — interactive is readonly, should not be in props
		// biome-ignore lint/correctness/noUnusedVariables: intentionally unused — tests that type access errors
		type HasInteractive = NodeJSXProps<TestLabel>["interactive"];
	});
});

describe("NodeJSXProps — method exclusion", () => {
	test("excludes lifecycle methods", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onReady");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onUpdate");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onFixedUpdate");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onEnterTree");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onExitTree");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("onDestroy");
	});

	test("excludes instance methods", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("destroy");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("add");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("removeSelf");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("find");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("tag");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("set");
		expectTypeOf<NodeJSXProps<TestLabel>>().not.toHaveProperty("serialize");
	});
});

describe("NodeJSXProps — underscore exclusion", () => {
	test("excludes underscore-prefixed properties", () => {
		expectTypeOf<NodeJSXProps<TestButton>>().not.toHaveProperty("_hovered");
	});
});

// ---- Vec2 Coercion Tests ----

describe("NodeJSXProps — Vec2 coercion", () => {
	test("position accepts Vec2 or [number, number] tuple", () => {
		type PosType = NodeJSXProps<TestLabel>["position"];
		expectTypeOf<Vec2>().toMatchTypeOf<NonNullable<PosType>>();
		expectTypeOf<[number, number]>().toMatchTypeOf<NonNullable<PosType>>();
	});

	test("velocity accepts Vec2 or [number, number] tuple", () => {
		type VelType = NodeJSXProps<TestActor>["velocity"];
		expectTypeOf<Vec2>().toMatchTypeOf<NonNullable<VelType>>();
		expectTypeOf<[number, number]>().toMatchTypeOf<NonNullable<VelType>>();
	});

	test("scale accepts Vec2, [number, number], or number", () => {
		type ScaleType = NodeJSXProps<TestLabel>["scale"];
		expectTypeOf<Vec2>().toMatchTypeOf<NonNullable<ScaleType>>();
		expectTypeOf<[number, number]>().toMatchTypeOf<NonNullable<ScaleType>>();
		expectTypeOf<number>().toMatchTypeOf<NonNullable<ScaleType>>();
	});

	test("position does NOT accept a string", () => {
		type PosType = NonNullable<NodeJSXProps<TestLabel>["position"]>;
		expectTypeOf<string>().not.toMatchTypeOf<PosType>();
	});

	test("position does NOT accept a bare number", () => {
		type PosType = NonNullable<NodeJSXProps<TestLabel>["position"]>;
		expectTypeOf<number>().not.toMatchTypeOf<PosType>();
	});
});

// ---- Color Coercion Tests ----

describe("NodeJSXProps — Color coercion", () => {
	test("color accepts Color or string", () => {
		type ColorType = NodeJSXProps<TestLabel>["color"];
		expectTypeOf<Color>().toMatchTypeOf<NonNullable<ColorType>>();
		expectTypeOf<string>().toMatchTypeOf<NonNullable<ColorType>>();
	});

	test("textColor accepts Color or string", () => {
		type TextColorType = NodeJSXProps<TestButton>["textColor"];
		expectTypeOf<Color>().toMatchTypeOf<NonNullable<TextColorType>>();
		expectTypeOf<string>().toMatchTypeOf<NonNullable<TextColorType>>();
	});

	test("backgroundColor accepts Color or string", () => {
		type BgColorType = NodeJSXProps<TestButton>["backgroundColor"];
		expectTypeOf<Color>().toMatchTypeOf<NonNullable<BgColorType>>();
		expectTypeOf<string>().toMatchTypeOf<NonNullable<BgColorType>>();
	});
});

// ---- Signal Handler Tests ----

describe("NodeJSXProps — signal handlers", () => {
	test("void signal accepts () => void handler", () => {
		expectTypeOf<NodeJSXProps<TestButton>>().toHaveProperty("onPressed");
		expectTypeOf<NodeJSXProps<TestButton>["onPressed"]>().toEqualTypeOf<(() => void) | undefined>();
	});

	test("typed signal accepts (payload: T) => void handler", () => {
		expectTypeOf<NodeJSXProps<TestButton>>().toHaveProperty("onHoverChanged");
		expectTypeOf<NodeJSXProps<TestButton>["onHoverChanged"]>().toEqualTypeOf<
			((payload: boolean) => void) | undefined
		>();
	});

	test("complex payload signal accepts typed handler", () => {
		expectTypeOf<NodeJSXProps<TestActor>>().toHaveProperty("collided");
		expectTypeOf<NodeJSXProps<TestActor>["collided"]>().toEqualTypeOf<
			((payload: { normal: Vec2 }) => void) | undefined
		>();
	});

	test("inherited signals from Node base class", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("treeEntered");
		expectTypeOf<NodeJSXProps<TestLabel>["treeEntered"]>().toEqualTypeOf<
			(() => void) | undefined
		>();

		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("readySignal");
		expectTypeOf<NodeJSXProps<TestLabel>["readySignal"]>().toEqualTypeOf<
			(() => void) | undefined
		>();
	});
});

// ---- JSX-specific Props ----

describe("NodeJSXProps — JSX-specific props", () => {
	test("accepts ref as string", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("ref");
		expectTypeOf<string>().toMatchTypeOf<NonNullable<NodeJSXProps<TestLabel>["ref"]>>();
	});

	test("accepts ref as callback", () => {
		expectTypeOf<(node: TestLabel) => void>().toMatchTypeOf<
			NonNullable<NodeJSXProps<TestLabel>["ref"]>
		>();
	});

	test("accepts ref as legacy Ref<T>", () => {
		expectTypeOf<Ref<TestLabel>>().toMatchTypeOf<NonNullable<NodeJSXProps<TestLabel>["ref"]>>();
	});

	test("accepts children prop", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("children");
	});

	test("accepts key prop", () => {
		expectTypeOf<NodeJSXProps<TestLabel>>().toHaveProperty("key");
		expectTypeOf<string>().toMatchTypeOf<NonNullable<NodeJSXProps<TestLabel>["key"]>>();
		expectTypeOf<number>().toMatchTypeOf<NonNullable<NodeJSXProps<TestLabel>["key"]>>();
	});
});

// ---- Scene Exclusion ----

describe("NodeJSXProps — Scene exclusion", () => {
	test("Scene does not satisfy NodeConstructor (requires Game arg)", () => {
		// Scene constructor requires (game: Game), so it does NOT match NodeConstructor<T>
		// which requires new () => T. This means <MyScene /> would be a type error.
		// We verify by checking Scene cannot be assigned to NodeConstructor.
		// @ts-expect-error — Scene requires a Game arg, doesn't match zero-arg NodeConstructor
		const _check: NodeConstructor = class extends Node {
			constructor(_requiredArg: string) {
				super();
			}
		};
	});
});

// ---- All Props Optional ----

describe("NodeJSXProps — all props optional", () => {
	test("empty props object is valid", () => {
		// All properties in NodeJSXProps should be optional
		assertType<NodeJSXProps<TestLabel>>({});
	});

	test("single prop is valid", () => {
		assertType<NodeJSXProps<TestLabel>>({ text: "hello" });
	});

	test("mixed props are valid", () => {
		assertType<NodeJSXProps<TestLabel>>({
			text: "hello",
			fontSize: 24,
			position: [100, 200],
			color: "#ff0000",
		});
	});

	test("signal handler props are valid", () => {
		assertType<NodeJSXProps<TestButton>>({
			text: "Click me",
			onPressed: () => {},
			onHoverChanged: (_hovered: boolean) => {},
		});
	});
});

// ---- Dollar Ref Type Tests ----

describe("NodeJSXProps — dollar refs", () => {
	test("$string accepted on Node-typed property", () => {
		type FollowType = NodeJSXProps<TestCamera>["follow"];
		expectTypeOf<`$${string}`>().toMatchTypeOf<NonNullable<FollowType>>();
	});

	test("$string accepted as literal on Node-typed prop", () => {
		assertType<NodeJSXProps<TestCamera>>({ follow: "$player" });
	});

	test("$string NOT accepted on Vec2-typed property", () => {
		type PosType = NonNullable<NodeJSXProps<TestLabel>["position"]>;
		expectTypeOf<`$${string}`>().not.toMatchTypeOf<PosType>();
	});

	test("$string NOT accepted on number-typed property", () => {
		type SmoothType = NonNullable<NodeJSXProps<TestCamera>["smoothing"]>;
		expectTypeOf<`$${string}`>().not.toMatchTypeOf<SmoothType>();
	});
});
