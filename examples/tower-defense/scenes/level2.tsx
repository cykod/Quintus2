import { LEVEL2_PATH, type PathDef } from "../path.js";
import { TDLevel } from "./td-level.js";

export class Level2 extends TDLevel {
	getPath(): PathDef {
		return LEVEL2_PATH;
	}
}
