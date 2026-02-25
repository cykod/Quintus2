import { FRAME } from "../sprites.js";

export interface WeaponDef {
	name: string;
	fireRate: number;
	damage: number;
	bulletSpeed: number;
	ammo: number;
	maxAmmo: number;
	reloadTime: number;
	spread: number;
	playerFrame: string;
	sound: string;
}

export const WEAPONS: Record<string, WeaponDef> = {
	pistol: {
		name: "Pistol",
		fireRate: 0.3,
		damage: 25,
		bulletSpeed: 400,
		ammo: Infinity,
		maxAmmo: Infinity,
		reloadTime: 0,
		spread: 0,
		playerFrame: FRAME.PLAYER_GUN,
		sound: "shoot_pistol",
	},
	machine: {
		name: "Machine Gun",
		fireRate: 0.08,
		damage: 10,
		bulletSpeed: 500,
		ammo: 60,
		maxAmmo: 60,
		reloadTime: 1.5,
		spread: 0.1,
		playerFrame: FRAME.PLAYER_MACHINE,
		sound: "shoot_machine",
	},
	silencer: {
		name: "Silencer",
		fireRate: 0.5,
		damage: 50,
		bulletSpeed: 350,
		ammo: 12,
		maxAmmo: 12,
		reloadTime: 2.0,
		spread: 0,
		playerFrame: FRAME.PLAYER_SILENCER,
		sound: "shoot_silencer",
	},
};
