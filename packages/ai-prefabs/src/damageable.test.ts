import { _resetNodeIdCounter, Game, Scene } from "@quintus/core";
import { Actor, PhysicsPlugin } from "@quintus/physics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Damageable, type DamageableConfig } from "./damageable.js";

function setup(cfg?: Partial<DamageableConfig>) {
	const DamageableActor = Damageable(Actor, cfg);
	class TestActor extends DamageableActor {
		override collisionGroup = "test";
		override solid = false;
		override gravity = 0;
		override applyGravity = false;
	}

	_resetNodeIdCounter();
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 100, height: 100, canvas, renderer: null });
	game.use(PhysicsPlugin({ collisionGroups: { test: { collidesWith: [] } } }));

	let actor!: InstanceType<typeof TestActor>;
	class TestScene extends Scene {
		override onReady() {
			actor = this.add(TestActor);
			actor.position._set(50, 50);
		}
	}
	game.registerScenes({ test: TestScene });
	game.start("test");
	game.step();

	return { game, actor };
}

describe("Damageable", () => {
	beforeEach(() => _resetNodeIdCounter());

	it("initializes health to maxHealth", () => {
		const { actor } = setup({ maxHealth: 5 });
		expect(actor.health).toBe(5);
		expect(actor.maxHealth).toBe(5);
	});

	it("defaults maxHealth to 3", () => {
		const { actor } = setup();
		expect(actor.health).toBe(3);
	});

	it("reduces health on takeDamage", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 0 });
		actor.takeDamage(2);
		expect(actor.health).toBe(3);
	});

	it("emits damaged signal with remaining health", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 0 });
		const handler = vi.fn();
		actor.damaged.connect(handler);
		actor.takeDamage(2);
		expect(handler).toHaveBeenCalledWith(3);
	});

	it("emits died signal when health reaches 0", () => {
		const { actor } = setup({ maxHealth: 3, invincibilityDuration: 0, deathTween: false });
		const handler = vi.fn();
		actor.died.connect(handler);
		actor.takeDamage(3);
		expect(handler).toHaveBeenCalledOnce();
		expect(actor.isDead()).toBe(true);
	});

	it("destroys on death when deathTween is false", () => {
		const { game, actor } = setup({
			maxHealth: 1,
			invincibilityDuration: 0,
			deathTween: false,
		});
		actor.takeDamage(1);
		game.step();
		expect(game.currentScene?.findByType(Actor)).toBeNull();
	});

	it("blocks damage during invincibility", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 1 });
		actor.takeDamage(1);
		expect(actor.health).toBe(4);
		expect(actor.isInvincible()).toBe(true);
		actor.takeDamage(1);
		expect(actor.health).toBe(4);
	});

	it("invincibility expires after duration", () => {
		const { game, actor } = setup({ maxHealth: 5, invincibilityDuration: 0.5 });
		actor.takeDamage(1);
		expect(actor.isInvincible()).toBe(true);
		// Run for ~0.5s at 60fps = 30 frames
		for (let i = 0; i < 31; i++) game.step();
		expect(actor.isInvincible()).toBe(false);
		actor.takeDamage(1);
		expect(actor.health).toBe(3);
	});

	it("does not grant invincibility on lethal hit", () => {
		const { actor } = setup({ maxHealth: 1, invincibilityDuration: 1, deathTween: false });
		actor.takeDamage(1);
		expect(actor.isDead()).toBe(true);
		expect(actor.isInvincible()).toBe(false);
	});

	it("does not grant invincibility when duration is 0", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 0 });
		actor.takeDamage(1);
		expect(actor.isInvincible()).toBe(false);
	});

	it("ignores damage after death", () => {
		const { actor } = setup({ maxHealth: 3, invincibilityDuration: 0, deathTween: false });
		actor.takeDamage(3);
		const handler = vi.fn();
		actor.damaged.connect(handler);
		actor.takeDamage(1);
		expect(handler).not.toHaveBeenCalled();
	});

	it("heals up to maxHealth", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 0 });
		actor.takeDamage(3);
		expect(actor.health).toBe(2);
		actor.heal(10);
		expect(actor.health).toBe(5);
	});

	it("does not heal when dead", () => {
		const { actor } = setup({ maxHealth: 3, invincibilityDuration: 0, deathTween: false });
		actor.takeDamage(3);
		actor.heal(1);
		expect(actor.health).toBe(0);
	});

	it("clamps health at 0 on overkill", () => {
		const { actor } = setup({ maxHealth: 3, invincibilityDuration: 0, deathTween: false });
		actor.takeDamage(10);
		expect(actor.health).toBe(0);
	});

	it("gracefully falls back when tween unavailable", () => {
		const { game, actor } = setup({ maxHealth: 1, deathTween: true });
		actor.takeDamage(1);
		expect(actor.isDead()).toBe(true);
		// Without TweenPlugin, destroy is called immediately as fallback
		game.step();
		expect(game.currentScene?.findByType(Actor)).toBeNull();
	});

	it("pool reset restores full health and clears state", () => {
		const { actor } = setup({ maxHealth: 5, invincibilityDuration: 1, deathTween: false });
		actor.takeDamage(3);
		expect(actor.health).toBe(2);
		expect(actor.isInvincible()).toBe(true);
		// Simulate pool reset
		actor._poolReset();
		expect(actor.health).toBe(5);
		expect(actor.isInvincible()).toBe(false);
		expect(actor.isDead()).toBe(false);
	});
});
