import type { Node } from "@quintus/core";

const REF_BRAND = Symbol("Ref");

export interface Ref<T extends Node = Node> {
	current: T | null;
	readonly [REF_BRAND]: true;
}

export function ref<T extends Node>(): Ref<T> {
	return { current: null, [REF_BRAND]: true } as Ref<T>;
}

export function isRef(value: unknown): value is Ref {
	return value != null && typeof value === "object" && REF_BRAND in (value as object);
}
