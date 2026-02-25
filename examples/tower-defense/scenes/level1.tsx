import { LEVEL1_PATH, type PathDef } from "../path.js";
import { TDLevel } from "./td-level.js";

export class Level1 extends TDLevel {
	getPath(): PathDef {
		return LEVEL1_PATH;
	}
}
