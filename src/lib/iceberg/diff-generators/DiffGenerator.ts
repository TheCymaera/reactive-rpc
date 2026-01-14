import type { ParsedRequest } from "../core.js";
import type { JSONPatch } from "./jsonPatch.js";

export interface DiffGenerator {
	generateDiffResponse(
		request: ParsedRequest,
		previousResponseHash: string | undefined,
		currentResponseHash: string,
		currentResponse: unknown
	): Promise<JSONPatch | undefined>;
}