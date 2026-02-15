import { UINode } from "./ui-node.js";

export class Container extends UINode {
	direction: "vertical" | "horizontal" = "vertical";
	gap = 4;
	padding = 0;
	align: "start" | "center" | "end" = "start";

	override interactive = false;

	layout(): void {
		let offset = this.padding;

		for (const child of this.children) {
			if (!(child instanceof UINode)) continue;
			if (!child.visible) continue;

			if (this.direction === "vertical") {
				let x = this.padding;
				if (this.align === "center") {
					x = (this.width - child.width) / 2;
				} else if (this.align === "end") {
					x = this.width - child.width - this.padding;
				}
				child.position.x = x;
				child.position.y = offset;
				offset += child.height + this.gap;
			} else {
				let y = this.padding;
				if (this.align === "center") {
					y = (this.height - child.height) / 2;
				} else if (this.align === "end") {
					y = this.height - child.height - this.padding;
				}
				child.position.x = offset;
				child.position.y = y;
				offset += child.width + this.gap;
			}
		}
	}

	override onUpdate(_dt: number): void {
		this.layout();
	}
}
