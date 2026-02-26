import { Node } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { Container } from "./container.js";
import { UINode } from "./ui-node.js";

describe("Container", () => {
	it("is non-interactive by default", () => {
		const c = new Container();
		expect(c.interactive).toBe(false);
	});

	it("vertical layout positions children top-to-bottom", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.direction = "vertical";
		c.gap = 10;

		const a = new UINode();
		a.width = 100;
		a.height = 30;
		const b = new UINode();
		b.width = 100;
		b.height = 40;

		c.add(a);
		c.add(b);
		c.layout();

		expect(a.position.x).toBe(0);
		expect(a.position.y).toBe(0);
		expect(b.position.x).toBe(0);
		expect(b.position.y).toBe(40); // 30 + 10 gap
	});

	it("horizontal layout positions children left-to-right", () => {
		const c = new Container();
		c.width = 400;
		c.height = 200;
		c.direction = "horizontal";
		c.gap = 5;

		const a = new UINode();
		a.width = 60;
		a.height = 30;
		const b = new UINode();
		b.width = 80;
		b.height = 30;

		c.add(a);
		c.add(b);
		c.layout();

		expect(a.position.x).toBe(0);
		expect(a.position.y).toBe(0);
		expect(b.position.x).toBe(65); // 60 + 5 gap
		expect(b.position.y).toBe(0);
	});

	it("padding offsets start position", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.padding = 10;
		c.gap = 0;

		const a = new UINode();
		a.width = 50;
		a.height = 20;
		c.add(a);
		c.layout();

		expect(a.position.x).toBe(10);
		expect(a.position.y).toBe(10);
	});

	it("center alignment centers children", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.align = "center";

		const a = new UINode();
		a.width = 100;
		a.height = 30;
		c.add(a);
		c.layout();

		expect(a.position.x).toBe(50); // (200 - 100) / 2
	});

	it("end alignment positions children at end", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.align = "end";

		const a = new UINode();
		a.width = 100;
		a.height = 30;
		c.add(a);
		c.layout();

		expect(a.position.x).toBe(100); // 200 - 100 - 0 padding
	});

	it("skips invisible children", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.gap = 10;

		const a = new UINode();
		a.width = 100;
		a.height = 30;
		const b = new UINode();
		b.width = 100;
		b.height = 30;
		b.visible = false;
		const d = new UINode();
		d.width = 100;
		d.height = 30;

		c.add(a);
		c.add(b);
		c.add(d);
		c.layout();

		expect(d.position.y).toBe(40); // 30 + 10, skipping invisible b
	});

	it("skips non-UINode children", () => {
		const c = new Container();
		c.width = 200;
		c.height = 400;
		c.gap = 10;

		const a = new UINode();
		a.width = 100;
		a.height = 30;
		const plain = new Node();
		const b = new UINode();
		b.width = 100;
		b.height = 30;

		c.add(a);
		c.add(plain);
		c.add(b);
		c.layout();

		expect(b.position.y).toBe(40); // 30 + 10, skipping plain Node
	});
});
