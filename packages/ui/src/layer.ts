import { type Node, Node2D, type NodeConstructor } from "@quintus/core";

export class Layer extends Node2D {
	get fixed(): boolean {
		return this.renderFixed;
	}

	set fixed(v: boolean) {
		this.renderFixed = v;
		this._propagateRenderFixed(v);
	}

	override addChild(node: Node): this;
	override addChild<T extends Node>(NodeClass: NodeConstructor<T>): T;
	override addChild(nodeOrClass: Node | NodeConstructor<Node>): Node | this {
		const result = super.addChild(nodeOrClass as Node);
		const child = typeof nodeOrClass === "function" ? result : nodeOrClass;
		if (child instanceof Node2D) {
			child.renderFixed = this.renderFixed;
			if (!(child instanceof Layer)) {
				this._propagateRenderFixedRecursive(child, this.renderFixed);
			}
		}
		return result;
	}

	private _propagateRenderFixed(value: boolean): void {
		for (const child of this.children) {
			if (child instanceof Node2D) {
				child.renderFixed = value;
				if (child instanceof Layer) continue;
				this._propagateRenderFixedRecursive(child, value);
			}
		}
	}

	private _propagateRenderFixedRecursive(node: Node2D, value: boolean): void {
		for (const child of node.children) {
			if (child instanceof Node2D) {
				child.renderFixed = value;
				if (!(child instanceof Layer)) {
					this._propagateRenderFixedRecursive(child, value);
				}
			}
		}
	}
}
